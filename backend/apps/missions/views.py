"""
Views pour les Fiches de Mission et Absences des Agents de Liaison.

Endpoints FicheMission :
  GET/POST   /api/missions/
  GET/PUT/PATCH/DELETE /api/missions/{id}/
  POST /api/missions/{id}/soumettre/
  POST /api/missions/{id}/valider/    (Manager → DAF → DG)
  POST /api/missions/{id}/rejeter/
  POST /api/missions/{id}/cloturer/

Endpoints AbsenceAgent :
  GET/POST   /api/missions/absences/
  GET/PUT/PATCH/DELETE /api/missions/absences/{id}/
  POST /api/missions/absences/{id}/valider/
  POST /api/missions/absences/{id}/annuler/
"""

from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role, User
from apps.fiches.emails import notify_email
from .models import AbsenceAgent, AbsenceStatus, FicheMission, FicheMissionStatus
from .permissions import CanManageAbsence, CanManageMission
from .serializers import (
    AbsenceAgentSerializer,
    FicheMissionListSerializer,
    FicheMissionSerializer,
)


class FicheMissionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CanManageMission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["numero", "nom_prenom", "destination", "objet_mission"]
    ordering_fields = ["created_at", "date", "status", "destination"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        qs = FicheMission.objects.select_related(
            "beneficiaire", "agent_liaison", "created_by", "department"
        ).order_by("-created_at")

        # Filtres
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        dept_filter = self.request.query_params.get("department")
        if dept_filter:
            qs = qs.filter(department=dept_filter)

        fiche_ext_id = self.request.query_params.get("fiche_externe_id")
        if fiche_ext_id:
            qs = qs.filter(fiche_externe_id=fiche_ext_id)

        # Restriction par rôle
        if user.role in (Role.DIRECTOR, Role.DAF, Role.ADMIN) or user.is_staff or user.is_rh:
            return qs  # Visibilité totale
        if user.role == Role.MANAGER:
            return qs.filter(
                created_by__in=list(user.subordinates.values_list("id", flat=True)) + [user.id]
            )
        return qs.filter(created_by=user)

    def get_serializer_class(self):
        if self.action == "list":
            return FicheMissionListSerializer
        return FicheMissionSerializer

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_rh or user.role == Role.ADMIN or user.is_staff):
            raise PermissionDenied("Seule la RH peut créer des fiches de mission.")
        serializer.save(created_by=user)

    # ── Workflow ─────────────────────────────────────────────────────

    @action(detail=True, methods=["post"])
    def soumettre(self, request, pk=None):
        """Soumettre la fiche (DRAFT → PENDING_MANAGER)."""
        mission = self.get_object()
        if mission.status != FicheMissionStatus.DRAFT:
            raise ValidationError("Seule une fiche en brouillon peut être soumise.")
        user = request.user
        if mission.created_by != user and not (user.is_rh or user.role == Role.ADMIN or user.is_staff):
            raise PermissionDenied("Seule la RH créatrice peut soumettre cette fiche.")
        mission.status = FicheMissionStatus.PENDING_MANAGER
        mission.save(update_fields=["status", "updated_at"])

        # Notifier les managers du département par e-mail
        managers = list(User.objects.filter(
            role=Role.MANAGER, department=mission.department, is_active=True
        ))
        if not managers:
            managers = list(User.objects.filter(role=Role.MANAGER, is_active=True))
        nom = mission.nom_prenom or mission.beneficiaire.get_full_name() if mission.beneficiaire else mission.nom_prenom
        notify_email(
            managers,
            subject=f"Fiche Mission {mission.numero} — Validation requise",
            body=(
                f"La fiche de mission {mission.numero} pour {nom} "
                f"(destination : {mission.destination}) a été soumise et requiert votre approbation.\n\n"
                f"Objet : {mission.objet_mission}"
            ),
        )

        return Response(FicheMissionSerializer(mission, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def valider(self, request, pk=None):
        """
        Validation à chaque étape selon le rôle :
          PENDING_MANAGER → PENDING_DAF    (rôle MANAGER)
          PENDING_DAF     → PENDING_DG     (rôle DAF)
          PENDING_DG      → APPROVED       (rôle DIRECTOR)
        """
        mission = self.get_object()
        user = request.user
        commentaire = request.data.get("commentaire", "")

        transitions = {
            FicheMissionStatus.PENDING_MANAGER: (
                [Role.MANAGER, Role.DAF, Role.DIRECTOR, Role.ADMIN],
                FicheMissionStatus.PENDING_DAF,
                "DAF",          # rôle destinataire suivant
            ),
            FicheMissionStatus.PENDING_DAF: (
                [Role.DAF, Role.ADMIN],
                FicheMissionStatus.PENDING_DG,
                "DIRECTOR",
            ),
            FicheMissionStatus.PENDING_DG: (
                [Role.DIRECTOR, Role.ADMIN],
                FicheMissionStatus.APPROVED,
                None,           # notifie le créateur
            ),
        }

        if mission.status not in transitions:
            raise ValidationError(f"La fiche ne peut pas être validée depuis le statut '{mission.get_status_display()}'.")

        allowed_roles, next_status, next_role = transitions[mission.status]
        if user.role not in allowed_roles and not user.is_staff and not user.is_rh:
            raise PermissionDenied("Vous n'avez pas la permission de valider à cette étape.")

        mission.status = next_status
        if commentaire:
            mission.notes = (mission.notes + f"\n[{user}] {commentaire}").strip()
        mission.save(update_fields=["status", "notes", "updated_at"])

        # E-mail de notification
        nom = mission.nom_prenom
        if next_role:
            email_recipients = list(User.objects.filter(role=next_role, is_active=True))
            notify_email(
                email_recipients,
                subject=f"Fiche Mission {mission.numero} — Validation requise ({next_role})",
                body=(
                    f"La fiche de mission {mission.numero} pour {nom} a été validée par "
                    f"{user.get_full_name() or user.username} et passe à votre niveau.\n\n"
                    f"Destination : {mission.destination}\nObjet : {mission.objet_mission}"
                ),
            )
        else:
            # Approbation finale → notifier le créateur
            notify_email(
                [mission.created_by],
                subject=f"Fiche Mission {mission.numero} — Approuvée",
                body=(
                    f"La fiche de mission {mission.numero} pour {nom} a été approuvée.\n\n"
                    f"Destination : {mission.destination}"
                ),
            )

        return Response(FicheMissionSerializer(mission, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def rejeter(self, request, pk=None):
        """Rejeter la fiche à n'importe quelle étape de validation."""
        mission = self.get_object()
        user = request.user
        if mission.status not in (
            FicheMissionStatus.PENDING_MANAGER,
            FicheMissionStatus.PENDING_DAF,
            FicheMissionStatus.PENDING_DG,
        ):
            raise ValidationError("La fiche ne peut pas être rejetée dans son état actuel.")
        if user.role not in (Role.MANAGER, Role.DAF, Role.DIRECTOR, Role.ADMIN) and not user.is_staff and not user.is_rh:
            raise PermissionDenied("Vous n'avez pas la permission de rejeter.")
        commentaire = request.data.get("commentaire", "")
        mission.status = FicheMissionStatus.REJECTED
        if commentaire:
            mission.notes = (mission.notes + f"\n[{user}] REJET : {commentaire}").strip()
        mission.save(update_fields=["status", "notes", "updated_at"])

        # Notifier le créateur du rejet
        motif = f" Motif : {commentaire}" if commentaire else ""
        notify_email(
            [mission.created_by],
            subject=f"Fiche Mission {mission.numero} — Rejetée",
            body=(
                f"La fiche de mission {mission.numero} pour {mission.nom_prenom} a été rejetée par "
                f"{user.get_full_name() or user.username}.{motif}"
            ),
        )

        return Response(FicheMissionSerializer(mission, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def cloturer(self, request, pk=None):
        """Clôturer la mission (APPROVED/IN_PROGRESS → DONE)."""
        mission = self.get_object()
        if mission.status not in (FicheMissionStatus.APPROVED, FicheMissionStatus.IN_PROGRESS):
            raise ValidationError("Seule une mission approuvée peut être clôturée.")
        mission.status = FicheMissionStatus.DONE
        mission.save(update_fields=["status", "updated_at"])
        return Response(FicheMissionSerializer(mission, context={"request": request}).data)


class AbsenceAgentViewSet(viewsets.ModelViewSet):
    """
    Gestion des absences des agents de liaison.
    Un agent peut déclarer ses propres absences.
    Un manager/admin peut les valider.
    """
    permission_classes = [IsAuthenticated, CanManageAbsence]
    serializer_class = AbsenceAgentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["agent__first_name", "agent__last_name", "description"]
    ordering_fields = ["date_debut", "date_fin", "created_at"]
    ordering = ["-date_debut"]

    def get_queryset(self):
        user = self.request.user
        qs = AbsenceAgent.objects.select_related("agent", "fiche_mission").order_by("-date_debut")

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        # Un agent ne voit que ses propres absences (sauf si manager/admin)
        if user.role not in (Role.MANAGER, Role.DAF, Role.DIRECTOR, Role.ADMIN) and not user.is_staff and not user.is_rh:
            qs = qs.filter(agent=user)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        # Un agent ne peut déclarer que pour lui-même (sauf admin/manager)
        agent = serializer.validated_data.get("agent")
        if agent != user and user.role not in (Role.MANAGER, Role.DAF, Role.DIRECTOR, Role.ADMIN):
            raise PermissionDenied("Vous ne pouvez déclarer une absence que pour vous-même.")
        serializer.save()

    @action(detail=True, methods=["post"])
    def valider(self, request, pk=None):
        """Valider une absence (DECLARED → VALIDATED)."""
        absence = self.get_object()
        if request.user.role not in (Role.MANAGER, Role.DAF, Role.DIRECTOR, Role.ADMIN) and not request.user.is_staff and not request.user.is_rh:
            raise PermissionDenied("Seul un manager peut valider une absence.")
        if absence.status != AbsenceStatus.DECLARED:
            raise ValidationError("Cette absence n'est pas en attente de validation.")
        absence.status = AbsenceStatus.VALIDATED
        absence.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(absence).data)

    @action(detail=True, methods=["post"])
    def annuler(self, request, pk=None):
        """Annuler une absence."""
        absence = self.get_object()
        if absence.status == AbsenceStatus.CANCELLED:
            raise ValidationError("Cette absence est déjà annulée.")
        absence.status = AbsenceStatus.CANCELLED
        absence.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(absence).data)
