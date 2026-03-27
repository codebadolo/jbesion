"""
Permissions pour les Missions.

- Lecture : tous les utilisateurs authentifiés
- Création/modification : tous (chaque collaborateur peut créer une fiche de mission)
- Validation : Manager, DAF, DIRECTOR, ADMIN
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS
from apps.accounts.models import Role


class CanManageMission(BasePermission):
    """Tout utilisateur authentifié peut lire et créer. Seuls les valideurs peuvent valider."""

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True
        # Le créateur peut modifier son propre brouillon
        if obj.created_by == request.user:
            return True
        if request.user.is_rh:
            return True
        # Les rôles supérieurs peuvent tout modifier
        return request.user.role in (Role.MANAGER, Role.DAF, Role.DIRECTOR, Role.ADMIN)


class CanManageAbsence(BasePermission):
    """
    Un agent de liaison peut déclarer/gérer ses propres absences.
    Les managers/admins peuvent valider.
    """

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True
        if obj.agent == request.user:
            return True
        if request.user.is_rh:
            return True
        return request.user.role in (Role.MANAGER, Role.DAF, Role.DIRECTOR, Role.ADMIN)
