"""
Commande Django pour charger des données de test pour les Bons de Commande.

Usage:
    python manage.py seed_bons_commande
    python manage.py seed_bons_commande --clear  # Supprime d'abord les données existantes
"""

import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User, Role
from apps.bons_commande.models import BonCommande, BonCommandeStatus, FactureProforma


FOURNISSEURS = [
    "BURKINA OFFICE",
    "SONABEL",
    "ONATEL",
    "AZIZ INFORMATIQUE",
    "TOTAL MARKETING BURKINA",
    "ETABLISSEMENTS COULIBALY",
    "SOFITEX DISTRIBUTION",
    "OUAGA PAPETERIE",
    "TECHNO PLUS",
    "GREEN SOLUTIONS BF",
]

OBJETS = [
    "Fournitures de bureau et consommables informatiques",
    "Maintenance et réparation des équipements de bureau",
    "Achat de mobilier de bureau",
    "Acquisition de matériels informatiques (ordinateurs, imprimantes)",
    "Abonnement téléphonique et internet",
    "Carburant et frais de transport",
    "Frais de reprographie et impression",
    "Achat de matériaux de construction",
    "Prestation de nettoyage et entretien des locaux",
    "Formation du personnel sur les outils informatiques",
    "Acquisition de climatiseurs et équipements électriques",
    "Services de gardiennage",
]

STATUTS_WORKFLOW = [
    BonCommandeStatus.DRAFT,
    BonCommandeStatus.PENDING_DAF,
    BonCommandeStatus.PENDING_DG,
    BonCommandeStatus.APPROVED,
    BonCommandeStatus.REJECTED,
    BonCommandeStatus.IN_EXECUTION,
    BonCommandeStatus.DONE,
]


class Command(BaseCommand):
    help = "Charge des données de test pour les Bons de Commande"

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
            help="Nombre de bons de commande à créer (défaut: 20)",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            count = BonCommande.objects.count()
            BonCommande.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"{count} bons de commande supprimés."))

        # Récupérer les utilisateurs par rôle
        admin = User.objects.filter(role=Role.ADMIN).first()
        daf = User.objects.filter(role=Role.DAF).first()
        dg = User.objects.filter(role=Role.DIRECTOR).first()
        creators = list(User.objects.filter(role__in=[Role.ADMIN, Role.DAF, Role.MANAGER]))

        if not creators:
            self.stdout.write(self.style.ERROR("Aucun utilisateur trouvé. Créez d'abord des utilisateurs."))
            return

        created_count = 0
        nb = options["count"]

        for i in range(nb):
            creator = random.choice(creators)
            objet = random.choice(OBJETS)
            # Date aléatoire dans les 6 derniers mois
            days_ago = random.randint(1, 180)
            bon_date = date.today() - timedelta(days=days_ago)

            # Choisir un statut avec distribution réaliste
            weights = [0.15, 0.10, 0.10, 0.20, 0.10, 0.15, 0.20]
            statut = random.choices(STATUTS_WORKFLOW, weights=weights)[0]

            bon = BonCommande(
                date=bon_date,
                objet=objet,
                reference=f"REF-{random.randint(1000, 9999)}" if random.random() > 0.4 else "",
                status=statut,
                notes="Données de test générées automatiquement." if random.random() > 0.6 else "",
                created_by=creator,
            )

            # Approbations selon le statut
            if statut in (
                BonCommandeStatus.PENDING_DG,
                BonCommandeStatus.APPROVED,
                BonCommandeStatus.REJECTED,
                BonCommandeStatus.IN_EXECUTION,
                BonCommandeStatus.DONE,
            ) and daf:
                bon.daf_approuve_par = daf
                bon.daf_approuve_le = timezone.now() - timedelta(days=random.randint(1, 30))
                bon.daf_commentaire = "Approuvé." if statut != BonCommandeStatus.REJECTED else "Dossier incomplet."

            if statut in (
                BonCommandeStatus.APPROVED,
                BonCommandeStatus.IN_EXECUTION,
                BonCommandeStatus.DONE,
            ) and dg:
                bon.dg_approuve_par = dg
                bon.dg_approuve_le = timezone.now() - timedelta(days=random.randint(1, 20))
                bon.dg_commentaire = "Approuvé pour exécution."

            bon.save()  # génère le numéro

            # Ajouter des factures proforma (1 à 3 par bon)
            nb_proformas = random.randint(1, 3)
            proformas = []
            for j in range(nb_proformas):
                montant = Decimal(str(random.randint(50, 5000) * 1000))
                proforma = FactureProforma.objects.create(
                    bon_commande=bon,
                    fournisseur_nom=random.choice(FOURNISSEURS),
                    reference=f"PRO-{random.randint(100, 999)}-{j+1}",
                    montant=montant,
                    uploaded_by=creator,
                    notes="",
                )
                proformas.append(proforma)

            # Sélectionner un fournisseur si approuvé ou plus
            if statut in (
                BonCommandeStatus.APPROVED,
                BonCommandeStatus.IN_EXECUTION,
                BonCommandeStatus.DONE,
            ) and proformas:
                bon.fournisseur_selectionne = random.choice(proformas)
                bon.save(update_fields=["fournisseur_selectionne"])

            created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"{created_count} bons de commande créés avec succès "
                f"(avec factures proforma)."
            )
        )
