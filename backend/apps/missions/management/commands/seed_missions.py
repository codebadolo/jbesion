"""
Commande Django pour charger des données de test pour les Fiches de Mission.

Usage:
    python manage.py seed_missions
    python manage.py seed_missions --clear  # Supprime d'abord les données existantes
"""

import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User, Role
from apps.departments.models import Department
from apps.missions.models import (
    AbsenceAgent,
    AbsenceStatus,
    FicheMission,
    FicheMissionStatus,
    MotifAbsence,
)


DESTINATIONS = [
    "Bobo-Dioulasso",
    "Koudougou",
    "Banfora",
    "Ouahigouya",
    "Kaya",
    "Dédougou",
    "Fada N'Gourma",
    "Tenkodogo",
    "Gaoua",
    "Manga",
    "Ziniaré",
    "Kongoussi",
]

OBJETS_MISSION = [
    "Visite de clients et prospection commerciale",
    "Formation sur les nouvelles procédures comptables",
    "Audit et contrôle des activités régionales",
    "Réunion de coordination avec les partenaires locaux",
    "Supervision des travaux sur le site",
    "Atelier de renforcement des capacités",
    "Accompagnement d'un client lors de la livraison",
    "Participation à une foire commerciale",
    "Inspection technique des équipements",
    "Négociation avec des fournisseurs locaux",
]

FONCTIONS = [
    "Comptable",
    "Chargé de clientèle",
    "Ingénieur technique",
    "Responsable commercial",
    "Auditeur interne",
    "Chargé de formation",
    "Technicien de maintenance",
    "Responsable logistique",
]

STATUTS_WORKFLOW = [
    FicheMissionStatus.DRAFT,
    FicheMissionStatus.PENDING_MANAGER,
    FicheMissionStatus.PENDING_DAF,
    FicheMissionStatus.PENDING_DG,
    FicheMissionStatus.APPROVED,
    FicheMissionStatus.REJECTED,
    FicheMissionStatus.IN_PROGRESS,
    FicheMissionStatus.DONE,
]


class Command(BaseCommand):
    help = "Charge des données de test pour les Fiches de Mission et Absences"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Supprime toutes les données existantes avant d'en créer de nouvelles",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=20,
            help="Nombre de fiches de mission à créer (défaut: 20)",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            count_m = FicheMission.objects.count()
            count_a = AbsenceAgent.objects.count()
            FicheMission.objects.all().delete()
            AbsenceAgent.objects.all().delete()
            self.stdout.write(
                self.style.WARNING(
                    f"{count_m} fiches de mission et {count_a} absences supprimées."
                )
            )

        # Récupérer utilisateurs et départements
        employees = list(User.objects.filter(role__in=[Role.EMPLOYEE, Role.MANAGER]))
        managers = list(User.objects.filter(role=Role.MANAGER))
        creators = list(User.objects.filter(role__in=[Role.ADMIN, Role.DAF, Role.MANAGER]))
        agents_liaison = list(User.objects.filter(is_agent_liaison=True))
        departments = list(Department.objects.all())

        if not employees or not departments:
            self.stdout.write(
                self.style.ERROR("Aucun employé ou département trouvé.")
            )
            return

        if not creators:
            creators = employees

        created_missions = 0
        nb = options["count"]

        for i in range(nb):
            beneficiaire = random.choice(employees)
            creator = random.choice(creators)
            department = random.choice(departments)

            # Dates de mission
            days_ago = random.randint(5, 150)
            mission_date = date.today() - timedelta(days=days_ago)
            duration = random.randint(1, 7)
            date_debut = mission_date
            date_fin = date_debut + timedelta(days=duration)

            # Frais
            hebergement = Decimal(str(random.randint(0, 5) * 10000))
            restauration = Decimal(str(random.randint(1, 5) * 5000))
            transport = Decimal(str(random.randint(1, 10) * 10000))
            autres = Decimal(str(random.randint(0, 3) * 5000))

            # Statut avec distribution réaliste
            weights = [0.10, 0.10, 0.10, 0.10, 0.20, 0.10, 0.10, 0.20]
            statut = random.choices(STATUTS_WORKFLOW, weights=weights)[0]

            mission = FicheMission(
                date=mission_date,
                beneficiaire=beneficiaire,
                nom_prenom=beneficiaire.get_full_name() or beneficiaire.username,
                matricule_display=beneficiaire.matricule or "",
                fonction=beneficiaire.fonction or random.choice(FONCTIONS),
                destination=random.choice(DESTINATIONS),
                objet_mission=random.choice(OBJETS_MISSION),
                date_debut=date_debut,
                date_fin=date_fin,
                hebergement=hebergement,
                restauration=restauration,
                transport_aller_retour=transport,
                autres_frais=autres,
                status=statut,
                department=department,
                notes="Données de test." if random.random() > 0.7 else "",
                created_by=creator,
            )

            # Affecter un agent de liaison si disponible
            if agents_liaison and random.random() > 0.5:
                mission.agent_liaison = random.choice(agents_liaison)

            mission.save()
            created_missions += 1

        # Créer des absences pour les agents de liaison
        created_absences = 0
        if agents_liaison:
            for agent in agents_liaison:
                nb_absences = random.randint(1, 3)
                for _ in range(nb_absences):
                    days_ago = random.randint(1, 120)
                    debut = date.today() - timedelta(days=days_ago)
                    fin = debut + timedelta(days=random.randint(1, 5))
                    AbsenceAgent.objects.create(
                        agent=agent,
                        date_debut=debut,
                        date_fin=fin,
                        motif=random.choice(list(MotifAbsence)),
                        description="Absence déclarée (test).",
                        status=random.choice(list(AbsenceStatus)),
                    )
                    created_absences += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"{created_missions} fiches de mission et "
                f"{created_absences} absences créées avec succès."
            )
        )
