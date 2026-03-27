"""
Permissions pour les Bons de Commande.

- Lecture : tous les utilisateurs authentifiés
- Création/modification : comptable (AF), DAF, ADMIN
- Approbation DAF : DAF, ADMIN
- Approbation DG : DIRECTOR, ADMIN
- Upload proforma : comptable (AF), DAF, ADMIN
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS
from apps.accounts.models import Role


class CanManageBonCommande(BasePermission):
    """
    Lecture : tout utilisateur authentifié.
    Écriture (create/update/delete) : comptable AF, DAF, ADMIN.
    """
    message = "Seule la comptabilité ou le DAF peut gérer les bons de commande."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return self._can_write(request.user)

    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return self._can_write(request.user)

    @staticmethod
    def _can_write(user) -> bool:
        if user.role in (Role.DAF, Role.ADMIN) or user.is_staff:
            return True
        if user.department and user.department.code == "AF":
            return True
        if user.is_comptable:
            return True
        return False
