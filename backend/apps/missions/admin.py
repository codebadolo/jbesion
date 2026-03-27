from django.contrib import admin
from .models import FicheMission, AbsenceAgent


@admin.register(FicheMission)
class FicheMissionAdmin(admin.ModelAdmin):
    list_display = [
        "numero", "nom_prenom", "matricule_display", "fonction",
        "destination", "date_debut", "date_fin", "total_frais", "status"
    ]
    list_filter = ["status", "department"]
    search_fields = ["numero", "nom_prenom", "matricule_display", "destination"]
    readonly_fields = ["numero", "total_frais", "created_at", "updated_at"]
    fieldsets = [
        ("Identification", {"fields": ["numero", "date", "department", "status"]}),
        ("Personne en mission", {"fields": [
            "beneficiaire", "matricule_display", "nom_prenom", "fonction", "prestataire_nom"
        ]}),
        ("Détails de la mission", {"fields": [
            "destination", "objet_mission", "date_debut", "date_fin",
            "agent_liaison", "fiche_externe_id"
        ]}),
        ("Frais", {"fields": [
            "hebergement", "restauration", "transport_aller_retour", "autres_frais", "total_frais"
        ]}),
        ("Métadonnées", {"fields": ["notes", "created_by", "created_at", "updated_at"]}),
    ]


@admin.register(AbsenceAgent)
class AbsenceAgentAdmin(admin.ModelAdmin):
    list_display = ["agent", "date_debut", "date_fin", "motif", "status", "created_at"]
    list_filter = ["status", "motif"]
    search_fields = ["agent__first_name", "agent__last_name", "description"]
    readonly_fields = ["created_at", "updated_at"]
