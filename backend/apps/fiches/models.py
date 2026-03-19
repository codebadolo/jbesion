"""
Models for the Fiches de Besoins (Need Sheets) application.

Three main models:
  - FicheInterne  : internal procurement need + its line items
  - FicheExterne  : external / partner procurement need + its line items
  - Validation    : audit-trail record for every approval / rejection action,
                    linked to either type via GenericForeignKey
"""

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.accounts.models import User


# ---------------------------------------------------------------------------
# Shared status constants
# ---------------------------------------------------------------------------

class FicheInterneStatus(models.TextChoices):
    DRAFT              = "DRAFT",              "Brouillon"
    PENDING_MANAGER    = "PENDING_MANAGER",    "En attente du Manager"
    PENDING_DAF        = "PENDING_DAF",        "En attente du DAF"
    PENDING_DIRECTOR   = "PENDING_DIRECTOR",   "En attente du Directeur"
    APPROVED           = "APPROVED",           "Approuvée"
    REJECTED           = "REJECTED",           "Rejetée"


class FicheExterneStatus(models.TextChoices):
    DRAFT              = "DRAFT",              "Brouillon"
    PENDING_MANAGER    = "PENDING_MANAGER",    "En attente du Manager"
    PENDING_DIRECTOR   = "PENDING_DIRECTOR",   "En attente du Directeur"
    APPROVED           = "APPROVED",           "Approuvée"
    REJECTED           = "REJECTED",           "Rejetée"


class ValidationStatus(models.TextChoices):
    APPROVED = "APPROVED", "Approuvée"
    REJECTED = "REJECTED", "Rejetée"


class FicheType(models.TextChoices):
    INTERNE  = "INTERNE",  "Interne"
    EXTERNE  = "EXTERNE",  "Externe"


# ---------------------------------------------------------------------------
# FicheInterne
# ---------------------------------------------------------------------------

class FicheInterne(models.Model):
    """
    Internal need sheet.

    Workflow:  DRAFT → PENDING_MANAGER → PENDING_DAF → PENDING_DIRECTOR
               → APPROVED / REJECTED
    """

    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="fiches_internes",
        verbose_name="Créé par",
    )
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.PROTECT,
        related_name="fiches_internes",
        verbose_name="Département",
    )
    date_creation = models.DateField(
        auto_now_add=True,
        verbose_name="Date de création",
    )
    status = models.CharField(
        max_length=30,
        choices=FicheInterneStatus.choices,
        default=FicheInterneStatus.DRAFT,
        verbose_name="Statut",
    )
    notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Notes / Observations",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Créé le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Modifié le")

    class Meta:
        verbose_name = "Fiche Interne"
        verbose_name_plural = "Fiches Internes"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"FI-{self.pk:05d} | {self.department} | {self.get_status_display()}"


class FicheInterneItem(models.Model):
    """A single line item on a FicheInterne."""

    fiche = models.ForeignKey(
        FicheInterne,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Fiche Interne",
    )
    designation = models.CharField(
        max_length=255,
        verbose_name="Désignation",
    )
    quantity = models.PositiveIntegerField(
        default=1,
        verbose_name="Quantité",
    )
    date_requise = models.DateField(
        verbose_name="Date requise",
    )
    montant = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Montant estimé (DZD)",
    )

    class Meta:
        verbose_name = "Article (Fiche Interne)"
        verbose_name_plural = "Articles (Fiches Internes)"

    def __str__(self) -> str:
        return f"{self.designation} x{self.quantity}"


# ---------------------------------------------------------------------------
# FicheExterne
# ---------------------------------------------------------------------------

class FicheExterne(models.Model):
    """
    External (partner) need sheet.

    Workflow:  DRAFT → PENDING_MANAGER → PENDING_DIRECTOR
               → APPROVED / REJECTED  (no DAF step)
    """

    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="fiches_externes",
        verbose_name="Créé par",
    )
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.PROTECT,
        related_name="fiches_externes",
        verbose_name="Département",
    )
    date_creation = models.DateField(
        auto_now_add=True,
        verbose_name="Date de création",
    )
    status = models.CharField(
        max_length=30,
        choices=FicheExterneStatus.choices,
        default=FicheExterneStatus.DRAFT,
        verbose_name="Statut",
    )
    notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Notes / Observations",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Créé le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Modifié le")

    class Meta:
        verbose_name = "Fiche Externe"
        verbose_name_plural = "Fiches Externes"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"FE-{self.pk:05d} | {self.department} | {self.get_status_display()}"


class FicheExterneItem(models.Model):
    """A single line item on a FicheExterne."""

    fiche = models.ForeignKey(
        FicheExterne,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Fiche Externe",
    )
    designation = models.CharField(
        max_length=255,
        verbose_name="Désignation",
    )
    quantity = models.PositiveIntegerField(
        default=1,
        verbose_name="Quantité",
    )
    affectation = models.CharField(
        max_length=255,
        verbose_name="Affectation / Prestataire",
        help_text="Nom du partenaire ou prestataire concerné",
    )
    date_requise = models.DateField(
        verbose_name="Date requise",
    )
    montant_prestataire = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Montant Prestataire (DZD)",
    )
    montant_client = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Montant Client (DZD)",
    )

    class Meta:
        verbose_name = "Article (Fiche Externe)"
        verbose_name_plural = "Articles (Fiches Externes)"

    def __str__(self) -> str:
        return f"{self.designation} x{self.quantity} → {self.affectation}"


# ---------------------------------------------------------------------------
# Validation (polymorphic via GenericForeignKey)
# ---------------------------------------------------------------------------

class Validation(models.Model):
    """
    Audit record for every approval / rejection performed on a fiche.

    Uses GenericForeignKey so it can reference both FicheInterne
    and FicheExterne without duplicating columns.
    """

    fiche_type = models.CharField(
        max_length=10,
        choices=FicheType.choices,
        verbose_name="Type de fiche",
    )

    # Generic FK fields
    content_type  = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id      = models.PositiveIntegerField()
    fiche          = GenericForeignKey("content_type", "object_id")

    validator = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="validations",
        verbose_name="Validateur",
    )
    role_at_validation = models.CharField(
        max_length=20,
        verbose_name="Rôle lors de la validation",
        help_text="Role that the validator held at the time of validation",
    )
    status = models.CharField(
        max_length=10,
        choices=ValidationStatus.choices,
        verbose_name="Décision",
    )
    date_validation = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Date de validation",
    )
    commentaire = models.TextField(
        blank=True,
        default="",
        verbose_name="Commentaire",
    )

    class Meta:
        verbose_name = "Validation"
        verbose_name_plural = "Validations"
        ordering = ["-date_validation"]

    def __str__(self) -> str:
        return (
            f"{self.get_fiche_type_display()} #{self.object_id} "
            f"— {self.validator} → {self.get_status_display()}"
        )
