"""
Permissions for the bons_paiement app.

CanManageBonPaiement — DAF, Admin, or any member of the AF department
                        can create / update / delete bons de paiement.
                        All authenticated users can read.
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.accounts.models import Role


class CanManageBonPaiement(BasePermission):
    """
    Read access: any authenticated user.
    Write access (create / update / delete): DAF, ADMIN, or AF-department members.
    """

    message = "Vous n'avez pas accès aux bons de paiement."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == Role.COLLABORATEUR and not self._is_comptable(request.user):
            return False
        if request.method in SAFE_METHODS:
            return True
        return self._is_comptable(request.user)

    def has_object_permission(self, request, view, obj) -> bool:
        if request.user.role == Role.COLLABORATEUR and not self._is_comptable(request.user):
            return False
        if request.method in SAFE_METHODS:
            return True
        return self._is_comptable(request.user)

    @staticmethod
    def _is_comptable(user) -> bool:
        if user.role in (Role.DAF, Role.ADMIN) or user.is_staff:
            return True
        if user.department and user.department.code == "AF":
            return True
        if user.is_comptable:
            return True
        return False
