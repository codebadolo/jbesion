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
from .models import (
    FicheInterne,
    FicheInterneItem,
    FicheExterne,
    FicheExterneItem,
    Validation,
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
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "date_creation",
            "status",
            "created_at",
            "updated_at",
        ]

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
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "date_creation",
            "status",
            "created_at",
            "updated_at",
        ]

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
        "action": "approve" | "reject",
        "commentaire": "optional comment"
      }
    """

    ACTION_CHOICES = [("approve", "Approuver"), ("reject", "Rejeter")]

    action = serializers.ChoiceField(choices=ACTION_CHOICES)
    commentaire = serializers.CharField(required=False, allow_blank=True, default="")
