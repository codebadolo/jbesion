"""
ViewSet for the Bons de Paiement API.

Endpoints:
  GET    /api/bons-paiement/          → list
  POST   /api/bons-paiement/          → create  (comptables only)
  GET    /api/bons-paiement/{id}/     → retrieve
  PUT    /api/bons-paiement/{id}/     → update  (comptables only)
  PATCH  /api/bons-paiement/{id}/     → partial update (comptables only)
  DELETE /api/bons-paiement/{id}/     → destroy (comptables only)
  POST   /api/bons-paiement/{id}/validate/  → mark as VALIDATED
  POST   /api/bons-paiement/{id}/cancel/    → mark as CANCELLED
"""

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role, User
from apps.fiches.models import Notification, NotificationType
from .models import BonPaiement, BonPaiementStatus
from .permissions import CanManageBonPaiement
from .serializers import BonPaiementSerializer, BonPaiementListSerializer


def _bp_notify(bon, sender, notif_type, message):
    """Notify ADMIN, DIRECTOR and DAF about a Bon de Paiement event."""
    recipients = list(User.objects.filter(
        role__in=[Role.ADMIN, Role.DIRECTOR, Role.DAF], is_active=True
    ))
    for user in recipients:
        if user != sender:
            Notification.objects.create(
                recipient=user,
                sender=sender,
                message=message,
                notification_type=notif_type,
                fiche_type=bon.fiche_type or "",
                fiche_id=bon.fiche_id,
            )


class BonPaiementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CanManageBonPaiement]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["numero", "beneficiaire", "motif"]
    ordering_fields = ["created_at", "date", "montant", "numero"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = BonPaiement.objects.select_related("created_by").prefetch_related("items").order_by("-created_at")
        status_filter = self.request.query_params.get("status")
        mode_filter   = self.request.query_params.get("mode_paiement")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if mode_filter:
            qs = qs.filter(mode_paiement=mode_filter)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return BonPaiementListSerializer
        return BonPaiementSerializer

    def perform_create(self, serializer):
        bon = serializer.save(created_by=self.request.user)
        _bp_notify(
            bon, self.request.user,
            NotificationType.BON_EMIS,
            f"Bon de paiement {bon.numero} émis par {self.request.user.get_full_name() or self.request.user.username}"
            + (f" — Bénéficiaire : {bon.beneficiaire}" if bon.beneficiaire else ""),
        )

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        bon = self.get_object()
        if bon.status != BonPaiementStatus.DRAFT:
            return Response(
                {"detail": "Seuls les bons en brouillon peuvent être validés."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        bon.status = BonPaiementStatus.VALIDATED
        bon.save(update_fields=["status", "updated_at"])
        _bp_notify(
            bon, request.user,
            NotificationType.BON_VALIDE,
            f"Bon de paiement {bon.numero} validé — Bénéficiaire : {bon.beneficiaire}",
        )
        return Response(BonPaiementSerializer(bon, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        bon = self.get_object()
        if bon.status == BonPaiementStatus.CANCELLED:
            return Response(
                {"detail": "Ce bon est déjà annulé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        bon.status = BonPaiementStatus.CANCELLED
        bon.save(update_fields=["status", "updated_at"])
        _bp_notify(
            bon, request.user,
            NotificationType.BON_ANNULE,
            f"Bon de paiement {bon.numero} annulé.",
        )
        return Response(BonPaiementSerializer(bon, context={"request": request}).data)
