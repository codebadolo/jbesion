"""
Admin registrations for the fiches app.
"""

from django.contrib import admin
from django.contrib.contenttypes.admin import GenericTabularInline

from .models import (
    FicheInterne,
    FicheInterneItem,
    FicheExterne,
    FicheExterneItem,
    Validation,
)


# ---------------------------------------------------------------------------
# Inline item admins
# ---------------------------------------------------------------------------

class FicheInterneItemInline(admin.TabularInline):
    model = FicheInterneItem
    extra = 1
    fields = ("designation", "quantity", "date_requise", "montant")


class FicheExterneItemInline(admin.TabularInline):
    model = FicheExterneItem
    extra = 1
    fields = (
        "designation", "quantity", "affectation",
        "date_requise", "montant_prestataire", "montant_client",
    )


class ValidationInline(GenericTabularInline):
    model = Validation
    extra = 0
    readonly_fields = (
        "fiche_type", "validator", "role_at_validation",
        "status", "date_validation", "commentaire",
    )
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


# ---------------------------------------------------------------------------
# FicheInterne admin
# ---------------------------------------------------------------------------

@admin.register(FicheInterne)
class FicheInterneAdmin(admin.ModelAdmin):
    list_display = (
        "__str__", "created_by", "department", "status", "date_creation",
    )
    list_filter = ("status", "department")
    search_fields = ("created_by__username", "created_by__last_name", "notes")
    readonly_fields = ("date_creation", "created_at", "updated_at")
    inlines = [FicheInterneItemInline, ValidationInline]
    ordering = ("-created_at",)


# ---------------------------------------------------------------------------
# FicheExterne admin
# ---------------------------------------------------------------------------

@admin.register(FicheExterne)
class FicheExterneAdmin(admin.ModelAdmin):
    list_display = (
        "__str__", "created_by", "department", "status", "date_creation",
    )
    list_filter = ("status", "department")
    search_fields = ("created_by__username", "created_by__last_name", "notes")
    readonly_fields = ("date_creation", "created_at", "updated_at")
    inlines = [FicheExterneItemInline, ValidationInline]
    ordering = ("-created_at",)


# ---------------------------------------------------------------------------
# Validation admin
# ---------------------------------------------------------------------------

@admin.register(Validation)
class ValidationAdmin(admin.ModelAdmin):
    list_display = (
        "__str__", "fiche_type", "object_id",
        "validator", "role_at_validation", "status", "date_validation",
    )
    list_filter = ("fiche_type", "status", "role_at_validation")
    search_fields = ("validator__username", "commentaire")
    readonly_fields = (
        "fiche_type", "content_type", "object_id",
        "validator", "role_at_validation", "status", "date_validation",
    )
    ordering = ("-date_validation",)
