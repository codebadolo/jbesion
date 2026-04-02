"""
Models pour les Bons de Commande.

Workflow :
  DRAFT → PENDING_PROFORMA → PENDING_DAF → PENDING_DG → APPROVED / REJECTED → IN_EXECUTION → DONE

  1. Le comptable crée le BC (DRAFT) puis le soumet (PENDING_PROFORMA).
  2. Le comptable uploade les factures proforma de différents fournisseurs.
  3. Le DAF sélectionne le fournisseur retenu → valide les proformas (PENDING_DAF).
  4. Le DAF approuve formellement (PENDING_DG).
  5. Le DG approuve pour exécution (APPROVED).
  6. Exécution → DONE.
"""

import datetime

from django.conf import settings
from django.db import models


class BonCommandeStatus(models.TextChoices):
    DRAFT            = "DRAFT",            "Brouillon"
    PENDING_PROFORMA = "PENDING_PROFORMA", "En attente des proformas"
    PENDING_DAF      = "PENDING_DAF",      "En attente du DAF"
    PENDING_DG       = "PENDING_DG",       "En attente du DG"
    APPROVED         = "APPROVED",         "Approuvé"
    REJECTED         = "REJECTED",         "Rejeté"
    IN_EXECUTION     = "IN_EXECUTION",     "En cours d'exécution"
    DONE             = "DONE",             "Exécuté / Clôturé"


class BonCommande(models.Model):
    """
    Bon de Commande émis après approbation d'une fiche de besoin.

    Workflow :
      1. Le comptable/DAF crée le bon (DRAFT)
      2. Soumission au DAF pour approbation (PENDING_DAF)
      3. Si favorable, soumission au DG pour exécution (PENDING_DG)
      4. DG approuve → APPROVED / REJECTED
      5. Exécution chez le fournisseur sélectionné → IN_EXECUTION → DONE
    """

    numero = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        verbose_name="Numéro",
    )
    date = models.DateField(default=datetime.date.today, verbose_name="Date")
    objet = models.TextField(verbose_name="Objet / Description")

    # Référence optionnelle (numéro de commande interne, etc.)
    reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Référence (optionnelle)",
    )

    # Lien optionnel vers une fiche de besoin
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
        choices=BonCommandeStatus.choices,
        default=BonCommandeStatus.DRAFT,
        verbose_name="Statut",
    )

    # ── Approbation DAF ───────────────────────────────────────────────
    daf_approuve_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="bons_commande_daf",
        verbose_name="Approuvé par (DAF)",
    )
    daf_approuve_le = models.DateTimeField(null=True, blank=True, verbose_name="Approuvé le (DAF)")
    daf_commentaire = models.TextField(blank=True, default="", verbose_name="Commentaire DAF")

    # ── Approbation DG ────────────────────────────────────────────────
    dg_approuve_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="bons_commande_dg",
        verbose_name="Approuvé par (DG)",
    )
    dg_approuve_le = models.DateTimeField(null=True, blank=True, verbose_name="Approuvé le (DG)")
    dg_commentaire = models.TextField(blank=True, default="", verbose_name="Commentaire DG")

    # ── Fournisseur sélectionné (choix final) ─────────────────────────
    fournisseur_selectionne = models.ForeignKey(
        "FactureProforma",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="+",
        verbose_name="Fournisseur sélectionné",
    )

    notes = models.TextField(blank=True, default="", verbose_name="Notes / Observations")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="bons_commande_crees",
        verbose_name="Créé par",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Créé le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Modifié le")

    class Meta:
        verbose_name = "Bon de Commande"
        verbose_name_plural = "Bons de Commande"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.numero} — {self.objet[:60]} — {self.get_status_display()}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.numero:
            from django.utils import timezone
            year = timezone.now().year
            self.numero = f"BC-{year}-{self.pk:05d}"
            BonCommande.objects.filter(pk=self.pk).update(numero=self.numero)


class FactureProforma(models.Model):
    """
    Facture proforma d'un fournisseur, uploadée par le comptable.
    Le DAF et le DG peuvent consulter toutes les proformas et désigner
    le fournisseur à retenir via BonCommande.fournisseur_selectionne.
    """

    bon_commande = models.ForeignKey(
        BonCommande,
        on_delete=models.CASCADE,
        related_name="factures_proforma",
        verbose_name="Bon de Commande",
    )
    fournisseur_nom = models.CharField(max_length=255, verbose_name="Nom du fournisseur")
    reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Référence facture proforma",
    )
    montant = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Montant (FCFA)",
    )
    fichier = models.FileField(
        upload_to="proformas/%Y/%m/",
        null=True,
        blank=True,
        verbose_name="Fichier (scan / PDF)",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="factures_proforma_uploadees",
        verbose_name="Uploadé par",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name="Uploadé le")

    class Meta:
        verbose_name = "Facture Proforma"
        verbose_name_plural = "Factures Proforma"
        ordering = ["uploaded_at"]

    def __str__(self) -> str:
        return f"{self.fournisseur_nom} — {self.montant} FCFA ({self.bon_commande.numero})"
