"""
Views pour les Bons de Commande.

Endpoints:
  GET/POST   /api/bons-commande/
  GET/PUT/PATCH/DELETE /api/bons-commande/{id}/
  POST /api/bons-commande/{id}/soumettre-daf/   → DRAFT → PENDING_PROFORMA
  POST /api/bons-commande/{id}/approuver-daf/   → PENDING_DAF → PENDING_DG
  POST /api/bons-commande/{id}/rejeter-daf/     → PENDING_DAF → REJECTED
  POST /api/bons-commande/{id}/approuver-dg/    → PENDING_DG → APPROVED
  POST /api/bons-commande/{id}/rejeter-dg/      → PENDING_DG → REJECTED
  POST /api/bons-commande/{id}/executer/        → APPROVED → IN_EXECUTION
  POST /api/bons-commande/{id}/cloturer/        → IN_EXECUTION → DONE
  POST /api/bons-commande/{id}/selectionner-fournisseur/ → choix final fournisseur

  GET/POST   /api/bons-commande/{id}/proformas/
  DELETE     /api/bons-commande/{id}/proformas/{proforma_id}/
"""

from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.fiches.models import Notification, NotificationType
from .models import BonCommande, BonCommandeStatus, FactureProforma
from .permissions import CanManageBonCommande
from .serializers import (
    BonCommandeSerializer,
    BonCommandeListSerializer,
    FactureProformaSerializer,
)


def _notify_bc(bon, sender, notif_type, message):
    """
    Notifie ADMIN, DAF, DG et le créateur du bon pour un événement de Bon de Commande.
    Envoie également un e-mail à chaque destinataire.
    """
    from apps.accounts.models import User
    from apps.fiches.emails import notify_email

    base_recipients = list(
        User.objects.filter(role__in=[Role.ADMIN, Role.DAF, Role.DIRECTOR], is_active=True)
    )
    # Toujours inclure le créateur du bon
    if bon.created_by and bon.created_by not in base_recipients:
        base_recipients.append(bon.created_by)

    recipients = [u for u in base_recipients if u != sender]

    for user in recipients:
        Notification.objects.create(
            recipient=user,
            sender=sender,
            message=message,
            notification_type=notif_type,
            fiche_type=bon.fiche_type or "",
            fiche_id=bon.fiche_id,
        )

    notify_email(
        recipients,
        subject=f"Bon de Commande {bon.numero} — {notif_type}",
        body=message,
    )


class BonCommandeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CanManageBonCommande]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["numero", "objet", "reference"]
    ordering_fields = ["created_at", "date", "numero", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = (
            BonCommande.objects.select_related(
                "created_by", "daf_approuve_par", "dg_approuve_par", "fournisseur_selectionne"
            )
            .prefetch_related("factures_proforma")
            .order_by("-created_at")
        )
        status_filter    = self.request.query_params.get("status")
        fiche_type_filter = self.request.query_params.get("fiche_type")
        fiche_id_filter   = self.request.query_params.get("fiche_id")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if fiche_type_filter:
            qs = qs.filter(fiche_type=fiche_type_filter)
        if fiche_id_filter:
            qs = qs.filter(fiche_id=fiche_id_filter)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return BonCommandeListSerializer
        return BonCommandeSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    # ── Workflow : soumission & validation proformas ──────────────────

    @action(detail=True, methods=["post"], url_path="soumettre-daf")
    def soumettre_daf(self, request, pk=None):
        """Soumettre pour collecte des proformas (DRAFT → PENDING_PROFORMA)."""
        bon = self.get_object()
        if bon.status != BonCommandeStatus.DRAFT:
            raise ValidationError("Seul un bon en brouillon peut être soumis.")
        bon.status = BonCommandeStatus.PENDING_PROFORMA
        bon.save(update_fields=["status", "updated_at"])
        _notify_bc(bon, request.user, NotificationType.SUBMITTED,
                   f"Bon de commande {bon.numero} soumis — en attente des factures proforma.")
        return Response(BonCommandeSerializer(bon, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="valider-proformas")
    def valider_proformas(self, request, pk=None):
        """
        Le DAF sélectionne le fournisseur et valide les proformas
        (PENDING_PROFORMA → PENDING_DAF).
        Body optionnel : {"fournisseur_selectionne": <id_proforma>, "commentaire": "…"}
        """
        bon = self.get_object()
        if bon.status != BonCommandeStatus.PENDING_PROFORMA:
            raise ValidationError("Le bon n'est pas en attente de validation des proformas.")
        if request.user.role not in (Role.DAF, Role.ADMIN) and not request.user.is_staff:
            raise PermissionDenied("Seul le DAF peut valider les proformas.")
        if not bon.factures_proforma.exists():
            raise ValidationError("Aucune facture proforma n'a été uploadée.")

        # Sélectionner le fournisseur si fourni
        fournisseur_id = request.data.get("fournisseur_selectionne")
        if fournisseur_id:
            try:
                proforma = FactureProforma.objects.get(pk=fournisseur_id, bon_commande=bon)
                bon.fournisseur_selectionne = proforma
            except FactureProforma.DoesNotExist:
                raise ValidationError("Facture proforma introuvable pour ce bon de commande.")
        elif not bon.fournisseur_selectionne:
            raise ValidationError(
                "Veuillez sélectionner un fournisseur avant de valider les proformas."
            )

        bon.status = BonCommandeStatus.PENDING_DAF
        bon.save(update_fields=["status", "fournisseur_selectionne", "updated_at"])
        _notify_bc(bon, request.user, NotificationType.SUBMITTED,
                   f"Proformas du bon {bon.numero} validées — en attente approbation DAF.")
        return Response(BonCommandeSerializer(bon, context={"request": request}).data)

    # ── Workflow DAF ─────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="approuver-daf")
    def approuver_daf(self, request, pk=None):
        """DAF approuve → PENDING_DG."""
        bon = self.get_object()
        if bon.status != BonCommandeStatus.PENDING_DAF:
            raise ValidationError("Ce bon n'est pas en attente d'approbation DAF.")
        if request.user.role not in (Role.DAF, Role.ADMIN) and not request.user.is_staff:
            raise PermissionDenied("Seul le DAF peut approuver à cette étape.")
        bon.status = BonCommandeStatus.PENDING_DG
        bon.daf_approuve_par = request.user
        bon.daf_approuve_le = timezone.now()
        bon.daf_commentaire = request.data.get("commentaire", "")
        bon.save(update_fields=["status", "daf_approuve_par", "daf_approuve_le", "daf_commentaire", "updated_at"])
        _notify_bc(bon, request.user, NotificationType.FAVORABLE,
                   f"Bon de commande {bon.numero} approuvé par le DAF, soumis au DG.")
        return Response(BonCommandeSerializer(bon, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="rejeter-daf")
    def rejeter_daf(self, request, pk=None):
        """DAF rejette."""
        bon = self.get_object()
        if bon.status != BonCommandeStatus.PENDING_DAF:
            raise ValidationError("Ce bon n'est pas en attente d'approbation DAF.")
        if request.user.role not in (Role.DAF, Role.ADMIN) and not request.user.is_staff:
            raise PermissionDenied("Seul le DAF peut rejeter à cette étape.")
        bon.status = BonCommandeStatus.REJECTED
        bon.daf_approuve_par = request.user
        bon.daf_approuve_le = timezone.now()
        bon.daf_commentaire = request.data.get("commentaire", "")
        bon.save(update_fields=["status", "daf_approuve_par", "daf_approuve_le", "daf_commentaire", "updated_at"])
        _notify_bc(bon, request.user, NotificationType.REJECTED,
                   f"Bon de commande {bon.numero} rejeté par le DAF.")
        return Response(BonCommandeSerializer(bon, context={"request": request}).data)

    # ── Workflow DG ──────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="approuver-dg")
    def approuver_dg(self, request, pk=None):
        """DG approuve pour exécution → APPROVED."""
        bon = self.get_object()
        if bon.status != BonCommandeStatus.PENDING_DG:
            raise ValidationError("Ce bon n'est pas en attente d'approbation DG.")
        if request.user.role not in (Role.DIRECTOR, Role.ADMIN) and not request.user.is_staff:
            raise PermissionDenied("Seul le DG peut approuver à cette étape.")
        bon.status = BonCommandeStatus.APPROVED
        bon.dg_approuve_par = request.user
        bon.dg_approuve_le = timezone.now()
        bon.dg_commentaire = request.data.get("commentaire", "")
        # Fournisseur sélectionné (optionnel à cette étape)
        fournisseur_id = request.data.get("fournisseur_selectionne")
        if fournisseur_id:
            try:
                proforma = FactureProforma.objects.get(pk=fournisseur_id, bon_commande=bon)
                bon.fournisseur_selectionne = proforma
            except FactureProforma.DoesNotExist:
                raise ValidationError("Facture proforma introuvable pour ce bon de commande.")
        bon.save(update_fields=[
            "status", "dg_approuve_par", "dg_approuve_le", "dg_commentaire",
            "fournisseur_selectionne", "updated_at"
        ])
        _notify_bc(bon, request.user, NotificationType.APPROVED,
                   f"Bon de commande {bon.numero} approuvé par le DG pour exécution.")
        return Response(BonCommandeSerializer(bon, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="rejeter-dg")
    def rejeter_dg(self, request, pk=None):
        """DG rejette."""
        bon = self.get_object()
        if bon.status != BonCommandeStatus.PENDING_DG:
            raise ValidationError("Ce bon n'est pas en attente d'approbation DG.")
        if request.user.role not in (Role.DIRECTOR, Role.ADMIN) and not request.user.is_staff:
            raise PermissionDenied("Seul le DG peut rejeter à cette étape.")
        bon.status = BonCommandeStatus.REJECTED
        bon.dg_approuve_par = request.user
        bon.dg_approuve_le = timezone.now()
        bon.dg_commentaire = request.data.get("commentaire", "")
        bon.save(update_fields=["status", "dg_approuve_par", "dg_approuve_le", "dg_commentaire", "updated_at"])
        _notify_bc(bon, request.user, NotificationType.REJECTED,
                   f"Bon de commande {bon.numero} rejeté par le DG.")
        return Response(BonCommandeSerializer(bon, context={"request": request}).data)

    # ── Exécution ────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="executer")
    def executer(self, request, pk=None):
        """Passer en exécution (APPROVED → IN_EXECUTION)."""
        bon = self.get_object()
        if bon.status != BonCommandeStatus.APPROVED:
            raise ValidationError("Seul un bon approuvé peut être mis en exécution.")
        bon.status = BonCommandeStatus.IN_EXECUTION
        bon.save(update_fields=["status", "updated_at"])
        _notify_bc(bon, request.user, NotificationType.IN_EXECUTION,
                   f"Bon de commande {bon.numero} en cours d'exécution.")
        return Response(BonCommandeSerializer(bon, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="cloturer")
    def cloturer(self, request, pk=None):
        """Clôturer (IN_EXECUTION → DONE)."""
        bon = self.get_object()
        if bon.status != BonCommandeStatus.IN_EXECUTION:
            raise ValidationError("Seul un bon en cours d'exécution peut être clôturé.")
        bon.status = BonCommandeStatus.DONE
        bon.save(update_fields=["status", "updated_at"])
        _notify_bc(bon, request.user, NotificationType.DELIVERED,
                   f"Bon de commande {bon.numero} clôturé.")
        return Response(BonCommandeSerializer(bon, context={"request": request}).data)

    # ── Sélection fournisseur ────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="selectionner-fournisseur")
    def selectionner_fournisseur(self, request, pk=None):
        """
        Le DAF ou DG sélectionne la facture proforma du fournisseur retenu.
        Body: {"fournisseur_selectionne": <id_proforma>}
        """
        bon = self.get_object()
        if request.user.role not in (Role.DAF, Role.DIRECTOR, Role.ADMIN) and not request.user.is_staff:
            raise PermissionDenied("Seul le DAF ou le DG peut sélectionner le fournisseur.")
        fournisseur_id = request.data.get("fournisseur_selectionne")
        if not fournisseur_id:
            raise ValidationError({"fournisseur_selectionne": "Ce champ est requis."})
        try:
            proforma = FactureProforma.objects.get(pk=fournisseur_id, bon_commande=bon)
        except FactureProforma.DoesNotExist:
            raise ValidationError("Facture proforma introuvable pour ce bon de commande.")
        bon.fournisseur_selectionne = proforma
        bon.save(update_fields=["fournisseur_selectionne", "updated_at"])
        return Response(BonCommandeSerializer(bon, context={"request": request}).data)

    # ── Gestion des factures proforma ────────────────────────────────

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="proformas",
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def proformas(self, request, pk=None):
        """
        GET  : lister toutes les proformas de ce bon
        POST : uploader une nouvelle proforma (multipart/form-data)
        """
        bon = self.get_object()

        if request.method == "GET":
            qs = bon.factures_proforma.all().order_by("uploaded_at")
            serializer = FactureProformaSerializer(qs, many=True, context={"request": request})
            return Response(serializer.data)

        # POST : upload — réservé aux comptables, DAF et ADMIN
        # L'upload est possible en DRAFT et PENDING_PROFORMA
        if request.method == "POST":
            user = request.user
            can_upload = (
                user.is_comptable
                or user.role in (Role.DAF, Role.ADMIN)
                or user.is_staff
                or (user.department and user.department.code == "AF")
            )
            if not can_upload:
                from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
                raise DRFPermissionDenied("Seuls les comptables ou le DAF peuvent uploader des proformas.")
            if bon.status not in (BonCommandeStatus.DRAFT, BonCommandeStatus.PENDING_PROFORMA):
                raise ValidationError(
                    "Les proformas ne peuvent être uploadées qu'en statut Brouillon "
                    "ou En attente des proformas."
                )

        data = request.data.copy()
        data["bon_commande"] = bon.pk
        serializer = FactureProformaSerializer(data=data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(bon_commande=bon, uploaded_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"proformas/(?P<proforma_pk>[0-9]+)",
    )
    def supprimer_proforma(self, request, pk=None, proforma_pk=None):
        """Supprimer une facture proforma."""
        bon = self.get_object()
        try:
            proforma = FactureProforma.objects.get(pk=proforma_pk, bon_commande=bon)
        except FactureProforma.DoesNotExist:
            return Response({"detail": "Introuvable."}, status=status.HTTP_404_NOT_FOUND)
        # Si c'est le fournisseur sélectionné, on efface la sélection
        if bon.fournisseur_selectionne_id == proforma.pk:
            bon.fournisseur_selectionne = None
            bon.save(update_fields=["fournisseur_selectionne", "updated_at"])
        proforma.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
