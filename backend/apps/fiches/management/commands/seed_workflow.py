"""
Management command: seed_workflow
Usage:
    python manage.py seed_workflow          # Resets tout et recrée les données
    python manage.py seed_workflow --no-reset   # Ajoute sans supprimer

Crée un scénario de workflow bout-en-bout réaliste pour tous les acteurs,
en particulier pour le comptable (nigna.brice / NIGNA Tatié Brice).

Workflow simulé :
  FicheInterne  : DRAFT → PENDING_MANAGER → PENDING_DAF → PENDING_DIRECTOR
                  → APPROVED → IN_EXECUTION → DELIVERED
  FicheExterne  : DRAFT → PENDING_MANAGER → PENDING_DIRECTOR
                  → APPROVED → IN_EXECUTION → DELIVERED
  BonPaiement   : DRAFT → VALIDATED / CANCELLED
  BonCommande   : DRAFT → PENDING_PROFORMA → PENDING_DAF → PENDING_DG
                  → APPROVED → IN_EXECUTION → DONE
  FicheMission  : DRAFT → PENDING_MANAGER → PENDING_DAF → PENDING_DG
                  → APPROVED → IN_PROGRESS → DONE
"""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import Role, User
from apps.bons_commande.models import BonCommande, BonCommandeStatus, FactureProforma
from apps.bons_paiement.models import BonPaiement, BonPaiementItem, BonPaiementStatus, ModePaiement
from apps.departments.models import Department
from apps.fiches.models import (
    FicheExterne, FicheExterneItem, FicheExterneStatus,
    FicheInterne, FicheInterneItem, FicheInterneStatus,
    FicheType, Validation, ValidationStatus,
    Notification,
)
from apps.missions.models import FicheMission, FicheMissionStatus


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _d(delta: int) -> date:
    return date.today() + timedelta(days=delta)


def _val(fiche, fiche_type, validator, role, status, comment=""):
    ct = ContentType.objects.get_for_model(fiche)
    return Validation.objects.create(
        fiche_type=fiche_type,
        content_type=ct,
        object_id=fiche.pk,
        validator=validator,
        role_at_validation=role,
        status=status,
        commentaire=comment,
    )


def _bon_paiement(comptable, beneficiaire_nom, motif, montant, mode,
                  status, fiche=None, fiche_type="", items=None):
    bp = BonPaiement.objects.create(
        date=date.today(),
        beneficiaire=beneficiaire_nom,
        motif=motif,
        mode_paiement=mode,
        montant=Decimal(str(montant)),
        status=status,
        created_by=comptable,
        fiche_type=fiche_type if fiche_type else "",
        fiche_id=fiche.pk if fiche else None,
    )
    for label, amt in (items or []):
        BonPaiementItem.objects.create(bon=bp, designation=label, montant=Decimal(str(amt)))
    return bp


# ─────────────────────────────────────────────────────────────────────────────
# Command
# ─────────────────────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = (
        "Recrée un jeu de données complet (workflow bout-en-bout) "
        "pour fiches, bons et missions."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-reset",
            action="store_true",
            help="Ne pas supprimer les données existantes avant de seeder.",
        )

    def handle(self, *args, **options):
        if not options["no_reset"]:
            self._reset()

        # ── Récupération des acteurs ──────────────────────────────────────
        comptable = User.objects.filter(username="nigna.brice").first()
        if not comptable:
            comptable = User.objects.filter(is_comptable=True).first()

        daf      = User.objects.filter(role=Role.DAF).first()
        director = User.objects.filter(role=Role.DIRECTOR).first()
        managers = list(User.objects.filter(role=Role.MANAGER))
        employees = list(User.objects.filter(role=Role.EMPLOYEE, is_active=True))

        if not (daf and director and managers and employees):
            self.stderr.write(self.style.ERROR(
                "Utilisateurs insuffisants. Lancez d'abord seed_personnel."
            ))
            return

        mgr_com  = next((m for m in managers if m.department and m.department.code == "COM"), managers[0])
        mgr_mkt  = next((m for m in managers if m.department and m.department.code == "MKT"), managers[0])
        mgr_prod = next((m for m in managers if m.department and m.department.code == "PROD"), managers[-1])

        # Quelques employés par département
        def emp_of(mgr):
            if mgr.department:
                e = [u for u in employees if u.department_id == mgr.department_id]
                if e:
                    return e[0], e[1] if len(e) > 1 else e[0]
            return employees[0], employees[1] if len(employees) > 1 else employees[0]

        emp_com1, emp_com2 = emp_of(mgr_com)
        emp_mkt1, emp_mkt2 = emp_of(mgr_mkt)
        emp_prod1, _       = emp_of(mgr_prod)

        dept_af   = Department.objects.filter(code="AF").first()
        dept_com  = mgr_com.department or Department.objects.first()
        dept_mkt  = mgr_mkt.department or Department.objects.first()
        dept_prod = mgr_prod.department or Department.objects.first()

        self.stdout.write(self.style.HTTP_INFO("\n=== FICHES INTERNES ==="))
        self._seed_fi(comptable, daf, director, mgr_com, mgr_mkt, mgr_prod,
                      emp_com1, emp_com2, emp_mkt1, emp_prod1,
                      dept_com, dept_mkt, dept_prod, dept_af)

        self.stdout.write(self.style.HTTP_INFO("\n=== FICHES EXTERNES ==="))
        self._seed_fe(comptable, daf, director, mgr_com, mgr_mkt,
                      emp_com1, emp_mkt1, dept_com, dept_mkt)

        self.stdout.write(self.style.HTTP_INFO("\n=== BONS DE PAIEMENT ==="))
        self._seed_bp(comptable, employees)

        self.stdout.write(self.style.HTTP_INFO("\n=== BONS DE COMMANDE ==="))
        self._seed_bc(comptable, daf, director, dept_af)

        self.stdout.write(self.style.HTTP_INFO("\n=== FICHES MISSION ==="))
        self._seed_fm(comptable, daf, director, mgr_com, mgr_mkt,
                      emp_com1, emp_mkt1, dept_com, dept_mkt)

        self.stdout.write(self.style.SUCCESS(
            "\n✔  Seeding workflow terminé.\n"
            f"   FicheInterne : {FicheInterne.objects.count()}\n"
            f"   FicheExterne : {FicheExterne.objects.count()}\n"
            f"   BonPaiement  : {BonPaiement.objects.count()}\n"
            f"   BonCommande  : {BonCommande.objects.count()}\n"
            f"   FicheMission : {FicheMission.objects.count()}\n"
        ))

    # ─────────────────────────────────────────────────────────────────────
    # RESET
    # ─────────────────────────────────────────────────────────────────────

    def _reset(self):
        self.stdout.write(self.style.WARNING("  Suppression des données existantes…"))
        Notification.objects.all().delete()
        Validation.objects.all().delete()
        FicheInterneItem.objects.all().delete()
        FicheInterne.objects.all().delete()
        FicheExterneItem.objects.all().delete()
        FicheExterne.objects.all().delete()
        BonPaiementItem.objects.all().delete()
        BonPaiement.objects.all().delete()
        FactureProforma.objects.all().delete()
        BonCommande.objects.all().delete()
        FicheMission.objects.all().delete()
        self.stdout.write("  Suppression terminée.\n")

    # ─────────────────────────────────────────────────────────────────────
    # FICHES INTERNES
    # ─────────────────────────────────────────────────────────────────────

    def _seed_fi(self, comptable, daf, director, mgr_com, mgr_mkt, mgr_prod,
                 emp_com1, emp_com2, emp_mkt1, emp_prod1,
                 dept_com, dept_mkt, dept_prod, dept_af):

        def fi(creator, dept, status, notes, items):
            f = FicheInterne.objects.create(
                created_by=creator, department=dept, status=status, notes=notes)
            for des, qty, days, amt in items:
                FicheInterneItem.objects.create(
                    fiche=f, designation=des, quantity=qty,
                    date_requise=_d(days), montant=Decimal(str(amt)) if amt else None)
            self.stdout.write(f"  [FI-{f.pk:04d}] {status:30s} | {creator.username}")
            return f

        # 1. BROUILLON — jamais soumis
        fi(emp_com1, dept_com, FicheInterneStatus.DRAFT,
           "Brouillon — fournitures de bureau Q2",
           [("Ramettes papier A4 (x10)", 10, 30, 4500),
            ("Stylos bille bleu (boîte 50)", 3, 30, 850),
            ("Classeurs à levier A4", 5, 30, 750)])

        # 2. EN ATTENTE MANAGER
        fi(emp_com2, dept_com, FicheInterneStatus.PENDING_MANAGER,
           "Besoin informatique urgent — accessoires",
           [("Clé USB 64 Go", 4, 10, 1200),
            ("Souris optique sans fil", 3, 10, 2500),
            ("Câble HDMI 2m", 2, 10, 800)])

        fi(emp_mkt1, dept_mkt, FicheInterneStatus.PENDING_MANAGER,
           "Matériel événementiel — Salon SIAO 2026",
           [("Roll-up 80×200 cm (impression)", 3, 20, 18000),
            ("Kakémonos A1 (lot de 5)", 2, 20, 12000),
            ("Bâches publicitaires 2×1 m", 4, 20, 8500)])

        # 3. EN ATTENTE DAF (validé par manager)
        fi3 = fi(emp_com1, dept_com, FicheInterneStatus.PENDING_DAF,
                 "Cartouches et consommables imprimante",
                 [("Cartouche HP 304 Noir", 6, 7, 2200),
                  ("Cartouche HP 304 Couleur", 4, 7, 2800),
                  ("Papier photo A4 glossy (x100)", 2, 7, 1500)])
        _val(fi3, FicheType.INTERNE, mgr_com, Role.MANAGER,
             ValidationStatus.APPROVED, "Besoin confirmé, conforme au stock.")

        fi4 = fi(emp_prod1, dept_prod, FicheInterneStatus.PENDING_DAF,
                 "Équipements de protection individuelle (EPI)",
                 [("Casques de chantier (jaune)", 10, 5, 3500),
                  ("Gilets de sécurité fluorescents", 10, 5, 2200),
                  ("Gants de manutention (paires)", 20, 5, 800)])
        _val(fi4, FicheType.INTERNE, mgr_prod, Role.MANAGER,
             ValidationStatus.APPROVED, "EPI obligatoires réglementaires.")

        # 4. EN ATTENTE DIRECTEUR (validé par manager + DAF)
        fi5 = fi(emp_mkt1, dept_mkt, FicheInterneStatus.PENDING_DIRECTOR,
                 "Matériel informatique — renouvellement postes marketing",
                 [("Ordinateur portable Dell 15s (i5/16Go)", 2, 15, 245000),
                  ("Écran 27 pouces IPS 4K", 2, 15, 95000),
                  ("Disque SSD externe 1 To", 2, 15, 35000)])
        _val(fi5, FicheType.INTERNE, mgr_mkt, Role.MANAGER,
             ValidationStatus.APPROVED, "Matériel obsolète, renouvellement justifié.")
        _val(fi5, FicheType.INTERNE, daf, Role.DAF,
             ValidationStatus.APPROVED, "Budget IT Q2 disponible — FCFA 575 000 validés.")

        fi6 = fi(emp_com2, dept_com, FicheInterneStatus.PENDING_DIRECTOR,
                 "Mobilier de bureau — salle de réunion",
                 [("Chaises de conférence ergonomiques", 8, 20, 22000),
                  ("Table de réunion 10 places", 1, 20, 185000),
                  ("Tableau blanc 120×90 cm + accessoires", 1, 20, 18500)])
        _val(fi6, FicheType.INTERNE, mgr_com, Role.MANAGER,
             ValidationStatus.APPROVED, "Mobilier actuel très dégradé.")
        _val(fi6, FicheType.INTERNE, daf, Role.DAF,
             ValidationStatus.APPROVED, "Enveloppe budget mobilier suffisante.")

        # 5. APPROUVÉE — en attente d'exécution par le comptable
        fi7 = fi(emp_com1, dept_com, FicheInterneStatus.APPROVED,
                 "Fournitures de bureau trimestrielles — depts COM/AF",
                 [("Ramettes papier A4 80g (carton de 5)", 6, 3, 4500),
                  ("Stylos bille bleu (carton 12 boîtes)", 2, 3, 850),
                  ("Chemises cartonnées (boîte de 100)", 3, 3, 2800),
                  ("Post-it bloc (x12)", 4, 3, 600)])
        _val(fi7, FicheType.INTERNE, mgr_com, Role.MANAGER,
             ValidationStatus.APPROVED, "Besoin trimestriel récurrent.")
        _val(fi7, FicheType.INTERNE, daf, Role.DAF,
             ValidationStatus.APPROVED, "Validé dans l'enveloppe budgétaire.")
        _val(fi7, FicheType.INTERNE, director, Role.DIRECTOR,
             ValidationStatus.APPROVED, "Approuvé.")

        fi8 = fi(emp_mkt1, dept_mkt, FicheInterneStatus.APPROVED,
                 "Imprimante laser A4 — service marketing",
                 [("Imprimante laser HP LaserJet Pro M404n", 1, 5, 78000),
                  ("Toner HP CF259A (lot de 2)", 2, 5, 12500)])
        _val(fi8, FicheType.INTERNE, mgr_mkt, Role.MANAGER,
             ValidationStatus.APPROVED, "Remplacement imprimante HS.")
        _val(fi8, FicheType.INTERNE, daf, Role.DAF,
             ValidationStatus.APPROVED, "OK budget équipements.")
        _val(fi8, FicheType.INTERNE, director, Role.DIRECTOR,
             ValidationStatus.APPROVED, "Approuvé.")

        fi9 = fi(emp_prod1, dept_prod, FicheInterneStatus.APPROVED,
                 "Outillage atelier de production",
                 [("Perceuse-visseuse sans fil Makita", 2, 7, 45000),
                  ("Caisse à outils complète (200 pcs)", 1, 7, 35000),
                  ("Meuleuse angulaire 125 mm", 1, 7, 28000)])
        _val(fi9, FicheType.INTERNE, mgr_prod, Role.MANAGER,
             ValidationStatus.APPROVED, "Outillage indispensable production.")
        _val(fi9, FicheType.INTERNE, daf, Role.DAF,
             ValidationStatus.APPROVED, "Budget production validé.")
        _val(fi9, FicheType.INTERNE, director, Role.DIRECTOR,
             ValidationStatus.APPROVED, "Approuvé.")

        # 6. EN EXECUTION — comptable a lancé l'exécution
        fi10 = fi(emp_com2, dept_com, FicheInterneStatus.IN_EXECUTION,
                  "Accessoires audiovisuels — salle de conférence",
                  [("Projecteur Full HD 3500 lumens", 1, 0, 95000),
                   ("Écran de projection 120\" motorisé", 1, 0, 48000),
                   ("Système de sonorisation 2×50W", 1, 0, 32000)])
        _val(fi10, FicheType.INTERNE, mgr_com, Role.MANAGER,
             ValidationStatus.APPROVED, "Indispensable pour les présentations clients.")
        _val(fi10, FicheType.INTERNE, daf, Role.DAF,
             ValidationStatus.APPROVED, "Budget investi conforme.")
        _val(fi10, FicheType.INTERNE, director, Role.DIRECTOR,
             ValidationStatus.APPROVED, "Approuvé.")
        fi10.executed_by = comptable
        fi10.executed_at = timezone.now()
        fi10.execution_fournisseur = "AZIZ INFORMATIQUE"
        fi10.execution_reference = "FACT-2026-0341"
        fi10.execution_montant = Decimal("175000")
        fi10.execution_mode_paiement = "CHEQUE"
        fi10.execution_numero_facture = "AZI-2026-0341"
        fi10.save()
        # Bon de paiement lié
        _bon_paiement(
            comptable, "AZIZ INFORMATIQUE",
            "Paiement fourniture audiovisuelle — salle conférence",
            175000, ModePaiement.CHEQUE, BonPaiementStatus.VALIDATED,
            fiche=fi10, fiche_type=FicheType.INTERNE,
            items=[("Projecteur Full HD 3500 lumens", 95000),
                   ("Écran de projection 120\" motorisé", 48000),
                   ("Système de sonorisation 2×50W", 32000)])

        fi11 = fi(emp_mkt1, dept_mkt, FicheInterneStatus.IN_EXECUTION,
                  "Toners et consommables imprimantes — recharge trimestrielle",
                  [("Toner Samsung MLT-D111S (x5)", 5, 0, 8500),
                   ("Toner HP CF283A (x3)", 3, 0, 11000),
                   ("Tambour OPC HP CB435A (x2)", 2, 0, 14000)])
        _val(fi11, FicheType.INTERNE, mgr_mkt, Role.MANAGER,
             ValidationStatus.APPROVED, "Besoin récurrent.")
        _val(fi11, FicheType.INTERNE, daf, Role.DAF,
             ValidationStatus.APPROVED, "OK.")
        _val(fi11, FicheType.INTERNE, director, Role.DIRECTOR,
             ValidationStatus.APPROVED, "Approuvé.")
        fi11.executed_by = comptable
        fi11.executed_at = timezone.now()
        fi11.execution_fournisseur = "OUAGA PAPETERIE"
        fi11.execution_reference = "FAC-OP-2026-0089"
        fi11.execution_montant = Decimal("98500")
        fi11.execution_mode_paiement = "ESPECE"
        fi11.save()
        _bon_paiement(
            comptable, "OUAGA PAPETERIE",
            "Achat toners et consommables imprimantes Q2",
            98500, ModePaiement.ESPECE, BonPaiementStatus.VALIDATED,
            fiche=fi11, fiche_type=FicheType.INTERNE,
            items=[("Toner Samsung MLT-D111S ×5", 42500),
                   ("Toner HP CF283A ×3", 33000),
                   ("Tambour OPC HP CB435A ×2", 28000)])

        # 7. LIVRÉE (cycle complet)
        fi12 = fi(emp_com1, dept_com, FicheInterneStatus.DELIVERED,
                  "Câblage réseau — rénovation bureau COM",
                  [("Câble RJ45 Cat6 (bobine 100 m)", 3, -10, 12000),
                   ("Prises réseau RJ45 encastrables (lot 20)", 4, -10, 2500),
                   ("Switch réseau 24 ports Gigabit", 1, -10, 38000)])
        _val(fi12, FicheType.INTERNE, mgr_com, Role.MANAGER,
             ValidationStatus.APPROVED, "Travaux réseau urgents.")
        _val(fi12, FicheType.INTERNE, daf, Role.DAF,
             ValidationStatus.APPROVED, "Validé.")
        _val(fi12, FicheType.INTERNE, director, Role.DIRECTOR,
             ValidationStatus.APPROVED, "Approuvé.")
        fi12.executed_by = comptable
        fi12.executed_at = timezone.now() - timedelta(days=12)
        fi12.execution_fournisseur = "TECHNO PLUS"
        fi12.execution_reference = "TP-FAC-2026-0212"
        fi12.execution_montant = Decimal("84000")
        fi12.execution_mode_paiement = "CHEQUE"
        fi12.received_at = timezone.now() - timedelta(days=5)
        fi12.save()
        _bon_paiement(
            comptable, "TECHNO PLUS",
            "Câblage réseau bureau COM — livraison confirmée",
            84000, ModePaiement.CHEQUE, BonPaiementStatus.VALIDATED,
            fiche=fi12, fiche_type=FicheType.INTERNE,
            items=[("Câble RJ45 Cat6 ×3 bobines", 36000),
                   ("Prises réseau RJ45 ×4 lots", 10000),
                   ("Switch 24 ports Gigabit", 38000)])

        # 8. REJETÉE
        fi13 = fi(emp_mkt1, dept_mkt, FicheInterneStatus.REJECTED,
                  "Achat drone DJI Mavic 3 — reportage terrain",
                  [("Drone DJI Mavic 3 Pro + accessoires", 1, 30, 550000)])
        _val(fi13, FicheType.INTERNE, mgr_mkt, Role.MANAGER,
             ValidationStatus.REJECTED,
             "Investissement non budgétisé — reporter au prochain exercice.")

        # 9. CLARIFICATION DAF → en attente réponse
        fi14 = fi(emp_prod1, dept_prod, FicheInterneStatus.PENDING_CLARIFICATION_DAF,
                  "Groupe électrogène 10 KVA — atelier production",
                  [("Groupe électrogène PERKINS 10 KVA", 1, 14, 850000),
                   ("Câbles électriques 10mm² (50 m)", 2, 14, 18000)])
        _val(fi14, FicheType.INTERNE, mgr_prod, Role.MANAGER,
             ValidationStatus.APPROVED, "Coupures fréquentes, productivité impactée.")
        _val(fi14, FicheType.INTERNE, daf, Role.DAF,
             ValidationStatus.CLARIFICATION_REQUESTED,
             "Merci de fournir 3 devis comparatifs et justifier le choix du fournisseur.")

    # ─────────────────────────────────────────────────────────────────────
    # FICHES EXTERNES
    # ─────────────────────────────────────────────────────────────────────

    def _seed_fe(self, comptable, daf, director, mgr_com, mgr_mkt,
                 emp_com1, emp_mkt1, dept_com, dept_mkt):

        def fe(creator, dept, status, notes, items):
            f = FicheExterne.objects.create(
                created_by=creator, department=dept, status=status, notes=notes)
            for des, qty, affect, days, mp, mc in items:
                FicheExterneItem.objects.create(
                    fiche=f, designation=des, quantity=qty, affectation=affect,
                    date_requise=_d(days),
                    montant_prestataire=Decimal(str(mp)),
                    montant_client=Decimal(str(mc)) if mc else None)
            self.stdout.write(f"  [FE-{f.pk:04d}] {status:30s} | {creator.username}")
            return f

        # 1. Brouillon
        fe(emp_com1, dept_com, FicheExterneStatus.DRAFT,
           "Prestation vidéo — tournage film institutionnel",
           [("Tournage + réalisation (1 journée)", 1, "VIDEOPLUS OUAGA",  30, 150000, 220000),
            ("Montage + post-production",           1, "VIDEOPLUS OUAGA",  45, 80000, 120000),
            ("Livraison fichiers HD + DVD",         1, "VIDEOPLUS OUAGA",  50, 15000,  25000)])

        # 2. En attente manager
        fe2 = fe(emp_com2 := emp_com1, dept_com, FicheExterneStatus.PENDING_MANAGER,
                 "Campagne publicité digitale — Facebook & Instagram Q2",
                 [("Création 5 visuels publicitaires",      5, "MEDIADIGITAL BF",   10, 15000, 22000),
                  ("Gestion campagne pub 30 jours",          1, "MEDIADIGITAL BF",   10, 85000, 120000),
                  ("Rapport de performance mensuel",         1, "MEDIADIGITAL BF",   40, 12000, 18000)])

        # 3. En attente directeur (validé manager)
        fe3 = fe(emp_mkt1, dept_mkt, FicheExterneStatus.PENDING_DIRECTOR,
                 "Développement application mobile Android & iOS",
                 [("Analyse & conception UX/UI",         1, "SOFTECH SOLUTIONS",   15, 350000, 500000),
                  ("Développement app (3 mois)",          3, "SOFTECH SOLUTIONS",   90, 800000, 1200000),
                  ("Tests & déploiement",                  1, "SOFTECH SOLUTIONS",  100, 150000,  250000),
                  ("Maintenance 12 mois",                  1, "SOFTECH SOLUTIONS",  110, 200000,  320000)])
        _val(fe3, FicheType.EXTERNE, mgr_mkt, Role.MANAGER,
             ValidationStatus.APPROVED, "Prestataire certifié, offre technique solide.")

        fe4 = fe(emp_com1, dept_com, FicheExterneStatus.PENDING_DIRECTOR,
                 "Formation — Gestion projet & Outils Bureautiques",
                 [("Formation gestion de projet (2 jours, 10 agents)", 1, "AZIZ CONSULTING", 20, 250000, 350000),
                  ("Support pédagogique + attestations",                1, "AZIZ CONSULTING", 22, 35000,  55000)])
        _val(fe4, FicheType.EXTERNE, mgr_com, Role.MANAGER,
             ValidationStatus.APPROVED, "Formation prioritaire pour renforcement des équipes.")

        # 4. APPROUVÉE — en attente d'exécution comptable
        fe5 = fe(emp_mkt1, dept_mkt, FicheExterneStatus.APPROVED,
                 "Audit de communication — stratégie digitale 2026",
                 [("Diagnostic communication existante",   1, "COMSTRAT CONSEILS",   5, 120000, 180000),
                  ("Plan stratégique digital 12 mois",      1, "COMSTRAT CONSEILS",  15, 200000, 300000),
                  ("Présentation restitution direction",    1, "COMSTRAT CONSEILS",  20,  50000,  80000)])
        _val(fe5, FicheType.EXTERNE, mgr_mkt, Role.MANAGER,
             ValidationStatus.APPROVED, "Audit indispensable avant plan marketing annuel.")
        _val(fe5, FicheType.EXTERNE, director, Role.DIRECTOR,
             ValidationStatus.APPROVED, "Approuvé — budget communication disponible.")

        fe6 = fe(emp_com1, dept_com, FicheExterneStatus.APPROVED,
                 "Impression catalogues commerciaux 2026",
                 [("Catalogue A4 couleur 20 pages (x500 ex.)", 500, "IMPRIMERIE PRESTIGE BF",  7, 450, 650),
                  ("Flyers A5 recto/verso (x2000 ex.)",        2000, "IMPRIMERIE PRESTIGE BF", 7, 120, 180)])
        _val(fe6, FicheType.EXTERNE, mgr_com, Role.MANAGER,
             ValidationStatus.APPROVED, "Matériel commercial pour prospection Q2.")
        _val(fe6, FicheType.EXTERNE, director, Role.DIRECTOR,
             ValidationStatus.APPROVED, "Approuvé.")

        # 5. EN EXECUTION
        fe7 = fe(emp_com1, dept_com, FicheExterneStatus.IN_EXECUTION,
                 "Maintenance réseau & sécurité informatique",
                 [("Audit sécurité réseau LAN/WAN",         1, "CYBER SOLUTIONS BF",   0, 180000, 250000),
                  ("Installation firewall + configuration",   1, "CYBER SOLUTIONS BF",   0, 120000, 170000),
                  ("Formation administrateur réseau (1 jr)",  1, "CYBER SOLUTIONS BF",   0,  45000,  70000)])
        _val(fe7, FicheType.EXTERNE, mgr_com, Role.MANAGER,
             ValidationStatus.APPROVED, "Sécurité réseau prioritaire suite incident.")
        _val(fe7, FicheType.EXTERNE, director, Role.DIRECTOR,
             ValidationStatus.APPROVED, "Approuvé — urgent.")
        fe7.executed_by = comptable
        fe7.executed_at = timezone.now()
        fe7.execution_fournisseur = "CYBER SOLUTIONS BF"
        fe7.execution_reference = "CSB-FAC-2026-0154"
        fe7.execution_montant = Decimal("345000")
        fe7.execution_mode_paiement = "CHEQUE"
        fe7.execution_numero_facture = "CSB-2026-0154"
        fe7.save()
        _bon_paiement(
            comptable, "CYBER SOLUTIONS BF",
            "Prestation sécurité informatique — audit + firewall + formation",
            345000, ModePaiement.CHEQUE, BonPaiementStatus.VALIDATED,
            fiche=fe7, fiche_type=FicheType.EXTERNE,
            items=[("Audit sécurité réseau", 250000),
                   ("Installation firewall", 170000),
                   ("Formation administrateur réseau", 70000)])

        # 6. LIVRÉE
        fe8 = fe(emp_mkt1, dept_mkt, FicheExterneStatus.DELIVERED,
                 "Conception & impression affiches événement annuel Jofe",
                 [("Design affiches A2 + A3 (5 formats)", 5, "GRAPHIX STUDIO",  -15, 12000, 18000),
                  ("Impression affiches A2 (100 ex.)",    100, "GRAPHIX STUDIO", -15,  2500,  4000),
                  ("Impression affiches A3 (200 ex.)",    200, "GRAPHIX STUDIO", -12,  1200,  2000)])
        _val(fe8, FicheType.EXTERNE, mgr_mkt, Role.MANAGER,
             ValidationStatus.APPROVED, "Urgence événement — délai serré.")
        _val(fe8, FicheType.EXTERNE, director, Role.DIRECTOR,
             ValidationStatus.APPROVED, "Approuvé.")
        fe8.executed_by = comptable
        fe8.executed_at = timezone.now() - timedelta(days=18)
        fe8.execution_fournisseur = "GRAPHIX STUDIO"
        fe8.execution_reference = "GS-FAC-2026-0078"
        fe8.execution_montant = Decimal("452000")
        fe8.execution_mode_paiement = "CHEQUE"
        fe8.received_at = timezone.now() - timedelta(days=8)
        fe8.save()
        _bon_paiement(
            comptable, "GRAPHIX STUDIO",
            "Conception + impression affiches événement annuel",
            452000, ModePaiement.CHEQUE, BonPaiementStatus.VALIDATED,
            fiche=fe8, fiche_type=FicheType.EXTERNE,
            items=[("Design affiches ×5 formats", 90000),
                   ("Impression A2 ×100", 400000),
                   ("Impression A3 ×200", 400000)])  # intentional to show detail

        # 7. REJETÉE
        fe9 = fe(emp_com1, dept_com, FicheExterneStatus.REJECTED,
                 "Prestation traduction — contrats partenariat international",
                 [("Traduction FR→EN (30 pages contrat)", 1, "BUREAU TRADUCTIONS ELITE", 10, 75000, 110000)])
        _val(fe9, FicheType.EXTERNE, mgr_com, Role.MANAGER,
             ValidationStatus.REJECTED,
             "Traduction réalisable en interne. Demande non justifiée.")

    # ─────────────────────────────────────────────────────────────────────
    # BONS DE PAIEMENT (indépendants)
    # ─────────────────────────────────────────────────────────────────────

    def _seed_bp(self, comptable, employees):
        data = [
            ("SONABEL", "Règlement facture électricité Mars 2026",
             125400, ModePaiement.CHEQUE, BonPaiementStatus.VALIDATED,
             [("Facture SONABEL N°2026-03-4521 — mars 2026", 125400)]),
            ("ONATEL", "Abonnement téléphonie & internet — Mars 2026",
             85000, ModePaiement.CHEQUE, BonPaiementStatus.VALIDATED,
             [("Abonnement fiber 100 Mb/s — mars", 55000),
              ("Lignes fixes + mobiles professionnelles", 30000)]),
            ("PROPRIÉTAIRE IMMEUBLE ZOGONA", "Loyer bureaux — Avril 2026",
             750000, ModePaiement.CHEQUE, BonPaiementStatus.VALIDATED,
             [("Loyer mensuel bureaux étage 2 & 3", 750000)]),
            ("TRANS BURKINA SARL", "Frais transport livraison fournitures",
             45000, ModePaiement.ESPECE, BonPaiementStatus.VALIDATED,
             [("Livraison fournitures de bureau — dépôt", 25000),
              ("Transport retour matériel défectueux", 20000)]),
            ("KAMSONGRE TRAITEUR", "Buffet réunion trimestrielle direction",
             185000, ModePaiement.ESPECE, BonPaiementStatus.DRAFT,
             [("Buffet déjeuner 25 personnes", 150000),
              ("Service + vaisselle jetable", 35000)]),
            ("SÉCURITÉ PROTECT BF", "Gardiennage bureaux — Mars 2026",
             220000, ModePaiement.CHEQUE, BonPaiementStatus.VALIDATED,
             [("Gardiennage 24h/24 — 31 jours", 220000)]),
            ("TOTAL MARKETING BURKINA", "Carburant véhicule de service — Mars 2026",
             65000, ModePaiement.ESPECE, BonPaiementStatus.VALIDATED,
             [("Essence sans plomb SP95 — Toyota Hilux", 40000),
              ("Gasoil — Mitsubishi L200", 25000)]),
        ]
        for bene, motif, amt, mode, status, items in data:
            _bon_paiement(comptable, bene, motif, amt, mode, status, items=items)
            self.stdout.write(f"  [BP] {status:12s} | {bene[:40]}")

    # ─────────────────────────────────────────────────────────────────────
    # BONS DE COMMANDE
    # ─────────────────────────────────────────────────────────────────────

    def _seed_bc(self, comptable, daf, director, dept_af):

        def bc(objet, status, proformas_data, selected_idx=None,
               daf_ok=True, dg_ok=True, ref=""):
            b = BonCommande.objects.create(
                date=date.today(),
                objet=objet,
                reference=ref,
                status=status,
                created_by=comptable,
                notes="",
            )
            proformas = []
            for fournisseur, ref_p, montant in proformas_data:
                p = FactureProforma.objects.create(
                    bon_commande=b,
                    fournisseur_nom=fournisseur,
                    reference=ref_p,
                    montant=Decimal(str(montant)),
                    uploaded_by=comptable,
                )
                proformas.append(p)
            if selected_idx is not None and proformas:
                b.fournisseur_selectionne = proformas[selected_idx]
            if status in (BonCommandeStatus.PENDING_DG, BonCommandeStatus.APPROVED,
                          BonCommandeStatus.IN_EXECUTION, BonCommandeStatus.DONE) and daf_ok:
                b.daf_approuve_par = daf
                b.daf_approuve_le = timezone.now() - timedelta(days=5)
                b.daf_commentaire = "Proformas vérifiées, fournisseur sélectionné conforme."
            if status in (BonCommandeStatus.APPROVED, BonCommandeStatus.IN_EXECUTION,
                          BonCommandeStatus.DONE) and dg_ok:
                b.dg_approuve_par = director
                b.dg_approuve_le = timezone.now() - timedelta(days=3)
                b.dg_commentaire = "Approuvé pour commande et paiement."
            b.save()
            self.stdout.write(f"  [BC-{b.pk:04d}] {status:25s} | {objet[:45]}")
            return b

        # BROUILLON — comptable en train de préparer
        bc("Acquisition matériel de bureau — Lot 1 (papeterie)",
           BonCommandeStatus.DRAFT,
           [("OUAGA PAPETERIE", "PRO-OP-001", 185000),
            ("BURKINA OFFICE", "PRO-BO-001", 192000)])

        # EN ATTENTE PROFORMA — soumis, proformas à uploader
        bc("Renouvellement équipements informatiques — 5 postes",
           BonCommandeStatus.PENDING_PROFORMA,
           [])

        # EN ATTENTE DAF — proformas uploadées, attente validation DAF
        bc("Maintenance préventive groupe électrogène",
           BonCommandeStatus.PENDING_DAF,
           [("SOFITEX DISTRIBUTION", "PRO-SF-042", 320000),
            ("GREEN SOLUTIONS BF", "PRO-GS-018", 295000),
            ("TECHNO PLUS", "PRO-TP-033", 310000)],
           selected_idx=1)

        bc("Fournitures hygiène et entretien bureaux — T2",
           BonCommandeStatus.PENDING_DAF,
           [("ETABLISSEMENTS COULIBALY", "PRO-EC-007", 145000),
            ("BURKINA OFFICE", "PRO-BO-012", 138000)],
           selected_idx=1)

        # EN ATTENTE DG — validé par DAF
        bc("Acquisition climatiseurs — 4 unités split 1.5 CV",
           BonCommandeStatus.PENDING_DG,
           [("AZIZ INFORMATIQUE", "PRO-AI-098", 480000),
            ("TECHNO PLUS", "PRO-TP-044", 495000),
            ("GREEN SOLUTIONS BF", "PRO-GS-025", 470000)],
           selected_idx=2)

        # APPROUVÉ — prêt pour exécution
        bc("Services gardiennage & sécurité — contrat T2 2026",
           BonCommandeStatus.APPROVED,
           [("SÉCURITÉ PROTECT BF", "PRO-SP-2026-01", 880000),
            ("VIGILANCE BURKINA", "PRO-VB-2026-01", 920000)],
           selected_idx=0, ref="BC-SECU-2026-01")

        bc("Abonnement logiciels bureautique Microsoft 365 — 20 licences",
           BonCommandeStatus.APPROVED,
           [("AZIZ INFORMATIQUE", "PRO-AI-2026-MS365", 340000),
            ("SOFITEX DISTRIBUTION", "PRO-SF-2026-MS365", 355000)],
           selected_idx=0, ref="BC-IT-2026-02")

        # EN EXECUTION
        bc("Carburant véhicules de service — T2 2026",
           BonCommandeStatus.IN_EXECUTION,
           [("TOTAL MARKETING BURKINA", "PRO-TM-2026-Q2", 650000)],
           selected_idx=0, ref="BC-CARB-2026-02")

        # CLÔTURÉ (DONE)
        bc("Fournitures de bureau — T1 2026",
           BonCommandeStatus.DONE,
           [("OUAGA PAPETERIE", "PRO-OP-2026-Q1", 280000),
            ("BURKINA OFFICE", "PRO-BO-2026-Q1", 295000)],
           selected_idx=0, ref="BC-FRN-2026-01")

        # REJETÉ (DG)
        bc("Acquisition véhicule utilitaire — 4×4 Toyota Hilux",
           BonCommandeStatus.REJECTED,
           [("CFAO MOTORS BF", "PRO-CFAO-001", 12500000),
            ("SONATA BF", "PRO-SONATA-001", 11800000)],
           selected_idx=1, dg_ok=False)

    # ─────────────────────────────────────────────────────────────────────
    # FICHES MISSION
    # ─────────────────────────────────────────────────────────────────────

    def _seed_fm(self, comptable, daf, director, mgr_com, mgr_mkt,
                 emp_com1, emp_mkt1, dept_com, dept_mkt):

        agents = list(User.objects.filter(is_agent_liaison=True))

        def fm(creator, beneficiaire, dept, status, destination, objet,
               date_debut, nb_jours, hebergement, restauration, transport, autres=0,
               prestataire=None):
            m = FicheMission(
                date=date.today() - timedelta(days=10),
                destination=destination,
                objet_mission=objet,
                date_debut=date_debut,
                date_fin=date_debut + timedelta(days=nb_jours),
                hebergement=Decimal(str(hebergement)),
                restauration=Decimal(str(restauration)),
                transport_aller_retour=Decimal(str(transport)),
                autres_frais=Decimal(str(autres)),
                status=status,
                department=dept,
                created_by=creator,
            )
            if prestataire:
                m.prestataire_nom = prestataire
                m.nom_prenom = prestataire
                m.fonction = "Prestataire externe"
            elif beneficiaire:
                m.beneficiaire = beneficiaire
                m.nom_prenom = beneficiaire.get_full_name()
                m.matricule_display = beneficiaire.matricule or ""
                m.fonction = beneficiaire.fonction or "Collaborateur"
            if agents:
                m.agent_liaison = agents[0]
            m.save()
            self.stdout.write(f"  [FM-{m.pk:04d}] {status:20s} | {destination}")
            return m

        # BROUILLON
        fm(mgr_com, emp_com1, dept_com, FicheMissionStatus.DRAFT,
           "Bobo-Dioulasso", "Prospection commerciale et visite partenaires",
           _d(15), 3, 35000, 20000, 25000)

        # EN ATTENTE MANAGER
        fm(mgr_mkt, emp_mkt1, dept_mkt, FicheMissionStatus.PENDING_MANAGER,
           "Koudougou", "Formation régionale sur les nouvelles procédures opérationnelles",
           _d(10), 2, 20000, 15000, 18000)

        # EN ATTENTE DAF
        fm(mgr_com, emp_com1, dept_com, FicheMissionStatus.PENDING_DAF,
           "Ouahigouya", "Supervision activités régionales — bilan T1",
           _d(7), 2, 25000, 15000, 30000)

        # EN ATTENTE DG
        fm(mgr_mkt, emp_mkt1, dept_mkt, FicheMissionStatus.PENDING_DG,
           "Fada N'Gourma", "Mission prospection et développement commercial Est",
           _d(5), 4, 40000, 25000, 45000, 10000)

        # APPROUVÉE — prête à démarrer
        fm(mgr_com, emp_com1, dept_com, FicheMissionStatus.APPROVED,
           "Banfora", "Visite de chantier et inspection travaux installation",
           _d(3), 3, 30000, 20000, 35000)

        fm(mgr_mkt, emp_mkt1, dept_mkt, FicheMissionStatus.APPROVED,
           "Dédougou", "Réunion coordination partenaires locaux — programme annuel",
           _d(2), 2, 20000, 15000, 28000)

        # EN COURS
        fm(mgr_com, emp_com1, dept_com, FicheMissionStatus.IN_PROGRESS,
           "Kaya", "Audit terrain et contrôle qualité — site Nord",
           _d(-1), 3, 30000, 18000, 22000)

        # TERMINÉE
        fm(mgr_mkt, emp_mkt1, dept_mkt, FicheMissionStatus.DONE,
           "Ziniaré", "Mission de suivi post-formation agents terrain",
           _d(-10), 2, 20000, 12000, 15000)

        # Prestataire externe
        fm(mgr_com, None, dept_com, FicheMissionStatus.APPROVED,
           "Tenkodogo", "Mission consultant — contrôle qualité production régionale",
           _d(4), 2, 0, 0, 30000,
           prestataire="BUREAU VERITAS BF")

        # REJETÉE
        fm(mgr_mkt, emp_mkt1, dept_mkt, FicheMissionStatus.REJECTED,
           "Dakar, Sénégal", "Participation Salon Africain du Marketing",
           _d(20), 5, 150000, 75000, 180000, 50000)
