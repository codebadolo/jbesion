"""
Commande Django pour charger des fiches externes de mission.

Crée des FicheExterne (avec FicheExterneItem) liées à des FicheMission.
Chaque mission peut concerner :
  - un membre du personnel interne (beneficiaire FK)
  - un prestataire externe (prestataire_nom)

Usage:
    python manage.py seed_fiches_mission
    python manage.py seed_fiches_mission --clear
    python manage.py seed_fiches_mission --count 15
"""

import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User, Role
from apps.departments.models import Department
from apps.fiches.models import FicheExterne, FicheExterneItem, FicheExterneStatus
from apps.missions.models import FicheMission, FicheMissionStatus


# ── Données de référence ──────────────────────────────────────────────────────

PRESTATAIRES_EXTERNES = [
    ("TRANS BURKINA SARL", "Transport & logistique"),
    ("HOTEL SILMANDE", "Hébergement"),
    ("RESIDENCE LES PALMIERS", "Hébergement"),
    ("MAQUIS LE BAOBAB", "Restauration"),
    ("SOGEA SATOM BF", "Prestation technique"),
    ("AZIZ CONSULTING", "Formation & conseil"),
    ("BUREAU VERITAS BF", "Audit & contrôle"),
    ("MEDIAPLUS OUAGA", "Communication & événementiel"),
    ("KAMSONGRE TRAITEUR", "Restauration / buffet"),
    ("SETAO BF", "Transport longue distance"),
]

DESTINATIONS = [
    ("Bobo-Dioulasso", "déplacement inter-villes"),
    ("Koudougou", "mission terrain"),
    ("Banfora", "visite de chantier"),
    ("Ouahigouya", "formation régionale"),
    ("Kaya", "supervision activités"),
    ("Fada N'Gourma", "prospection"),
    ("Dédougou", "réunion partenaires"),
    ("Tenkodogo", "contrôle qualité"),
    ("Ziniaré", "mission de suivi"),
    ("Kongoussi", "audit terrain"),
]

OBJETS_MISSION = [
    "Formation des agents sur les nouvelles procédures opérationnelles",
    "Visite de chantier et supervision des travaux",
    "Audit et contrôle des activités régionales",
    "Accompagnement client et livraison sur site",
    "Participation à une foire commerciale régionale",
    "Négociation et contractualisation avec des partenaires locaux",
    "Inspection technique des installations",
    "Atelier de renforcement des capacités du personnel de terrain",
    "Réunion de coordination avec les délégués régionaux",
    "Prospection commerciale et développement du portefeuille client",
    "Mission de sensibilisation et communication institutionnelle",
    "Supervision de la distribution des équipements",
]

DESIGNATIONS_ITEMS = [
    ("Frais de transport aller-retour", "Prestataire transport"),
    ("Hébergement en hôtel (nuitées)", "Hôtel / résidence"),
    ("Restauration (repas journaliers)", "Traiteur / restaurant"),
    ("Location de salle de réunion", "Centre de conférences"),
    ("Location de véhicule avec chauffeur", "Agence de location"),
    ("Carburant et péages", "Station-service"),
    ("Honoraires formateur/consultant", "Cabinet conseil"),
    ("Impression et reprographie", "Imprimerie locale"),
    ("Matériel de présentation / fournitures", "Papeterie"),
    ("Communication téléphonique et internet", "Opérateur télécoms"),
]


class Command(BaseCommand):
    help = "Charge des fiches externes de mission (prestataires + personnel interne)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Supprime toutes les fiches de mission existantes avant de créer",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=15,
            help="Nombre de fiches de mission à créer (défaut: 15)",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            fm_count = FicheMission.objects.count()
            fe_count = FicheExterne.objects.filter(
                pk__in=FicheMission.objects.exclude(fiche_externe_id=None)
                .values_list("fiche_externe_id", flat=True)
            ).count()
            FicheMission.objects.all().delete()
            self.stdout.write(self.style.WARNING(
                f"{fm_count} fiches mission supprimées ({fe_count} fiches externes liées conservées)."
            ))

        # ── Récupération des utilisateurs ─────────────────────────────────
        all_employees = list(User.objects.filter(
            role__in=[Role.COLLABORATEUR, Role.MANAGER], is_active=True
        ))
        agents_liaison = list(User.objects.filter(is_agent_liaison=True, is_active=True))
        creators = list(User.objects.filter(
            role__in=[Role.ADMIN, Role.DAF, Role.MANAGER], is_active=True
        ))
        rh_users = list(User.objects.filter(is_rh=True, is_active=True))
        departments = list(Department.objects.all())

        if not all_employees or not departments:
            self.stdout.write(self.style.ERROR("Pas assez d'utilisateurs ou de départements."))
            return

        if not creators:
            creators = all_employees

        # Auteur par défaut pour les fiches externes
        default_creator = (
            User.objects.filter(role=Role.ADMIN).first()
            or User.objects.filter(role=Role.MANAGER).first()
            or all_employees[0]
        )

        statuts_workflow = [
            FicheMissionStatus.DRAFT,
            FicheMissionStatus.PENDING_MANAGER,
            FicheMissionStatus.PENDING_DAF,
            FicheMissionStatus.PENDING_DG,
            FicheMissionStatus.APPROVED,
            FicheMissionStatus.REJECTED,
            FicheMissionStatus.IN_PROGRESS,
            FicheMissionStatus.DONE,
        ]
        statuts_fiche_ext = [
            FicheExterneStatus.DRAFT,
            FicheExterneStatus.PENDING_MANAGER,
            FicheExterneStatus.PENDING_DIRECTOR,
            FicheExterneStatus.APPROVED,
            FicheExterneStatus.REJECTED,
        ]
        weights_mission = [0.08, 0.10, 0.10, 0.10, 0.20, 0.07, 0.10, 0.25]

        created_fiches_ext = 0
        created_missions   = 0
        nb = options["count"]

        for i in range(nb):
            # ── Choix du type : prestataire externe ou personnel interne ──
            is_external = random.random() < 0.45  # 45 % prestataire externe

            destination, context = random.choice(DESTINATIONS)
            objet = random.choice(OBJETS_MISSION)
            creator = random.choice(creators)
            department = random.choice(departments)
            statut_mission = random.choices(statuts_workflow, weights=weights_mission)[0]
            statut_fiche_ext = random.choice(statuts_fiche_ext)

            days_ago = random.randint(5, 120)
            mission_date = date.today() - timedelta(days=days_ago)
            duration = random.randint(1, 7)
            date_debut = mission_date
            date_fin = date_debut + timedelta(days=duration)

            hebergement  = Decimal(str(random.randint(0, 5) * 10000))
            restauration = Decimal(str(random.randint(1, 5) * 5000))
            transport    = Decimal(str(random.randint(1, 10) * 10000))
            autres       = Decimal(str(random.randint(0, 3) * 5000))

            # ── Créer la FicheExterne liée ────────────────────────────────
            fiche_ext = FicheExterne.objects.create(
                created_by=creator,
                department=department,
                status=statut_fiche_ext,
                notes=f"Fiche de mission — {destination} ({context}).",
            )
            created_fiches_ext += 1

            # Ajouter 1 à 3 items à la fiche externe
            nb_items = random.randint(1, 3)
            for j in range(nb_items):
                design, affect_type = random.choice(DESIGNATIONS_ITEMS)
                if is_external:
                    presta_nom, presta_type = random.choice(PRESTATAIRES_EXTERNES)
                    affectation = presta_nom
                else:
                    beneficiaire = random.choice(all_employees)
                    affectation = f"{beneficiaire.get_full_name() or beneficiaire.username} ({beneficiaire.fonction or 'Agent'})"
                date_req = date_debut + timedelta(days=j)
                montant = Decimal(str(random.randint(50, 500) * 1000))
                FicheExterneItem.objects.create(
                    fiche=fiche_ext,
                    designation=design,
                    quantity=1,
                    affectation=affectation,
                    date_requise=date_req,
                    montant_prestataire=montant,
                )

            # ── Créer la FicheMission liée ────────────────────────────────
            mission = FicheMission(
                date=mission_date,
                destination=destination,
                objet_mission=objet,
                date_debut=date_debut,
                date_fin=date_fin,
                hebergement=hebergement,
                restauration=restauration,
                transport_aller_retour=transport,
                autres_frais=autres,
                status=statut_mission,
                department=department,
                fiche_externe_id=fiche_ext.pk,
                notes=f"Mission liée à la fiche externe FE-{fiche_ext.pk:05d}.",
                created_by=creator,
            )

            if is_external:
                # Prestataire externe
                presta_nom, presta_type = random.choice(PRESTATAIRES_EXTERNES)
                mission.prestataire_nom = presta_nom
                mission.nom_prenom = presta_nom
                mission.fonction = presta_type
                mission.matricule_display = ""
            else:
                # Membre du personnel
                beneficiaire = random.choice(all_employees)
                mission.beneficiaire = beneficiaire
                mission.nom_prenom = beneficiaire.get_full_name() or beneficiaire.username
                mission.matricule_display = beneficiaire.matricule or ""
                mission.fonction = beneficiaire.fonction or "Collaborateur"

            # Affecter un agent de liaison si disponible
            if agents_liaison and random.random() > 0.4:
                mission.agent_liaison = random.choice(agents_liaison)

            mission.save()
            created_missions += 1

        self.stdout.write(self.style.SUCCESS(
            f"Créé : {created_fiches_ext} fiches externes + "
            f"{created_missions} fiches de mission liées.\n"
            f"  dont ≈ {int(nb * 0.45)} avec prestataires externes, "
            f"≈ {int(nb * 0.55)} avec personnel interne."
        ))
