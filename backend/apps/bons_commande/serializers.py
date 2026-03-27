"""
Serializers pour les Bons de Commande et Factures Proforma.
"""

from rest_framework import serializers
from apps.accounts.serializers import UserSerializer
from .models import BonCommande, FactureProforma


class FactureProformaSerializer(serializers.ModelSerializer):
    uploaded_by_detail = UserSerializer(source="uploaded_by", read_only=True)
    is_selected = serializers.SerializerMethodField()

    class Meta:
        model = FactureProforma
        fields = [
            "id",
            "bon_commande",
            "fournisseur_nom",
            "reference",
            "montant",
            "fichier",
            "notes",
            "uploaded_by",
            "uploaded_by_detail",
            "uploaded_at",
            "is_selected",
        ]
        read_only_fields = ["id", "uploaded_at", "bon_commande"]

    def get_is_selected(self, obj) -> bool:
        """True si cette proforma est celle sélectionnée par le DAF/DG."""
        bon = obj.bon_commande
        return bon.fournisseur_selectionne_id == obj.pk


class BonCommandeSerializer(serializers.ModelSerializer):
    factures_proforma = FactureProformaSerializer(many=True, read_only=True)
    created_by_detail = UserSerializer(source="created_by", read_only=True)
    daf_approuve_par_detail = UserSerializer(source="daf_approuve_par", read_only=True)
    dg_approuve_par_detail = UserSerializer(source="dg_approuve_par", read_only=True)
    fournisseur_selectionne_detail = FactureProformaSerializer(
        source="fournisseur_selectionne", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = BonCommande
        fields = [
            "id",
            "numero",
            "date",
            "objet",
            "reference",
            "fiche_type",
            "fiche_id",
            "status",
            "status_display",
            "daf_approuve_par",
            "daf_approuve_par_detail",
            "daf_approuve_le",
            "daf_commentaire",
            "dg_approuve_par",
            "dg_approuve_par_detail",
            "dg_approuve_le",
            "dg_commentaire",
            "fournisseur_selectionne",
            "fournisseur_selectionne_detail",
            "factures_proforma",
            "notes",
            "created_by",
            "created_by_detail",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "numero",
            "created_at",
            "updated_at",
            "daf_approuve_par",
            "daf_approuve_le",
            "dg_approuve_par",
            "dg_approuve_le",
        ]


class BonCommandeListSerializer(serializers.ModelSerializer):
    """Serializer allégé pour les listes."""
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    nb_proformas = serializers.SerializerMethodField()
    created_by_detail = UserSerializer(source="created_by", read_only=True)

    class Meta:
        model = BonCommande
        fields = [
            "id",
            "numero",
            "date",
            "objet",
            "reference",
            "status",
            "status_display",
            "nb_proformas",
            "fiche_type",
            "fiche_id",
            "created_by_detail",
            "created_at",
        ]

    def get_nb_proformas(self, obj) -> int:
        return obj.factures_proforma.count()
