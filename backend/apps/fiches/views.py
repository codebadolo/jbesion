"""
ViewSets for the fiches app.

FicheInterneViewSet  — CRUD + submit + validate + validations list
FicheExterneViewSet  — same structure, different workflow
DashboardView        — aggregated statistics
"""

from datetime import date
from django.utils import timezone

from django.contrib.contenttypes.models import ContentType
from django.db.models import QuerySet, Count, Q
from django.db.models.functions import TruncMonth
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role, User
from apps.bons_paiement.models import BonPaiement, BonPaiementItem, BonPaiementStatus, ModePaiement
from .models import (
    FicheInterne,
    FicheInterneStatus,
    FicheExterne,
    FicheExterneStatus,
    Validation,
    Notification,
    NotificationType,
    FicheType,
    ValidationStatus,
)
from .pagination import FichePageNumberPagination
from .permissions import (
    IsOwnerOrReadOnly,
    CanValidateFicheInterne,
    CanValidateFicheExterne,
    CanExecuteFiche,
)
from .serializers import (
    FicheInterneSerializer,
    FicheInterneListSerializer,
    FicheExterneSerializer,
    FicheExterneListSerializer,
    ValidateActionSerializer,
    RespondClarificationSerializer,
    ValidationSerializer,
    NotificationSerializer,
)


# ---------------------------------------------------------------------------
# Notification helpers
# ---------------------------------------------------------------------------

def _notify(recipients, sender, message, notif_type, fiche_type, fiche_id):
    """
    Create Notification records for each recipient (skip sender).
    ADMIN, DIRECTOR and DAF always receive a copy as global observers.
    """
    observers = list(User.objects.filter(
        role__in=[Role.ADMIN, Role.DIRECTOR, Role.DAF], is_active=True
    ))
    seen_pks: set = set()
    all_recipients = []
    for u in list(recipients) + observers:
        if u.pk not in seen_pks:
            seen_pks.add(u.pk)
            all_recipients.append(u)
    for user in all_recipients:
        if user != sender:
            Notification.objects.create(
                recipient=user,
                sender=sender,
                message=message,
                notification_type=notif_type,
                fiche_type=fiche_type,
                fiche_id=fiche_id,
            )


def _dept_managers(department):
    """Return active MANAGERs belonging to a department."""
    return list(User.objects.filter(role=Role.MANAGER, department=department, is_active=True))


def _users_by_role(*roles):
    """Return all active users with any of the given roles."""
    return list(User.objects.filter(role__in=roles, is_active=True))


# ---------------------------------------------------------------------------
# Bon de Paiement helper
# ---------------------------------------------------------------------------

_MODE_PAIEMENT_MAP = {
    "Espèces":  ModePaiement.ESPECE,
    "Espèce":   ModePaiement.ESPECE,
    "ESPECE":   ModePaiement.ESPECE,
    "Chèque":   ModePaiement.CHEQUE,
    "CHEQUE":   ModePaiement.CHEQUE,
}


def _create_bon_paiement(fiche, fiche_type_str, user, execution_data):
    """Auto-create a validated BonPaiement linked to a fiche at execution time."""
    mode_raw      = execution_data.get("execution_mode_paiement", "")
    mode          = _MODE_PAIEMENT_MAP.get(mode_raw, ModePaiement.ESPECE)
    montant       = execution_data.get("execution_montant") or 0
    beneficiaire  = execution_data.get("execution_fournisseur", "") or "—"
    ref           = execution_data.get("execution_reference", "")
    notes         = execution_data.get("execution_note", "")
    montant_lettres = execution_data.get("execution_montant_lettres", "")

    motif = f"Exécution fiche {fiche_type_str}-{fiche.pk:05d}"
    if ref:
        motif += f" — Réf. {ref}"

    bon = BonPaiement.objects.create(
        date=timezone.now().date(),
        beneficiaire=beneficiaire,
        motif=motif,
        mode_paiement=mode,
        montant=montant,
        montant_lettres=montant_lettres,
        notes=notes,
        status=BonPaiementStatus.VALIDATED,
        fiche_type=fiche_type_str,
        fiche_id=fiche.pk,
        created_by=user,
    )

    # Use items provided by the comptable if any, otherwise fall back to fiche items
    custom_items = execution_data.get("execution_items", [])
    if custom_items:
        for item in custom_items:
            designation = item.get("designation", "").strip() if isinstance(item, dict) else ""
            if designation:
                BonPaiementItem.objects.create(
                    bon=bon,
                    designation=designation,
                    montant=item.get("montant", 0) or 0,
                )
    else:
        fiche_items = list(fiche.items.all())
        if fiche_items:
            for item in fiche_items:
                BonPaiementItem.objects.create(
                    bon=bon,
                    designation=getattr(item, "designation", str(item)),
                    montant=getattr(item, "montant", 0) or getattr(item, "montant_prestataire", 0) or 0,
                )
        else:
            BonPaiementItem.objects.create(bon=bon, designation=motif, montant=montant)
    return bon


# ---------------------------------------------------------------------------
# Workflow helpers
# ---------------------------------------------------------------------------

# Next status in the FicheInterne approval chain
INTERNE_NEXT_STATUS = {
    FicheInterneStatus.PENDING_MANAGER:  FicheInterneStatus.PENDING_DAF,
    FicheInterneStatus.PENDING_DAF:      FicheInterneStatus.PENDING_DIRECTOR,
    FicheInterneStatus.PENDING_DIRECTOR: FicheInterneStatus.APPROVED,
}

# Next status in the FicheExterne approval chain
EXTERNE_NEXT_STATUS = {
    FicheExterneStatus.PENDING_MANAGER:  FicheExterneStatus.PENDING_DIRECTOR,
    FicheExterneStatus.PENDING_DIRECTOR: FicheExterneStatus.APPROVED,
}


# ---------------------------------------------------------------------------
# FicheInterne ViewSet
# ---------------------------------------------------------------------------

class FicheInterneViewSet(viewsets.ModelViewSet):
    """
    ViewSet for FicheInterne resources.

    Queryset filtering by role:
      EMPLOYEE  → only own fiches
      MANAGER   → own fiches + subordinates' fiches
      DAF       → all fiches
      DIRECTOR  → all fiches
      ADMIN     → all fiches

    Extra actions:
      POST /{id}/submit/    → DRAFT → PENDING_MANAGER
      POST /{id}/validate/  → advance or reject based on current status
      GET  /{id}/validations/ → list validation history
    """

    permission_classes = [IsAuthenticated]
    pagination_class = FichePageNumberPagination

    def get_queryset(self) -> QuerySet:
        user = self.request.user
        qs = FicheInterne.objects.select_related(
            "created_by", "department"
        ).prefetch_related("items")

        # Admin & Finance department members see all fiches (they handle execution)
        in_admin_finance = user.department and user.department.code == "AF"

        if user.role in (Role.DAF, Role.DIRECTOR, Role.ADMIN) or in_admin_finance or user.is_rh:
            pass  # see everything
        elif user.role == Role.MANAGER:
            # See all fiches from own department
            if user.department:
                qs = qs.filter(department=user.department)
            else:
                qs = qs.filter(created_by=user)
        else:
            qs = qs.filter(created_by=user)

        # Optional filters from query params
        created_by_id = self.request.query_params.get("created_by")
        if created_by_id:
            qs = qs.filter(created_by__id=created_by_id)

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        search_param = self.request.query_params.get("search", "").strip()
        if search_param:
            qs = qs.filter(
                Q(created_by__first_name__icontains=search_param) |
                Q(created_by__last_name__icontains=search_param) |
                Q(department__name__icontains=search_param) |
                Q(notes__icontains=search_param)
            )

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return FicheInterneListSerializer
        return FicheInterneSerializer

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsOwnerOrReadOnly()]
        if self.action == "validate":
            return [IsAuthenticated(), CanValidateFicheInterne()]
        if self.action == "execute":
            return [IsAuthenticated(), CanExecuteFiche()]
        return [IsAuthenticated()]

    # ------------------------------------------------------------------
    # Override create to auto-assign created_by and department
    # ------------------------------------------------------------------
    def perform_create(self, serializer):
        user = self.request.user
        department = serializer.validated_data.get("department") or user.department
        serializer.save(created_by=user, department=department)

    # ------------------------------------------------------------------
    # Override update / destroy to check DRAFT status
    # ------------------------------------------------------------------
    def update(self, request: Request, *args, **kwargs) -> Response:
        instance: FicheInterne = self.get_object()
        if instance.status != FicheInterneStatus.DRAFT:
            return Response(
                {"detail": "Seules les fiches en brouillon peuvent être modifiées."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        instance: FicheInterne = self.get_object()
        if instance.status != FicheInterneStatus.DRAFT:
            return Response(
                {"detail": "Seules les fiches en brouillon peuvent être supprimées."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.created_by != request.user and not (
            request.user.role == Role.ADMIN or request.user.is_staff
        ):
            return Response(
                {"detail": "Vous ne pouvez supprimer que vos propres fiches."},
                status=status.HTTP_403_FORBIDDEN,
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # POST /{id}/submit/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def submit(self, request: Request, pk=None) -> Response:
        """Move a DRAFT fiche to PENDING_MANAGER."""
        fiche: FicheInterne = self.get_object()

        if fiche.created_by != request.user and not (
            request.user.role == Role.ADMIN or request.user.is_staff
        ):
            return Response(
                {"detail": "Seul le créateur peut soumettre cette fiche."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if fiche.status != FicheInterneStatus.DRAFT:
            return Response(
                {"detail": f"Cette fiche ne peut pas être soumise (statut actuel : {fiche.get_status_display()})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not fiche.items.exists():
            return Response(
                {"detail": "Impossible de soumettre une fiche sans articles."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fiche.status = FicheInterneStatus.PENDING_MANAGER
        fiche.save(update_fields=["status", "updated_at"])

        # Notify managers of the department
        ref = f"FI-{fiche.pk:05d}"
        managers = _dept_managers(fiche.department) if fiche.department else _users_by_role(Role.MANAGER)
        _notify(
            managers, request.user,
            f"Nouveau besoin soumis : fiche {ref} de {request.user.get_full_name() or request.user.username} attend votre avis.",
            NotificationType.SUBMITTED, FicheType.INTERNE, fiche.pk,
        )

        return Response(
            FicheInterneSerializer(fiche, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # POST /{id}/validate/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def validate(self, request: Request, pk=None) -> Response:
        """
        Approve, reject, or request clarification on a fiche.

        Body: { "action": "approve"|"reject"|"request_clarification", "commentaire": "..." }

        approve              → advance to next step (FAVORABLE at PENDING_MANAGER)
        reject               → move to REJECTED, notify creator
        request_clarification→ move to PENDING_CLARIFICATION_*, notify department managers
        """
        fiche: FicheInterne = self.get_object()

        valid_statuses = list(INTERNE_NEXT_STATUS.keys())
        if fiche.status not in valid_statuses:
            return Response(
                {"detail": "Cette fiche n'est pas dans un état qui accepte une validation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        action_serializer = ValidateActionSerializer(data=request.data)
        action_serializer.is_valid(raise_exception=True)

        act = action_serializer.validated_data["action"]
        commentaire = action_serializer.validated_data.get("commentaire", "")
        user = request.user

        # Clarification only allowed from DAF or DIRECTOR step, not MANAGER
        if act == "request_clarification" and fiche.status == FicheInterneStatus.PENDING_MANAGER:
            return Response(
                {"detail": "La demande de clarification n'est pas disponible à cette étape."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if act == "request_clarification" and not commentaire:
            return Response(
                {"detail": "Un commentaire est requis pour demander une clarification."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Determine new status and decision
        if act == "approve":
            new_status = INTERNE_NEXT_STATUS[fiche.status]
            # Manager's approve = Favorable; others = Approved
            decision = (
                ValidationStatus.FAVORABLE
                if fiche.status == FicheInterneStatus.PENDING_MANAGER
                else ValidationStatus.APPROVED
            )
        elif act == "reject":
            new_status = FicheInterneStatus.REJECTED
            decision = ValidationStatus.REJECTED
        else:  # request_clarification
            if fiche.status == FicheInterneStatus.PENDING_DAF:
                new_status = FicheInterneStatus.PENDING_CLARIFICATION_DAF
            else:
                new_status = FicheInterneStatus.PENDING_CLARIFICATION_DIR
            decision = ValidationStatus.CLARIFICATION_REQUESTED

        # Record validation
        ct = ContentType.objects.get_for_model(FicheInterne)
        Validation.objects.create(
            fiche_type=FicheType.INTERNE,
            content_type=ct,
            object_id=fiche.pk,
            validator=user,
            role_at_validation=user.role,
            status=decision,
            commentaire=commentaire,
        )

        fiche.status = new_status
        fiche.save(update_fields=["status", "updated_at"])

        # ── Notifications ──────────────────────────────────────────
        ref = f"FI-{fiche.pk:05d}"
        if act == "approve":
            if new_status == FicheInterneStatus.PENDING_DAF:
                _notify(
                    _users_by_role(Role.DAF), user,
                    f"La fiche {ref} a reçu un avis favorable et attend votre approbation.",
                    NotificationType.FAVORABLE, FicheType.INTERNE, fiche.pk,
                )
            elif new_status == FicheInterneStatus.PENDING_DIRECTOR:
                _notify(
                    _users_by_role(Role.DIRECTOR), user,
                    f"La fiche {ref} a été approuvée par le DAF et attend votre accord pour exécution.",
                    NotificationType.APPROVED, FicheType.INTERNE, fiche.pk,
                )
            elif new_status == FicheInterneStatus.APPROVED:
                _notify(
                    [fiche.created_by], user,
                    f"Votre fiche {ref} a reçu l'accord du DG et est prête pour l'exécution.",
                    NotificationType.APPROVED, FicheType.INTERNE, fiche.pk,
                )
        elif act == "reject":
            _notify(
                [fiche.created_by], user,
                f"Votre fiche {ref} a été rejetée. Motif : {commentaire or '—'}",
                NotificationType.REJECTED, FicheType.INTERNE, fiche.pk,
            )
        else:  # request_clarification
            managers = _dept_managers(fiche.department)
            _notify(
                managers, user,
                f"Une clarification est demandée pour la fiche {ref} : {commentaire}",
                NotificationType.CLARIFICATION_REQUEST, FicheType.INTERNE, fiche.pk,
            )

        return Response(
            FicheInterneSerializer(fiche, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # POST /{id}/respond_clarification/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="respond_clarification")
    def respond_clarification(self, request: Request, pk=None) -> Response:
        """
        Manager responds to a clarification request on behalf of the collaborator.

        Body: { "commentaire": "..." }
        Fiche moves back to PENDING_DAF or PENDING_DIRECTOR.
        """
        fiche: FicheInterne = self.get_object()
        user = request.user

        if not (user.role == Role.MANAGER or user.role == Role.ADMIN or user.is_staff):
            return Response(
                {"detail": "Seul le Supérieur Hiérarchique peut répondre aux demandes de clarification."},
                status=status.HTTP_403_FORBIDDEN,
            )

        clarification_back = {
            FicheInterneStatus.PENDING_CLARIFICATION_DAF: FicheInterneStatus.PENDING_DAF,
            FicheInterneStatus.PENDING_CLARIFICATION_DIR: FicheInterneStatus.PENDING_DIRECTOR,
        }
        if fiche.status not in clarification_back:
            return Response(
                {"detail": "Cette fiche n'est pas en attente de clarification."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RespondClarificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        commentaire = serializer.validated_data["commentaire"]

        ct = ContentType.objects.get_for_model(FicheInterne)
        Validation.objects.create(
            fiche_type=FicheType.INTERNE,
            content_type=ct,
            object_id=fiche.pk,
            validator=user,
            role_at_validation=user.role,
            status=ValidationStatus.CLARIFICATION_RESPONDED,
            commentaire=commentaire,
        )

        new_status = clarification_back[fiche.status]
        was_daf_step = new_status == FicheInterneStatus.PENDING_DAF
        fiche.status = new_status
        fiche.save(update_fields=["status", "updated_at"])

        ref = f"FI-{fiche.pk:05d}"
        if was_daf_step:
            _notify(
                _users_by_role(Role.DAF), user,
                f"Clarification fournie pour la fiche {ref}. Elle est de nouveau en attente de votre approbation.",
                NotificationType.CLARIFICATION_RESPONSE, FicheType.INTERNE, fiche.pk,
            )
        else:
            _notify(
                _users_by_role(Role.DIRECTOR, Role.DAF), user,
                f"Clarification fournie pour la fiche {ref}. Elle est de nouveau en attente de validation DG.",
                NotificationType.CLARIFICATION_RESPONSE, FicheType.INTERNE, fiche.pk,
            )

        return Response(
            FicheInterneSerializer(fiche, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # GET /{id}/validations/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["get"])
    def validations(self, request: Request, pk=None) -> Response:
        """Return the validation history for this fiche."""
        fiche: FicheInterne = self.get_object()
        ct = ContentType.objects.get_for_model(FicheInterne)
        qs = Validation.objects.filter(
            content_type=ct, object_id=fiche.pk
        ).select_related("validator")
        serializer = ValidationSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    # ------------------------------------------------------------------
    # POST /{id}/execute/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def execute(self, request: Request, pk=None) -> Response:
        """Comptabilité (DAF) marque la fiche comme exécutée — crée automatiquement un Bon de Paiement."""
        fiche: FicheInterne = self.get_object()

        if fiche.status != FicheInterneStatus.APPROVED:
            return Response(
                {"detail": "Seules les fiches approuvées peuvent être exécutées."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fiche.status = FicheInterneStatus.IN_EXECUTION
        fiche.executed_by = request.user
        fiche.executed_at = timezone.now()
        fiche.execution_fournisseur = request.data.get("execution_fournisseur", "")
        fiche.execution_reference = request.data.get("execution_reference", "")
        fiche.execution_montant = request.data.get("execution_montant") or None
        fiche.execution_mode_paiement = request.data.get("execution_mode_paiement", "")
        fiche.execution_numero_facture = request.data.get("execution_numero_facture", "")
        fiche.execution_note = request.data.get("execution_note", "")
        fiche.save(update_fields=[
            "status", "executed_by", "executed_at",
            "execution_fournisseur", "execution_reference", "execution_montant",
            "execution_mode_paiement", "execution_numero_facture", "execution_note",
            "updated_at",
        ])

        # Auto-create linked Bon de Paiement
        _create_bon_paiement(fiche, "INTERNE", request.user, request.data)

        # Notify the fiche creator
        ref = f"FI-{fiche.pk:05d}"
        _notify(
            [fiche.created_by], request.user,
            f"Votre fiche {ref} est en cours d'exécution par la comptabilité.",
            NotificationType.IN_EXECUTION, FicheType.INTERNE, fiche.pk,
        )

        return Response(
            FicheInterneSerializer(fiche, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # POST /{id}/mark_received/
    # ------------------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="mark_received")
    def mark_received(self, request: Request, pk=None) -> Response:
        """Le demandeur (ou admin) confirme la réception de la commande."""
        fiche: FicheInterne = self.get_object()

        if fiche.status != FicheInterneStatus.IN_EXECUTION:
            return Response(
                {"detail": "La fiche doit être en cours d'exécution pour marquer la réception."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if fiche.created_by != request.user and not (
            request.user.role == Role.ADMIN or request.user.is_staff
        ):
            return Response(
                {"detail": "Seul le demandeur peut confirmer la réception."},
                status=status.HTTP_403_FORBIDDEN,
            )

        fiche.status = FicheInterneStatus.DELIVERED
        fiche.received_at = timezone.now()
        fiche.save(update_fields=["status", "received_at", "updated_at"])

        # Notify DAF and DG that the delivery is confirmed
        ref = f"FI-{fiche.pk:05d}"
        _notify(
            _users_by_role(Role.DAF, Role.DIRECTOR), request.user,
            f"La fiche {ref} a été réceptionnée par le demandeur.",
            NotificationType.DELIVERED, FicheType.INTERNE, fiche.pk,
        )

        return Response(
            FicheInterneSerializer(fiche, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# FicheExterne ViewSet
# ---------------------------------------------------------------------------

class FicheExterneViewSet(viewsets.ModelViewSet):
    """
    ViewSet for FicheExterne resources.

    Same role-based queryset filtering and extra actions as FicheInterneViewSet,
    but the validation workflow skips the DAF step.
    """

    permission_classes = [IsAuthenticated]
    pagination_class = FichePageNumberPagination

    def get_queryset(self) -> QuerySet:
        user = self.request.user
        qs = FicheExterne.objects.select_related(
            "created_by", "department"
        ).prefetch_related("items")

        # Admin & Finance department members see all fiches (they handle execution)
        in_admin_finance = user.department and user.department.code == "AF"

        if user.role in (Role.DAF, Role.DIRECTOR, Role.ADMIN) or in_admin_finance or user.is_rh:
            pass  # see everything
        elif user.role == Role.MANAGER:
            # See all fiches from own department
            if user.department:
                qs = qs.filter(department=user.department)
            else:
                qs = qs.filter(created_by=user)
        else:
            qs = qs.filter(created_by=user)

        # Optional filters from query params
        created_by_id = self.request.query_params.get("created_by")
        if created_by_id:
            qs = qs.filter(created_by__id=created_by_id)

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        search_param = self.request.query_params.get("search", "").strip()
        if search_param:
            qs = qs.filter(
                Q(created_by__first_name__icontains=search_param) |
                Q(created_by__last_name__icontains=search_param) |
                Q(department__name__icontains=search_param) |
                Q(notes__icontains=search_param)
            )

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return FicheExterneListSerializer
        return FicheExterneSerializer

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsOwnerOrReadOnly()]
        if self.action == "validate":
            return [IsAuthenticated(), CanValidateFicheExterne()]
        if self.action == "execute":
            return [IsAuthenticated(), CanExecuteFiche()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        user = self.request.user
        department = serializer.validated_data.get("department") or user.department
        serializer.save(created_by=user, department=department)

    def update(self, request: Request, *args, **kwargs) -> Response:
        instance: FicheExterne = self.get_object()
        if instance.status != FicheExterneStatus.DRAFT:
            return Response(
                {"detail": "Seules les fiches en brouillon peuvent être modifiées."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        instance: FicheExterne = self.get_object()
        if instance.status != FicheExterneStatus.DRAFT:
            return Response(
                {"detail": "Seules les fiches en brouillon peuvent être supprimées."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.created_by != request.user and not (
            request.user.role == Role.ADMIN or request.user.is_staff
        ):
            return Response(
                {"detail": "Vous ne pouvez supprimer que vos propres fiches."},
                status=status.HTTP_403_FORBIDDEN,
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def submit(self, request: Request, pk=None) -> Response:
        """Move a DRAFT fiche to PENDING_MANAGER."""
        fiche: FicheExterne = self.get_object()

        if fiche.created_by != request.user and not (
            request.user.role == Role.ADMIN or request.user.is_staff
        ):
            return Response(
                {"detail": "Seul le créateur peut soumettre cette fiche."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if fiche.status != FicheExterneStatus.DRAFT:
            return Response(
                {"detail": f"Cette fiche ne peut pas être soumise (statut actuel : {fiche.get_status_display()})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not fiche.items.exists():
            return Response(
                {"detail": "Impossible de soumettre une fiche sans articles."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fiche.status = FicheExterneStatus.PENDING_MANAGER
        fiche.save(update_fields=["status", "updated_at"])

        # Notify managers of the department
        ref = f"FE-{fiche.pk:05d}"
        managers = _dept_managers(fiche.department) if fiche.department else _users_by_role(Role.MANAGER)
        _notify(
            managers, request.user,
            f"Nouveau besoin soumis : fiche {ref} de {request.user.get_full_name() or request.user.username} attend votre avis.",
            NotificationType.SUBMITTED, FicheType.EXTERNE, fiche.pk,
        )

        return Response(
            FicheExterneSerializer(fiche, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def validate(self, request: Request, pk=None) -> Response:
        """Approve, reject, or request clarification on a FicheExterne."""
        fiche: FicheExterne = self.get_object()

        valid_statuses = list(EXTERNE_NEXT_STATUS.keys())
        if fiche.status not in valid_statuses:
            return Response(
                {"detail": "Cette fiche n'est pas dans un état qui accepte une validation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        action_serializer = ValidateActionSerializer(data=request.data)
        action_serializer.is_valid(raise_exception=True)

        act = action_serializer.validated_data["action"]
        commentaire = action_serializer.validated_data.get("commentaire", "")
        user = request.user

        if act == "request_clarification" and fiche.status == FicheExterneStatus.PENDING_MANAGER:
            return Response(
                {"detail": "La demande de clarification n'est pas disponible à cette étape."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if act == "request_clarification" and not commentaire:
            return Response(
                {"detail": "Un commentaire est requis pour demander une clarification."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if act == "approve":
            new_status = EXTERNE_NEXT_STATUS[fiche.status]
            decision = (
                ValidationStatus.FAVORABLE
                if fiche.status == FicheExterneStatus.PENDING_MANAGER
                else ValidationStatus.APPROVED
            )
        elif act == "reject":
            new_status = FicheExterneStatus.REJECTED
            decision = ValidationStatus.REJECTED
        else:  # request_clarification
            new_status = FicheExterneStatus.PENDING_CLARIFICATION_DIR
            decision = ValidationStatus.CLARIFICATION_REQUESTED

        ct = ContentType.objects.get_for_model(FicheExterne)
        Validation.objects.create(
            fiche_type=FicheType.EXTERNE,
            content_type=ct,
            object_id=fiche.pk,
            validator=user,
            role_at_validation=user.role,
            status=decision,
            commentaire=commentaire,
        )

        fiche.status = new_status
        fiche.save(update_fields=["status", "updated_at"])

        ref = f"FE-{fiche.pk:05d}"
        if act == "approve":
            if new_status == FicheExterneStatus.PENDING_DIRECTOR:
                _notify(
                    _users_by_role(Role.DIRECTOR), user,
                    f"La fiche {ref} a reçu un avis favorable et attend votre accord pour exécution.",
                    NotificationType.FAVORABLE, FicheType.EXTERNE, fiche.pk,
                )
            elif new_status == FicheExterneStatus.APPROVED:
                _notify(
                    [fiche.created_by], user,
                    f"Votre fiche {ref} a reçu l'accord du DG et est prête pour l'exécution.",
                    NotificationType.APPROVED, FicheType.EXTERNE, fiche.pk,
                )
        elif act == "reject":
            _notify(
                [fiche.created_by], user,
                f"Votre fiche {ref} a été rejetée. Motif : {commentaire or '—'}",
                NotificationType.REJECTED, FicheType.EXTERNE, fiche.pk,
            )
        else:
            managers = _dept_managers(fiche.department)
            _notify(
                managers, user,
                f"Une clarification est demandée pour la fiche {ref} : {commentaire}",
                NotificationType.CLARIFICATION_REQUEST, FicheType.EXTERNE, fiche.pk,
            )

        return Response(
            FicheExterneSerializer(fiche, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="respond_clarification")
    def respond_clarification(self, request: Request, pk=None) -> Response:
        """Manager responds to a clarification request on a FicheExterne."""
        fiche: FicheExterne = self.get_object()
        user = request.user

        if not (user.role == Role.MANAGER or user.role == Role.ADMIN or user.is_staff):
            return Response(
                {"detail": "Seul le Supérieur Hiérarchique peut répondre aux demandes de clarification."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if fiche.status != FicheExterneStatus.PENDING_CLARIFICATION_DIR:
            return Response(
                {"detail": "Cette fiche n'est pas en attente de clarification."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RespondClarificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        commentaire = serializer.validated_data["commentaire"]

        ct = ContentType.objects.get_for_model(FicheExterne)
        Validation.objects.create(
            fiche_type=FicheType.EXTERNE,
            content_type=ct,
            object_id=fiche.pk,
            validator=user,
            role_at_validation=user.role,
            status=ValidationStatus.CLARIFICATION_RESPONDED,
            commentaire=commentaire,
        )

        fiche.status = FicheExterneStatus.PENDING_DIRECTOR
        fiche.save(update_fields=["status", "updated_at"])

        _notify(
            _users_by_role(Role.DIRECTOR, Role.DAF), user,
            f"Clarification fournie pour la fiche FE-{fiche.pk:05d}. Elle est de nouveau en attente de validation DG.",
            NotificationType.CLARIFICATION_RESPONSE, FicheType.EXTERNE, fiche.pk,
        )

        return Response(
            FicheExterneSerializer(fiche, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"])
    def validations(self, request: Request, pk=None) -> Response:
        """Return the validation history for this fiche."""
        fiche: FicheExterne = self.get_object()
        ct = ContentType.objects.get_for_model(FicheExterne)
        qs = Validation.objects.filter(
            content_type=ct, object_id=fiche.pk
        ).select_related("validator")
        serializer = ValidationSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def execute(self, request: Request, pk=None) -> Response:
        """Comptabilité (DAF) marque la fiche comme exécutée — crée automatiquement un Bon de Paiement."""
        fiche: FicheExterne = self.get_object()

        if fiche.status != FicheExterneStatus.APPROVED:
            return Response(
                {"detail": "Seules les fiches approuvées peuvent être exécutées."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fiche.status = FicheExterneStatus.IN_EXECUTION
        fiche.executed_by = request.user
        fiche.executed_at = timezone.now()
        fiche.execution_fournisseur = request.data.get("execution_fournisseur", "")
        fiche.execution_reference = request.data.get("execution_reference", "")
        fiche.execution_montant = request.data.get("execution_montant") or None
        fiche.execution_mode_paiement = request.data.get("execution_mode_paiement", "")
        fiche.execution_numero_facture = request.data.get("execution_numero_facture", "")
        fiche.execution_note = request.data.get("execution_note", "")
        fiche.save(update_fields=[
            "status", "executed_by", "executed_at",
            "execution_fournisseur", "execution_reference", "execution_montant",
            "execution_mode_paiement", "execution_numero_facture", "execution_note",
            "updated_at",
        ])

        # Auto-create linked Bon de Paiement
        _create_bon_paiement(fiche, "EXTERNE", request.user, request.data)

        # Notify the fiche creator
        ref = f"FE-{fiche.pk:05d}"
        _notify(
            [fiche.created_by], request.user,
            f"Votre fiche {ref} est en cours d'exécution par la comptabilité.",
            NotificationType.IN_EXECUTION, FicheType.EXTERNE, fiche.pk,
        )

        return Response(
            FicheExterneSerializer(fiche, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="mark_received")
    def mark_received(self, request: Request, pk=None) -> Response:
        """Le demandeur confirme la réception."""
        fiche: FicheExterne = self.get_object()

        if fiche.status != FicheExterneStatus.IN_EXECUTION:
            return Response(
                {"detail": "La fiche doit être en cours d'exécution pour marquer la réception."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if fiche.created_by != request.user and not (
            request.user.role == Role.ADMIN or request.user.is_staff
        ):
            return Response(
                {"detail": "Seul le demandeur peut confirmer la réception."},
                status=status.HTTP_403_FORBIDDEN,
            )

        fiche.status = FicheExterneStatus.DELIVERED
        fiche.received_at = timezone.now()
        fiche.save(update_fields=["status", "received_at", "updated_at"])

        ref = f"FE-{fiche.pk:05d}"
        _notify(
            _users_by_role(Role.DAF, Role.DIRECTOR), request.user,
            f"La fiche {ref} a été réceptionnée par le demandeur.",
            NotificationType.DELIVERED, FicheType.EXTERNE, fiche.pk,
        )

        return Response(
            FicheExterneSerializer(fiche, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

class NotificationViewSet(viewsets.ViewSet):
    """
    GET  /api/notifications/              → list last 50 notifications (+ unread count)
    POST /api/notifications/mark_all_read/ → mark all as read
    POST /api/notifications/{id}/mark_read/ → mark one as read
    """

    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        user = request.user
        # ADMIN and DIRECTOR see ALL notifications system-wide
        if user.role in (Role.ADMIN, Role.DIRECTOR):
            qs = Notification.objects.all().select_related("sender", "recipient").order_by("-created_at")
        else:
            qs = Notification.objects.filter(recipient=user).select_related("sender").order_by("-created_at")

        # Filters
        is_read = request.query_params.get("is_read")
        notif_type = request.query_params.get("notification_type")
        fiche_type = request.query_params.get("fiche_type")
        if is_read == "true":
            qs = qs.filter(is_read=True)
        elif is_read == "false":
            qs = qs.filter(is_read=False)
        if notif_type:
            qs = qs.filter(notification_type=notif_type)
        if fiche_type:
            qs = qs.filter(fiche_type=fiche_type)

        # Unread count is always personal
        unread_count = Notification.objects.filter(
            recipient=user, is_read=False
        ).count()
        total_count = qs.count()

        # Pagination
        page_size = int(request.query_params.get("page_size", 20))
        page = int(request.query_params.get("page", 1))
        offset = (page - 1) * page_size
        page_qs = qs[offset: offset + page_size]

        serializer = NotificationSerializer(page_qs, many=True)
        return Response({
            "results": serializer.data,
            "unread_count": unread_count,
            "count": total_count,
            "page": page,
            "page_size": page_size,
            "num_pages": max(1, (total_count + page_size - 1) // page_size),
        })

    @action(detail=False, methods=["post"], url_path="mark_all_read")
    def mark_all_read(self, request: Request) -> Response:
        Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True)
        return Response({"detail": "Toutes les notifications ont été marquées comme lues."})

    @action(detail=True, methods=["post"], url_path="mark_read")
    def mark_read(self, request: Request, pk=None) -> Response:
        notif = get_object_or_404(Notification, pk=pk, recipient=request.user)
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return Response({"detail": "Notification marquée comme lue."})


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class DashboardView(APIView):
    """
    GET /api/dashboard/stats/

    Returns:
      - counts_interne : FicheInterne counts per status
      - counts_externe : FicheExterne counts per status
      - pending_for_me : fiches waiting for the current user's role
      - total_fiches   : combined totals
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        user = request.user

        # ------------------------------------------------------------------
        # Build base querysets filtered by role (same logic as viewsets)
        # ------------------------------------------------------------------
        if user.role == Role.EMPLOYEE:
            fi_qs = FicheInterne.objects.filter(created_by=user)
            fe_qs = FicheExterne.objects.filter(created_by=user)
        elif user.role == Role.MANAGER:
            if user.department:
                fi_qs = FicheInterne.objects.filter(department=user.department)
                fe_qs = FicheExterne.objects.filter(department=user.department)
            else:
                fi_qs = FicheInterne.objects.filter(created_by=user)
                fe_qs = FicheExterne.objects.filter(created_by=user)
        else:
            fi_qs = FicheInterne.objects.all()
            fe_qs = FicheExterne.objects.all()

        # ------------------------------------------------------------------
        # Status counts
        # ------------------------------------------------------------------
        def status_counts(qs, status_class):
            counts = {s.value: 0 for s in status_class}
            for row in qs.values("status").annotate(cnt=Count("id")):
                counts[row["status"]] = row["cnt"]
            return counts

        counts_interne = status_counts(fi_qs, FicheInterneStatus)
        counts_externe = status_counts(fe_qs, FicheExterneStatus)

        # ------------------------------------------------------------------
        # Fiches pending for the current user's role
        # ------------------------------------------------------------------
        role = user.role
        pending_interne_status = {
            Role.MANAGER:  FicheInterneStatus.PENDING_MANAGER,
            Role.DAF:      FicheInterneStatus.PENDING_DAF,
            Role.DIRECTOR: FicheInterneStatus.PENDING_DIRECTOR,
        }.get(role)

        pending_externe_status = {
            Role.MANAGER:  FicheExterneStatus.PENDING_MANAGER,
            Role.DIRECTOR: FicheExterneStatus.PENDING_DIRECTOR,
        }.get(role)

        pending_interne_count = (
            FicheInterne.objects.filter(status=pending_interne_status).count()
            if pending_interne_status else 0
        )
        pending_externe_count = (
            FicheExterne.objects.filter(status=pending_externe_status).count()
            if pending_externe_status else 0
        )

        # ------------------------------------------------------------------
        # Recent fiches (last 8, combined interne + externe)
        # ------------------------------------------------------------------
        def extract_recent(qs, fiche_type):
            rows = list(
                qs.select_related("created_by", "department")
                .order_by("-created_at")[:8]
                .values(
                    "id", "status", "created_at",
                    "created_by__first_name", "created_by__last_name",
                    "department__name",
                )
            )
            for r in rows:
                fn = r.pop("created_by__first_name") or ""
                ln = r.pop("created_by__last_name") or ""
                r["created_by_name"] = f"{fn} {ln}".strip() or "—"
                r["department_name"] = r.pop("department__name") or "—"
                r["type"] = fiche_type
                r["created_at"] = r["created_at"].isoformat() if r["created_at"] else None
            return rows

        recent_internes = extract_recent(fi_qs, "interne")
        recent_externes = extract_recent(fe_qs, "externe")
        recent_fiches = sorted(
            recent_internes + recent_externes,
            key=lambda x: x["created_at"] or "",
            reverse=True,
        )[:8]

        # ------------------------------------------------------------------
        # Monthly stats — last 6 months
        # ------------------------------------------------------------------
        today = date.today()
        months = []
        for i in range(5, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            months.append(f"{y:04d}-{m:02d}")

        def monthly_counts(qs):
            return {
                row["month"].strftime("%Y-%m"): row["count"]
                for row in (
                    qs.annotate(month=TruncMonth("created_at"))
                    .values("month")
                    .annotate(count=Count("id"))
                    .filter(month__isnull=False)
                    .order_by("month")
                )
            }

        mi = monthly_counts(fi_qs)
        me = monthly_counts(fe_qs)
        monthly_stats = [
            {"month": m, "internes": mi.get(m, 0), "externes": me.get(m, 0)}
            for m in months
        ]

        total_internes = fi_qs.count()
        total_externes = fe_qs.count()

        return Response(
            {
                "counts_interne": counts_interne,
                "counts_externe": counts_externe,
                "pending_for_me": {
                    "fiches_internes": pending_interne_count,
                    "fiches_externes": pending_externe_count,
                    "total": pending_interne_count + pending_externe_count,
                },
                "total_fiches": {
                    "internes": total_internes,
                    "externes": total_externes,
                    "combined": total_internes + total_externes,
                },
                "recent_fiches": recent_fiches,
                "monthly_stats": monthly_stats,
            }
        )
