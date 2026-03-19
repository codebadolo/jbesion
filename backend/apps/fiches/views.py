"""
ViewSets for the fiches app.

FicheInterneViewSet  — CRUD + submit + validate + validations list
FicheExterneViewSet  — same structure, different workflow
DashboardView        — aggregated statistics
"""

from django.contrib.contenttypes.models import ContentType
from django.db.models import QuerySet, Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role
from .models import (
    FicheInterne,
    FicheInterneStatus,
    FicheExterne,
    FicheExterneStatus,
    Validation,
    FicheType,
    ValidationStatus,
)
from .permissions import (
    IsOwnerOrReadOnly,
    CanValidateFicheInterne,
    CanValidateFicheExterne,
)
from .serializers import (
    FicheInterneSerializer,
    FicheInterneListSerializer,
    FicheExterneSerializer,
    FicheExterneListSerializer,
    ValidateActionSerializer,
    ValidationSerializer,
)


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

    def get_queryset(self) -> QuerySet:
        user = self.request.user
        qs = FicheInterne.objects.select_related(
            "created_by", "department"
        ).prefetch_related("items")

        if user.role == Role.EMPLOYEE:
            return qs.filter(created_by=user)

        if user.role == Role.MANAGER:
            # Own fiches + fiches of direct subordinates
            subordinate_ids = user.subordinates.values_list("id", flat=True)
            return qs.filter(
                Q(created_by=user) | Q(created_by__in=subordinate_ids)
            )

        # DAF, DIRECTOR, ADMIN see everything
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
        Approve or reject a fiche.

        Body: { "action": "approve"|"reject", "commentaire": "..." }

        On approval the status advances to the next step.
        On rejection the status moves to REJECTED.
        """
        fiche: FicheInterne = self.get_object()

        # Permission check (also done by CanValidateFicheInterne)
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

        # Determine new status
        if act == "approve":
            new_status = INTERNE_NEXT_STATUS[fiche.status]
            decision = ValidationStatus.APPROVED
        else:
            new_status = FicheInterneStatus.REJECTED
            decision = ValidationStatus.REJECTED

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

    def get_queryset(self) -> QuerySet:
        user = self.request.user
        qs = FicheExterne.objects.select_related(
            "created_by", "department"
        ).prefetch_related("items")

        if user.role == Role.EMPLOYEE:
            return qs.filter(created_by=user)

        if user.role == Role.MANAGER:
            subordinate_ids = user.subordinates.values_list("id", flat=True)
            return qs.filter(
                Q(created_by=user) | Q(created_by__in=subordinate_ids)
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
        return Response(
            FicheExterneSerializer(fiche, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def validate(self, request: Request, pk=None) -> Response:
        """Approve or reject a FicheExterne."""
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

        if act == "approve":
            new_status = EXTERNE_NEXT_STATUS[fiche.status]
            decision = ValidationStatus.APPROVED
        else:
            new_status = FicheExterneStatus.REJECTED
            decision = ValidationStatus.REJECTED

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
            sub_ids = user.subordinates.values_list("id", flat=True)
            fi_qs = FicheInterne.objects.filter(
                Q(created_by=user) | Q(created_by__in=sub_ids)
            )
            fe_qs = FicheExterne.objects.filter(
                Q(created_by=user) | Q(created_by__in=sub_ids)
            )
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
                    "internes": fi_qs.count(),
                    "externes": fe_qs.count(),
                    "combined": fi_qs.count() + fe_qs.count(),
                },
            }
        )
