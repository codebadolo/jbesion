"""
Custom User model for the Gestion des Fiches de Besoins application.

Extends Django's AbstractUser to add:
  - role  : one of EMPLOYEE / MANAGER / DAF / DIRECTOR / ADMIN
  - department : FK to Department
  - manager : self-referential FK (optional)
  - phone / avatar : additional profile fields
"""

from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    """All possible roles within the organisation."""
    EMPLOYEE = "EMPLOYEE", "Employé"
    MANAGER = "MANAGER", "Manager"
    DAF = "DAF", "Directeur Administratif et Financier"
    DIRECTOR = "DIRECTOR", "Directeur Général"
    ADMIN = "ADMIN", "Administrateur"


class User(AbstractUser):
    """
    Custom user model.

    AbstractUser already provides:
      username, first_name, last_name, email,
      password, is_staff, is_active, date_joined, last_login.
    """

    # ------------------------------------------------------------------
    # Role
    # ------------------------------------------------------------------
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EMPLOYEE,
        verbose_name="Rôle",
    )

    # ------------------------------------------------------------------
    # Department  (nullable so that admin / superuser can be role-less)
    # ------------------------------------------------------------------
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
        verbose_name="Département",
    )

    # ------------------------------------------------------------------
    # Hierarchical manager (self-referential, optional)
    # ------------------------------------------------------------------
    manager = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subordinates",
        verbose_name="Manager direct",
    )

    # ------------------------------------------------------------------
    # Extra profile fields
    # ------------------------------------------------------------------
    phone = models.CharField(
        max_length=20,
        blank=True,
        default="",
        verbose_name="Téléphone",
    )
    avatar = models.ImageField(
        upload_to="avatars/",
        null=True,
        blank=True,
        verbose_name="Avatar",
    )

    # Timestamps
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Dernière modification")

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        ordering = ["last_name", "first_name"]

    def __str__(self) -> str:
        full = self.get_full_name()
        return full if full else self.username

    # ------------------------------------------------------------------
    # Convenience helpers
    # ------------------------------------------------------------------

    @property
    def is_employee(self) -> bool:
        return self.role == Role.EMPLOYEE

    @property
    def is_manager(self) -> bool:
        return self.role == Role.MANAGER

    @property
    def is_daf(self) -> bool:
        return self.role == Role.DAF

    @property
    def is_director(self) -> bool:
        return self.role == Role.DIRECTOR

    @property
    def is_admin_role(self) -> bool:
        """True when the user has the ADMIN application role (distinct from is_staff)."""
        return self.role == Role.ADMIN
