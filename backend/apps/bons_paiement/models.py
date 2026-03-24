"""
Models for the Bons de Paiement application.

Two models:
  - BonPaiement  : a payment voucher managed by the accounting team
  - BonPaiementItem : line items (détails) for each voucher
"""

from django.conf import settings
from django.db import models


class ModePaiement(models.TextChoices):
    ESPECE  = "ESPECE",  "Espèce"
    CHEQUE  = "CHEQUE",  "Chèque"


class BonPaiementStatus(models.TextChoices):
    DRAFT     = "DRAFT",     "Brouillon"
    VALIDATED = "VALIDATED", "Validé"
    CANCELLED = "CANCELLED", "Annulé"


class BonPaiement(models.Model):
    """
    A payment voucher (Bon de Paiement) issued by the accounting team.
    """

    numero = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        verbose_name="Numéro de bon",
    )
    date = models.DateField(verbose_name="Date")
    beneficiaire = models.CharField(
        max_length=255,
        verbose_name="Bénéficiaire (Reçu par)",
    )
    motif = models.TextField(verbose_name="Motif")
    mode_paiement = models.CharField(
        max_length=20,
        choices=ModePaiement.choices,
        verbose_name="Mode de paiement",
    )
    montant = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        verbose_name="Montant (FCFA)",
    )
    montant_lettres = models.CharField(
        max_length=500,
        blank=True,
        default="",
        verbose_name="Montant en lettres",
    )
    notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Notes / Observations",
    )
    # Lien optionnel vers une fiche de besoin (INTERNE ou EXTERNE)
    fiche_type = models.CharField(
        max_length=10,
        choices=[("INTERNE", "Interne"), ("EXTERNE", "Externe")],
        blank=True,
        default="",
        verbose_name="Type de fiche liée",
    )
    fiche_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="ID de la fiche liée",
    )
    status = models.CharField(
        max_length=20,
        choices=BonPaiementStatus.choices,
        default=BonPaiementStatus.DRAFT,
        verbose_name="Statut",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="bons_paiement",
        verbose_name="Créé par",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Créé le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Modifié le")

    class Meta:
        verbose_name = "Bon de Paiement"
        verbose_name_plural = "Bons de Paiement"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.numero} — {self.beneficiaire} — {self.montant} FCFA"


class BonPaiementItem(models.Model):
    """A single line item on a BonPaiement (tableau récapitulatif)."""

    bon = models.ForeignKey(
        BonPaiement,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Bon de Paiement",
    )
    designation = models.CharField(max_length=255, verbose_name="Désignation / Détail")
    montant = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        verbose_name="Montant (FCFA)",
    )

    class Meta:
        verbose_name = "Article (Bon de Paiement)"
        verbose_name_plural = "Articles (Bons de Paiement)"

    def __str__(self) -> str:
        return f"{self.designation} — {self.montant} FCFA"
