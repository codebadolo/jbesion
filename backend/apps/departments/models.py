"""
Department model.

A department groups employees together.  Each User belongs to one Department.
"""

from django.db import models


class Department(models.Model):
    """Represents an organisational department (e.g. Finance, IT, RH …)."""

    name = models.CharField(
        max_length=150,
        unique=True,
        verbose_name="Nom du département",
    )
    code = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="Code",
        help_text="Identifiant court unique, ex: FIN, IT, RH",
    )
    description = models.TextField(
        blank=True,
        default="",
        verbose_name="Description",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Date de création",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Dernière modification",
    )

    class Meta:
        verbose_name = "Département"
        verbose_name_plural = "Départements"
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.code} – {self.name}"
