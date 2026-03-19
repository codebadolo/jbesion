"""
Admin registrations for the accounts app.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom admin for the User model, extending the default UserAdmin."""

    list_display = (
        "username", "email", "first_name", "last_name",
        "role", "department", "is_active", "is_staff",
    )
    list_filter = ("role", "department", "is_active", "is_staff")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering = ("last_name", "first_name")

    # Add role, department, manager, phone to the edit form
    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Profil applicatif",
            {
                "fields": ("role", "department", "manager", "phone", "avatar"),
            },
        ),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (
            "Profil applicatif",
            {
                "fields": ("role", "department", "manager", "phone"),
            },
        ),
    )
