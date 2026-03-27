"""
Models pour la gestion des Missions et Frais de Mission.

Deux modèles principaux :
  - FicheMission   : fiche de frais de mission (hébergement, restauration, transport…)
  - AbsenceAgent   : absence déclarée par un agent de liaison (en déplacement, formation…)
"""

from django.conf import settings
from django.db import models


class FicheMissionStatus(models.TextChoices):
    DRAFT            = "DRAFT",            "Brouillon"
    PENDING_MANAGER  = "PENDING_MANAGER",  "En attente du Manager"
    PENDING_DAF      = "PENDING_DAF",      "En attente du DAF"
    PENDING_DG       = "PENDING_DG",       "En attente du DG"
    APPROVED         = "APPROVED",         "Approuvée"
    REJECTED         = "REJECTED",         "Rejetée"
    IN_PROGRESS      = "IN_PROGRESS",      "En cours"
    DONE             = "DONE",             "Terminée / Clôturée"


class MotifAbsence(models.TextChoices):
    MISSION     = "MISSION",     "Déplacement mission"
    FORMATION   = "FORMATION",   "Formation / Cours"
    ACTIVITE    = "ACTIVITE",    "Activité extérieure entreprise"
    AUTRE       = "AUTRE",       "Autre"


class AbsenceStatus(models.TextChoices):
    DECLARED  = "DECLARED",  "Déclarée"
    VALIDATED = "VALIDATED", "Validée"
    CANCELLED = "CANCELLED", "Annulée"


# ---------------------------------------------------------------------------
# Fiche de Frais de Mission
# ---------------------------------------------------------------------------

class FicheMission(models.Model):
    """
    Fiche de frais de mission gérée par la RH.

    Peut concerner :
      - un membre du personnel (beneficiaire FK)
      - un prestataire externe (nom saisi manuellement)

    Le matricule est affiché automatiquement si c'est un membre du personnel,
    sinon il peut être saisi manuellement.
    """

    numero = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        verbose_name="Numéro de fiche",
    )
    date = models.DateField(verbose_name="Date de la fiche")

    # ── Personne en mission ──────────────────────────────────────────
    beneficiaire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="fiches_mission",
        verbose_name="Bénéficiaire (personnel)",
        help_text="Laisser vide pour un prestataire externe",
    )
    # Matricule affiché : auto depuis le personnel ou saisi manuellement
    matricule_display = models.CharField(
        max_length=20,
        blank=True,
        default="",
        verbose_name="Numéro Matricule",
    )
    nom_prenom = models.CharField(max_length=255, verbose_name="Nom et Prénom")
    fonction = models.CharField(max_length=150, blank=True, default="", verbose_name="Fonction / Poste")

    # ── Détails de la mission ────────────────────────────────────────
    destination = models.CharField(max_length=255, verbose_name="Destination / Lieu de mission")
    objet_mission = models.TextField(verbose_name="Objet de la mission")
    date_debut = models.DateField(verbose_name="Date de départ")
    date_fin = models.DateField(verbose_name="Date de retour")

    # ── Frais (en FCFA) ──────────────────────────────────────────────
    hebergement = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
        verbose_name="Hébergement (FCFA)",
    )
    restauration = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
        verbose_name="Restauration (FCFA)",
    )
    transport_aller_retour = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
        verbose_name="Transport Aller-Retour (FCFA)",
    )
    autres_frais = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
        verbose_name="Autres frais (FCFA)",
    )

    # ── Prestataire externe lié (si applicable) ──────────────────────
    # Si la mission nécessite un prestataire local, on peut noter son nom
    prestataire_nom = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Nom du prestataire (si externe)",
    )

    # ── Agent de liaison affecté ─────────────────────────────────────
    agent_liaison = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="missions_comme_agent_liaison",
        verbose_name="Agent de liaison",
        limit_choices_to={"is_agent_liaison": True},
    )

    # ── Lien vers une fiche externe (optionnel) ──────────────────────
    fiche_externe_id = models.PositiveIntegerField(
        null=True, blank=True,
        verbose_name="ID Fiche Externe liée",
    )

    # ── Workflow ─────────────────────────────────────────────────────
    status = models.CharField(
        max_length=20,
        choices=FicheMissionStatus.choices,
        default=FicheMissionStatus.DRAFT,
        verbose_name="Statut",
    )
    department = models.ForeignKey(
        "departments.Department",
        on_delete=models.PROTECT,
        related_name="fiches_mission",
        verbose_name="Département",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes / Observations")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="fiches_mission_creees",
        verbose_name="Créé par",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Créé le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Modifié le")

    class Meta:
        verbose_name = "Fiche de Mission"
        verbose_name_plural = "Fiches de Mission"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.numero} | {self.nom_prenom} | {self.destination} | {self.get_status_display()}"

    @property
    def total_frais(self):
        return self.hebergement + self.restauration + self.transport_aller_retour + self.autres_frais

    def save(self, *args, **kwargs):
        # Auto-remplir le matricule depuis le bénéficiaire si personnel
        if self.beneficiaire and not self.matricule_display:
            self.matricule_display = self.beneficiaire.matricule or ""
        if self.beneficiaire and not self.nom_prenom:
            self.nom_prenom = self.beneficiaire.get_full_name() or self.beneficiaire.username
        if self.beneficiaire and not self.fonction:
            self.fonction = self.beneficiaire.fonction or ""
        super().save(*args, **kwargs)
        # Générer le numéro
        if not self.numero:
            from django.utils import timezone
            year = timezone.now().year
            self.numero = f"FM-{year}-{self.pk:05d}"
            FicheMission.objects.filter(pk=self.pk).update(numero=self.numero)


# ---------------------------------------------------------------------------
# Absence Agent de Liaison
# ---------------------------------------------------------------------------

class AbsenceAgent(models.Model):
    """
    Absence déclarée par un agent de liaison lorsqu'il est en déplacement
    pour le compte de l'entreprise (mission, formation, activité extérieure…).
    """

    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="absences",
        verbose_name="Agent",
        limit_choices_to={"is_agent_liaison": True},
    )
    date_debut = models.DateField(verbose_name="Date de début")
    date_fin = models.DateField(verbose_name="Date de fin")
    motif = models.CharField(
        max_length=20,
        choices=MotifAbsence.choices,
        default=MotifAbsence.MISSION,
        verbose_name="Motif",
    )
    description = models.TextField(blank=True, default="", verbose_name="Description")

    # Lien optionnel vers une fiche de mission
    fiche_mission = models.ForeignKey(
        FicheMission,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="absences_agents",
        verbose_name="Fiche de mission associée",
    )

    status = models.CharField(
        max_length=20,
        choices=AbsenceStatus.choices,
        default=AbsenceStatus.DECLARED,
        verbose_name="Statut",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Déclarée le")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Modifiée le")

    class Meta:
        verbose_name = "Absence Agent"
        verbose_name_plural = "Absences Agents"
        ordering = ["-date_debut"]

    def __str__(self) -> str:
        return (
            f"{self.agent} | {self.date_debut} → {self.date_fin} "
            f"| {self.get_motif_display()}"
        )
