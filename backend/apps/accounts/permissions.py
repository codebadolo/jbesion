"""
Custom DRF permissions for the accounts app.
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import Role


class IsAdminRole(BasePermission):
    """
    Grants access only to users with role == ADMIN (or Django's is_staff flag).
    Used to protect user management CRUD endpoints.
    """
    message = "Seuls les administrateurs peuvent effectuer cette action."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == Role.ADMIN or request.user.is_staff)
        )


class IsAdminOrReadOnly(BasePermission):
    """
    Read-only for any authenticated user; write access limited to ADMIN.
    """
    message = "Seuls les administrateurs peuvent modifier ces données."

    def has_permission(self, request, view) -> bool:
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role == Role.ADMIN or request.user.is_staff


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level permission: only the object owner or an admin can modify it.
    """
    message = "Vous ne pouvez modifier que votre propre profil."

    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return (
            obj == request.user
            or request.user.role == Role.ADMIN
            or request.user.is_staff
        )
