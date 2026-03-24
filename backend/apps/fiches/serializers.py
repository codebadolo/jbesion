"""
Serializers for the fiches app.

Each fiche serializer:
  - Returns nested items on read (GET)
  - Accepts a list of items on write (POST / PUT / PATCH)
  - Handles create / update of nested items atomically

Also includes a ValidationSerializer for the audit-trail records.
"""

from django.contrib.contenttypes.models import ContentType
from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from apps.departments.serializers import DepartmentShortSerializer
from apps.bons_paiement.models import BonPaiement
from .models import (
    FicheInterne,
    FicheInterneItem,
    FicheExterne,
    FicheExterneItem,
    Validation,
    Notification,
    FicheType,
    ValidationStatus,
)


# ---------------------------------------------------------------------------
# Item serializers
# ---------------------------------------------------------------------------

class FicheInterneItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FicheInterneItem
        fields = ["id", "designation", "quantity", "date_requise", "montant"]


class FicheExterneItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FicheExterneItem
        fields = [
            "id",
            "designation",
            "quantity",
            "affectation",
            "date_requise",
            "montant_prestataire",
            "montant_client",
        ]


# ---------------------------------------------------------------------------
# FicheInterne serializers
# ---------------------------------------------------------------------------

class FicheInterneSerializer(serializers.ModelSerializer):
    """
    Full FicheInterne representation.

    Read  : items are returned as nested objects.
    Write : items list is accepted and saved atomically.
    """

    items = FicheInterneItemSerializer(many=True)
    created_by_detail = UserSerializer(source="created_by", read_only=True)
    department_detail = DepartmentShortSerializer(source="department", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    executed_by_detail = UserSerializer(source="executed_by", read_only=True)
    validation_history = serializers.SerializerMethodField()
    bon_paiement_id = serializers.SerializerMethodField()
    bon_paiement_numero = serializers.SerializerMethodField()

    def get_bon_paiement_id(self, obj):
        bp = BonPaiement.objects.filter(fiche_type="INTERNE", fiche_id=obj.pk).first()
        return bp.pk if bp else None

    def get_bon_paiement_numero(self, obj):
        bp = BonPaiement.objects.filter(fiche_type="INTERNE", fiche_id=obj.pk).first()
        return bp.numero if bp else None

    def get_validation_history(self, obj):
        ct = ContentType.objects.get_for_model(FicheInterne)
        qs = Validation.objects.filter(
            content_type=ct, object_id=obj.pk
        ).select_related("validator").order_by("date_validation")
        return ValidationSerializer(qs, many=True).data

    class Meta:
        model = FicheInterne
        fields = [
            "id",
            "created_by",
            "created_by_detail",
            "department",
            "department_detail",
            "date_creation",
            "status",
            "status_display",
            "notes",
            "items",
            "executed_by",
            "executed_by_detail",
            "executed_at",
            "execution_fournisseur",
            "execution_reference",
            "execution_montant",
            "execution_mode_paiement",
            "execution_numero_facture",
            "execution_note",
            "received_at",
            "created_at",
            "updated_at",
            "validation_history",
            "bon_paiement_id",
            "bon_paiement_numero",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "date_creation",
            "status",
            "executed_by",
            "executed_at",
            "received_at",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "department": {"required": False, "allow_null": True},
        }

    def _save_items(self, fiche: FicheInterne, items_data: list) -> None:
        """Delete old items and recreate from provided data."""
        fiche.items.all().delete()
        for item_data in items_data:
            FicheInterneItem.objects.create(fiche=fiche, **item_data)

    def create(self, validated_data: dict) -> FicheInterne:
        items_data = validated_data.pop("items", [])
        # created_by is injected by the view via perform_create
        fiche = FicheInterne.objects.create(**validated_data)
        self._save_items(fiche, items_data)
        return fiche

    def update(self, instance: FicheInterne, validated_data: dict) -> FicheInterne:
        items_data = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            self._save_items(instance, items_data)
        return instance


class FicheInterneListSerializer(serializers.ModelSerializer):
    """Lightweight serializer used for list views to reduce payload size."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    department_detail = DepartmentShortSerializer(source="department", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = FicheInterne
        fields = [
            "id",
            "created_by",
            "created_by_name",
            "department",
            "department_detail",
            "date_creation",
            "status",
            "status_display",
            "item_count",
            "created_at",
            "updated_at",
        ]

    def get_created_by_name(self, obj: FicheInterne) -> str:
        return str(obj.created_by)

    def get_item_count(self, obj: FicheInterne) -> int:
        return obj.items.count()


# ---------------------------------------------------------------------------
# FicheExterne serializers
# ---------------------------------------------------------------------------

class FicheExterneSerializer(serializers.ModelSerializer):
    """Full FicheExterne representation with nested items (read/write)."""

    items = FicheExterneItemSerializer(many=True)
    created_by_detail = UserSerializer(source="created_by", read_only=True)
    department_detail = DepartmentShortSerializer(source="department", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    executed_by_detail = UserSerializer(source="executed_by", read_only=True)
    validation_history = serializers.SerializerMethodField()
    bon_paiement_id = serializers.SerializerMethodField()
    bon_paiement_numero = serializers.SerializerMethodField()

    def get_bon_paiement_id(self, obj):
        bp = BonPaiement.objects.filter(fiche_type="EXTERNE", fiche_id=obj.pk).first()
        return bp.pk if bp else None

    def get_bon_paiement_numero(self, obj):
        bp = BonPaiement.objects.filter(fiche_type="EXTERNE", fiche_id=obj.pk).first()
        return bp.numero if bp else None

    def get_validation_history(self, obj):
        ct = ContentType.objects.get_for_model(FicheExterne)
        qs = Validation.objects.filter(
            content_type=ct, object_id=obj.pk
        ).select_related("validator").order_by("date_validation")
        return ValidationSerializer(qs, many=True).data

    class Meta:
        model = FicheExterne
        fields = [
            "id",
            "created_by",
            "created_by_detail",
            "department",
            "department_detail",
            "date_creation",
            "status",
            "status_display",
            "notes",
            "items",
            "executed_by",
            "executed_by_detail",
            "executed_at",
            "execution_fournisseur",
            "execution_reference",
            "execution_montant",
            "execution_mode_paiement",
            "execution_numero_facture",
            "execution_note",
            "received_at",
            "created_at",
            "updated_at",
            "validation_history",
            "bon_paiement_id",
            "bon_paiement_numero",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "date_creation",
            "status",
            "executed_by",
            "executed_at",
            "received_at",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "department": {"required": False, "allow_null": True},
        }

    def _save_items(self, fiche: FicheExterne, items_data: list) -> None:
        fiche.items.all().delete()
        for item_data in items_data:
            FicheExterneItem.objects.create(fiche=fiche, **item_data)

    def create(self, validated_data: dict) -> FicheExterne:
        items_data = validated_data.pop("items", [])
        fiche = FicheExterne.objects.create(**validated_data)
        self._save_items(fiche, items_data)
        return fiche

    def update(self, instance: FicheExterne, validated_data: dict) -> FicheExterne:
        items_data = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            self._save_items(instance, items_data)
        return instance


class FicheExterneListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    department_detail = DepartmentShortSerializer(source="department", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = FicheExterne
        fields = [
            "id",
            "created_by",
            "created_by_name",
            "department",
            "department_detail",
            "date_creation",
            "status",
            "status_display",
            "item_count",
            "created_at",
            "updated_at",
        ]

    def get_created_by_name(self, obj: FicheExterne) -> str:
        return str(obj.created_by)

    def get_item_count(self, obj: FicheExterne) -> int:
        return obj.items.count()


# ---------------------------------------------------------------------------
# Validation serializer
# ---------------------------------------------------------------------------

class ValidationSerializer(serializers.ModelSerializer):
    """Serializer for Validation audit records (read-only output)."""

    validator_detail = UserSerializer(source="validator", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    fiche_type_display = serializers.CharField(source="get_fiche_type_display", read_only=True)

    class Meta:
        model = Validation
        fields = [
            "id",
            "fiche_type",
            "fiche_type_display",
            "object_id",
            "validator",
            "validator_detail",
            "role_at_validation",
            "status",
            "status_display",
            "date_validation",
            "commentaire",
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Validate action input serializer
# ---------------------------------------------------------------------------

class ValidateActionSerializer(serializers.Serializer):
    """
    Validates the request body for the /validate/ action.

    Expected payload:
      {
        "action": "approve" | "reject" | "request_clarification",
        "commentaire": "optional comment (required for reject / request_clarification)"
      }
    """

    ACTION_CHOICES = [
        ("approve", "Approuver"),
        ("reject", "Rejeter"),
        ("request_clarification", "Demander clarification"),
    ]

    action = serializers.ChoiceField(choices=ACTION_CHOICES)
    commentaire = serializers.CharField(required=False, allow_blank=True, default="")


class RespondClarificationSerializer(serializers.Serializer):
    """
    Validates the request body for the /respond_clarification/ action.

    Expected payload:
      { "commentaire": "the manager's response" }
    """
    commentaire = serializers.CharField(required=True, allow_blank=False)


class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id", "message", "is_read", "notification_type",
            "fiche_type", "fiche_id", "created_at", "sender_name",
        ]
        read_only_fields = fields

    def get_sender_name(self, obj):
        if obj.sender:
            name = f"{obj.sender.first_name} {obj.sender.last_name}".strip()
            return name or obj.sender.email
        return "Système"
