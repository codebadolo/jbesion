from django.contrib import admin
from .models import BonPaiement, BonPaiementItem


class BonPaiementItemInline(admin.TabularInline):
    model = BonPaiementItem
    extra = 1


@admin.register(BonPaiement)
class BonPaiementAdmin(admin.ModelAdmin):
    list_display = ["numero", "date", "beneficiaire", "mode_paiement", "montant", "status", "created_by"]
    list_filter = ["status", "mode_paiement"]
    search_fields = ["numero", "beneficiaire", "motif"]
    readonly_fields = ["numero", "created_at", "updated_at"]
    inlines = [BonPaiementItemInline]
