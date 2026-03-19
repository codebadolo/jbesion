"""
Admin registrations for the departments app.
"""

from django.contrib import admin

from .models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "created_at")
    search_fields = ("name", "code")
    ordering = ("name",)
