from django.contrib import admin
from .models import BonCommande, FactureProforma


class FactureProformaInline(admin.TabularInline):
    model = FactureProforma
    extra = 0
    readonly_fields = ["uploaded_by", "uploaded_at"]


@admin.register(BonCommande)
class BonCommandeAdmin(admin.ModelAdmin):
    list_display = ["numero", "objet", "status", "fiche_type", "created_by", "created_at"]
    list_filter = ["status", "fiche_type"]
    search_fields = ["numero", "objet", "reference"]
    readonly_fields = ["numero", "created_at", "updated_at"]
    inlines = [FactureProformaInline]


@admin.register(FactureProforma)
class FactureProformaAdmin(admin.ModelAdmin):
    list_display = ["fournisseur_nom", "montant", "bon_commande", "uploaded_by", "uploaded_at"]
    list_filter = ["bon_commande__status"]
    search_fields = ["fournisseur_nom", "reference"]
    readonly_fields = ["uploaded_at"]
