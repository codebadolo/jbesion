"""
Custom DRF permissions for the fiches app.

CanValidateFicheInterne  — checks that the requester's role matches the
                           step currently waiting for validation on a FicheInterne.
CanValidateFicheExterne  — same for FicheExterne.
IsOwnerOrReadOnly        — only the creator of a fiche can mutate it;
                           others get read-only access.
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.accounts.models import Role
from .models import FicheInterneStatus, FicheExterneStatus


class IsOwnerOrReadOnly(BasePermission):
    """
    Object-level permission.
    Safe (GET, HEAD, OPTIONS) requests are allowed for any authenticated user.
    Write requests (POST, PUT, PATCH, DELETE) are only allowed for the creator.
    Admin users bypass this restriction.
    """

    message = "Seul le créateur de la fiche peut la modifier."

    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        # Admins always have write access
        if user.role == Role.ADMIN or user.is_staff:
            return True
        return obj.created_by == user


class CanValidateFicheInterne(BasePermission):
    """
    Grants permission to call the 'validate' action on a FicheInterne
    only if the current user's role matches the status awaiting validation.

    Mapping:
      PENDING_MANAGER  → MANAGER
      PENDING_DAF      → DAF
      PENDING_DIRECTOR → DIRECTOR
    """

    message = "Vous n'êtes pas autorisé à valider cette fiche à ce stade."

    # Map fiche status → required user role
    STATUS_ROLE_MAP = {
        FicheInterneStatus.PENDING_MANAGER:  Role.MANAGER,
        FicheInterneStatus.PENDING_DAF:      Role.DAF,
        FicheInterneStatus.PENDING_DIRECTOR: Role.DIRECTOR,
    }

    def has_object_permission(self, request, view, obj) -> bool:
        user = request.user

        # Admins may always validate
        if user.role == Role.ADMIN or user.is_staff:
            return True

        required_role = self.STATUS_ROLE_MAP.get(obj.status)
        if required_role is None:
            # Fiche is not in a state that accepts validation
            return False

        return user.role == required_role


class CanValidateFicheExterne(BasePermission):
    """
    Grants permission to call the 'validate' action on a FicheExterne.

    Mapping:
      PENDING_MANAGER  → MANAGER
      PENDING_DIRECTOR → DIRECTOR
    """

    message = "Vous n'êtes pas autorisé à valider cette fiche à ce stade."

    STATUS_ROLE_MAP = {
        FicheExterneStatus.PENDING_MANAGER:  Role.MANAGER,
        FicheExterneStatus.PENDING_DIRECTOR: Role.DIRECTOR,
    }

    def has_object_permission(self, request, view, obj) -> bool:
        user = request.user

        if user.role == Role.ADMIN or user.is_staff:
            return True

        required_role = self.STATUS_ROLE_MAP.get(obj.status)
        if required_role is None:
            return False

        return user.role == required_role
