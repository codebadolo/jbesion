from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from .models import BonPaiement, BonPaiementItem


class BonPaiementItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BonPaiementItem
        fields = ["id", "designation", "montant"]


class BonPaiementSerializer(serializers.ModelSerializer):
    items = BonPaiementItemSerializer(many=True)
    created_by_detail = UserSerializer(source="created_by", read_only=True)

    class Meta:
        model = BonPaiement
        fields = [
            "id",
            "numero",
            "date",
            "beneficiaire",
            "motif",
            "mode_paiement",
            "montant",
            "montant_lettres",
            "notes",
            "fiche_type",
            "fiche_id",
            "status",
            "items",
            "created_by",
            "created_by_detail",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "numero", "created_by", "created_by_detail", "created_at", "updated_at"]

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        bon = BonPaiement.objects.create(**validated_data)
        for item in items_data:
            BonPaiementItem.objects.create(bon=bon, **item)
        return bon

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                BonPaiementItem.objects.create(bon=instance, **item)

        return instance


class BonPaiementListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    created_by_detail = UserSerializer(source="created_by", read_only=True)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = BonPaiement
        fields = [
            "id",
            "numero",
            "date",
            "beneficiaire",
            "motif",
            "mode_paiement",
            "montant",
            "status",
            "items_count",
            "created_by_detail",
            "created_at",
        ]

    def get_items_count(self, obj):
        return obj.items.count()
