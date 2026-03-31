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

# Actions workflow auxquelles le DIRECTOR peut participer
_DIRECTOR_WORKFLOW_ACTIONS = {
    "approuver_dg", "rejeter_dg",
}

# Actions workflow auxquelles le DAF peut participer (en plus de ses droits d'écriture)
_DAF_WORKFLOW_ACTIONS = {
    "valider_proformas", "approuver_daf", "rejeter_daf", "selectionner_fournisseur",
}

# Toutes les actions workflow (lecture seule au niveau permission — les vues gèrent la logique)
_ALL_WORKFLOW_ACTIONS = _DIRECTOR_WORKFLOW_ACTIONS | _DAF_WORKFLOW_ACTIONS | {
    "soumettre_daf", "executer", "cloturer", "proformas", "supprimer_proforma",
}


class CanManageBonCommande(BasePermission):
    """
    Lecture : tout utilisateur authentifié.
    Écriture (create/update/delete) : comptable AF, DAF, ADMIN.
    Actions workflow : selon le rôle (les vues vérifient le rôle exact).
      - DIRECTOR peut approuver/rejeter côté DG.
      - DAF peut valider proformas, approuver/rejeter côté DAF.
      - Comptable/DAF/ADMIN peuvent soumettre, exécuter, clôturer, gérer les proformas.
    """
    message = "Vous n'avez pas accès aux bons de commande."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == Role.COLLABORATEUR:
            return False
        if request.method in SAFE_METHODS:
            return True
        # Actions workflow : laisser passer — les vues imposent leurs propres contrôles
        if getattr(view, "action", None) in _ALL_WORKFLOW_ACTIONS:
            return True
        return self._can_write(request.user)

    def has_object_permission(self, request, view, obj) -> bool:
        if request.user.role == Role.COLLABORATEUR:
            return False
        if request.method in SAFE_METHODS:
            return True
        if getattr(view, "action", None) in _ALL_WORKFLOW_ACTIONS:
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
