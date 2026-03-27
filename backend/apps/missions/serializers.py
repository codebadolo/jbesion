"""
Serializers pour les Fiches de Mission et Absences.
"""

from rest_framework import serializers
from apps.accounts.serializers import UserSerializer
from apps.departments.serializers import DepartmentShortSerializer
from .models import FicheMission, AbsenceAgent


class FicheMissionSerializer(serializers.ModelSerializer):
    beneficiaire_detail = UserSerializer(source="beneficiaire", read_only=True)
    agent_liaison_detail = UserSerializer(source="agent_liaison", read_only=True)
    created_by_detail = UserSerializer(source="created_by", read_only=True)
    department_detail = DepartmentShortSerializer(source="department", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    total_frais = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = FicheMission
        fields = [
            "id",
            "numero",
            "date",
            "beneficiaire",
            "beneficiaire_detail",
            "matricule_display",
            "nom_prenom",
            "fonction",
            "destination",
            "objet_mission",
            "date_debut",
            "date_fin",
            "hebergement",
            "restauration",
            "transport_aller_retour",
            "autres_frais",
            "total_frais",
            "prestataire_nom",
            "agent_liaison",
            "agent_liaison_detail",
            "fiche_externe_id",
            "status",
            "status_display",
            "department",
            "department_detail",
            "notes",
            "created_by",
            "created_by_detail",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "numero", "matricule_display", "created_at", "updated_at"]


class FicheMissionListSerializer(serializers.ModelSerializer):
    """Serializer allégé pour les listes."""
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    total_frais = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    department_detail = DepartmentShortSerializer(source="department", read_only=True)

    class Meta:
        model = FicheMission
        fields = [
            "id",
            "numero",
            "date",
            "nom_prenom",
            "matricule_display",
            "destination",
            "objet_mission",
            "date_debut",
            "date_fin",
            "total_frais",
            "status",
            "status_display",
            "department_detail",
            "created_at",
        ]


class AbsenceAgentSerializer(serializers.ModelSerializer):
    agent_detail = UserSerializer(source="agent", read_only=True)
    motif_display = serializers.CharField(source="get_motif_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = AbsenceAgent
        fields = [
            "id",
            "agent",
            "agent_detail",
            "date_debut",
            "date_fin",
            "motif",
            "motif_display",
            "description",
            "fiche_mission",
            "status",
            "status_display",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
