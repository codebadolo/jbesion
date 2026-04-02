"""
Models for the Fiches de Besoins (Need Sheets) application.

Three main models:
  - FicheInterne  : internal procurement need + its line items
  - FicheExterne  : external / partner procurement need + its line items
  - Validation    : audit-trail record for every approval / rejection action,
                    linked to either type via GenericForeignKey
"""

import datetime

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.accounts.models import User


# ---------------------------------------------------------------------------
# Shared status constants
# ---------------------------------------------------------------------------

class FicheInterneStatus(models.TextChoices):
    DRAFT                     = "DRAFT",                     "Brouillon"
    PENDING_MANAGER           = "PENDING_MANAGER",           "En attente du Supérieur Hiérarchique"
    PENDING_DAF               = "PENDING_DAF",               "En attente du DAF"
    PENDING_DIRECTOR          = "PENDING_DIRECTOR",          "En attente du DG"
    PENDING_CLARIFICATION_DAF = "PENDING_CLARIFICATION_DAF", "Clarification demandée (DAF)"
    PENDING_CLARIFICATION_DIR = "PENDING_CLARIFICATION_DIR", "Clarification demandée (DG)"
    APPROVED                  = "APPROVED",                  "Approuvée"
    REJECTED                  = "REJECTED",                  "Rejetée"
    IN_EXECUTION              = "IN_EXECUTION",              "En cours d'exécution"
    DELIVERED                 = "DELIVERED",                 "Livrée / Réceptionnée"


class FicheExterneStatus(models.TextChoices):
    DRAFT                     = "DRAFT",                     "Brouillon"
    PENDING_MANAGER           = "PENDING_MANAGER",           "En attente du Supérieur Hiérarchique"
    PENDING_DIRECTOR          = "PENDING_DIRECTOR",          "En attente du DG"
    PENDING_CLARIFICATION_DIR = "PENDING_CLARIFICATION_DIR", "Clarification demandée (DG)"
    APPROVED                  = "APPROVED",                  "Approuvée"
    REJECTED                  = "REJECTED",                  "Rejetée"
    IN_EXECUTION              = "IN_EXECUTION",              "En cours d'exécution"
    DELIVERED                 = "DELIVERED",                 "Livrée / Réceptionnée"


class ValidationStatus(models.TextChoices):
    FAVORABLE                = "FAVORABLE",               "Favorable"
    APPROVED                 = "APPROVED",                "Approuvé"
    REJECTED                 = "REJECTED",                "Rejeté"
    CLARIFICATION_REQUESTED  = "CLARIFICATION_REQUESTED", "Clarification demandée"
    CLARIFICATION_RESPONDED  = "CLARIFICATION_RESPONDED", "Clarification fournie"


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

    reference = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        verbose_name="Référence",
    )
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
    # Exécution (comptabilité)
    executed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="executions_internes",
        verbose_name="Exécuté par",
    )
    executed_at = models.DateTimeField(null=True, blank=True, verbose_name="Date d'exécution")
    execution_fournisseur = models.CharField(max_length=255, blank=True, default="", verbose_name="Fournisseur / Prestataire")
    execution_reference = models.CharField(max_length=255, blank=True, default="", verbose_name="Référence bon de commande")
    execution_montant = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True, verbose_name="Montant décaissé")
    execution_mode_paiement = models.CharField(max_length=50, blank=True, default="", verbose_name="Mode de paiement")
    execution_numero_facture = models.CharField(max_length=255, blank=True, default="", verbose_name="N° Facture")
    execution_note = models.TextField(blank=True, default="", verbose_name="Observations")
    # Réception
    received_at = models.DateTimeField(null=True, blank=True, verbose_name="Date de réception")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Créé le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Modifié le")

    class Meta:
        verbose_name = "Fiche Interne"
        verbose_name_plural = "Fiches Internes"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.reference:
            year = datetime.date.today().year
            self.reference = f"FI-{year}-{self.pk:05d}"
            FicheInterne.objects.filter(pk=self.pk).update(reference=self.reference)

    def __str__(self) -> str:
        return f"{self.reference or f'FI-{self.pk:05d}'} | {self.department} | {self.get_status_display()}"


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
        verbose_name="Montant estimé (FCFA)",
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

    reference = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        verbose_name="Référence",
    )
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
    # Exécution (comptabilité)
    executed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="executions_externes",
        verbose_name="Exécuté par",
    )
    executed_at = models.DateTimeField(null=True, blank=True, verbose_name="Date d'exécution")
    execution_fournisseur = models.CharField(max_length=255, blank=True, default="", verbose_name="Fournisseur / Prestataire")
    execution_reference = models.CharField(max_length=255, blank=True, default="", verbose_name="Référence bon de commande")
    execution_montant = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True, verbose_name="Montant décaissé")
    execution_mode_paiement = models.CharField(max_length=50, blank=True, default="", verbose_name="Mode de paiement")
    execution_numero_facture = models.CharField(max_length=255, blank=True, default="", verbose_name="N° Facture")
    execution_note = models.TextField(blank=True, default="", verbose_name="Observations")
    # Réception
    received_at = models.DateTimeField(null=True, blank=True, verbose_name="Date de réception")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Créé le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Modifié le")

    class Meta:
        verbose_name = "Fiche Externe"
        verbose_name_plural = "Fiches Externes"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.reference:
            year = datetime.date.today().year
            self.reference = f"FE-{year}-{self.pk:05d}"
            FicheExterne.objects.filter(pk=self.pk).update(reference=self.reference)

    def __str__(self) -> str:
        return f"{self.reference or f'FE-{self.pk:05d}'} | {self.department} | {self.get_status_display()}"


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
        verbose_name="Montant Prestataire (FCFA)",
    )
    montant_client = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Montant Client (FCFA)",
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
        max_length=30,
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


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------

class NotificationType(models.TextChoices):
    SUBMITTED              = "SUBMITTED",               "Besoin soumis"
    FAVORABLE              = "FAVORABLE",               "Avis favorable"
    APPROVED               = "APPROVED",                "Accord pour exécution"
    REJECTED               = "REJECTED",                "Rejeté"
    CLARIFICATION_REQUEST  = "CLARIFICATION_REQUEST",   "Demande de clarification"
    CLARIFICATION_RESPONSE = "CLARIFICATION_RESPONSE",  "Clarification fournie"
    IN_EXECUTION           = "IN_EXECUTION",            "En cours d'exécution"
    DELIVERED              = "DELIVERED",               "Livré / Réceptionné"
    BON_EMIS               = "BON_EMIS",                "Bon de paiement émis"
    BON_VALIDE             = "BON_VALIDE",              "Bon de paiement validé"
    BON_ANNULE             = "BON_ANNULE",              "Bon de paiement annulé"


class Notification(models.Model):
    """
    In-app notification sent to a user when a fiche changes state.
    """

    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name="Destinataire",
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="sent_notifications",
        verbose_name="Expéditeur",
    )
    message = models.TextField(verbose_name="Message")
    is_read = models.BooleanField(default=False, verbose_name="Lu")
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        verbose_name="Type",
    )
    fiche_type = models.CharField(
        max_length=10,
        choices=FicheType.choices,
        blank=True, default="",
        verbose_name="Type de fiche",
    )
    fiche_id = models.PositiveIntegerField(null=True, blank=True, verbose_name="ID Fiche")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Créée le")

    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"→ {self.recipient} : {self.message[:60]}"
