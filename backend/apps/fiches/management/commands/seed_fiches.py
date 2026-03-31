"""
Management command: seed_fiches
Usage:
    python manage.py seed_fiches
    python manage.py seed_fiches --reset

Creates realistic FicheInterne, FicheExterne and Validation records
for development / testing purposes, using existing users from the DB.

Prerequisite: run seed_personnel first so that users already exist.
"""

from datetime import date, timedelta

from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

from apps.accounts.models import Role, User
from apps.fiches.models import (
    FicheExterne,
    FicheExterneItem,
    FicheExterneStatus,
    FicheInterne,
    FicheInterneItem,
    FicheInterneStatus,
    FicheType,
    Validation,
    ValidationStatus,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _future(days: int) -> date:
    """Return today + <days>."""
    return date.today() + timedelta(days=days)


def _make_validation(fiche, fiche_type: str, validator: User, role: str,
                     status: str, comment: str = "") -> Validation:
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


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

class Command(BaseCommand):
    help = (
        "Seed the database with realistic FicheInterne / FicheExterne "
        "and their Validation records."
    )

    # ------------------------------------------------------------------
    # CLI options
    # ------------------------------------------------------------------

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete all existing fiches and validations before seeding.",
        )

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------

    def handle(self, *args, **options):
        if options["reset"]:
            self._reset()

        # --- collect users by role ------------------------------------
        employees = list(User.objects.filter(role=Role.COLLABORATEUR))
        managers  = list(User.objects.filter(role=Role.MANAGER))
        dafs      = list(User.objects.filter(role=Role.DAF))
        directors = list(User.objects.filter(role=Role.DIRECTOR))

        if not any([employees, managers, dafs, directors]):
            self.stderr.write(
                self.style.WARNING(
                    "Aucun utilisateur trouvé. Lancez d'abord seed_personnel."
                )
            )
            return

        # Provide safe fallbacks: use any available user when a specific
        # role is absent, so the seed still produces useful data.
        all_users = list(User.objects.filter(is_active=True))
        if not all_users:
            self.stderr.write(
                self.style.WARNING(
                    "Aucun utilisateur trouvé. Lancez d'abord seed_personnel."
                )
            )
            return

        emp1     = (employees[0]  if employees  else all_users[0])
        emp2     = (employees[1]  if len(employees) > 1 else all_users[-1])
        manager  = (managers[0]   if managers   else all_users[0])
        daf      = (dafs[0]       if dafs       else all_users[0])
        director = (directors[0]  if directors  else all_users[0])

        # Each user must belong to a department for a fiche to be valid.
        # Resolve the department from the user, falling back to the first
        # available department when the user has none.
        from apps.departments.models import Department  # local import avoids circulars

        first_dept = Department.objects.first()
        if first_dept is None:
            self.stderr.write(
                self.style.WARNING(
                    "Aucun département trouvé. Lancez d'abord seed_departments."
                )
            )
            return

        def dept_of(user):
            return user.department if user.department_id else first_dept

        # ------------------------------------------------------------------
        # FicheInterne
        # ------------------------------------------------------------------
        self.stdout.write("  Création des Fiches Internes…")

        fi_draft = self._create_fi(
            created_by=emp1,
            department=dept_of(emp1),
            status=FicheInterneStatus.DRAFT,
            notes="Brouillon non soumis — matériel de bureau",
            items=[
                ("Ramette de papier A4 (500 feuilles)", 10, _future(30), None),
                ("Stylos bille bleu (boîte de 50)",      2, _future(30), 850),
                ("Classeurs A4 à levier",                 5, _future(45), None),
            ],
        )

        fi_pending_mgr = self._create_fi(
            created_by=emp1,
            department=dept_of(emp1),
            status=FicheInterneStatus.PENDING_MANAGER,
            notes="Soumis, en attente validation manager",
            items=[
                ("Clé USB 64 Go",                3, _future(20), 1200),
                ("Souris optique sans fil",      2, _future(20), 2500),
                ("Tapis de souris ergonomique",  2, _future(20), None),
            ],
        )

        fi_pending_daf = self._create_fi(
            created_by=emp1,
            department=dept_of(emp1),
            status=FicheInterneStatus.PENDING_DAF,
            notes="Validé par manager, en attente DAF",
            items=[
                ("Cartouches d'encre HP 302 Noir",  4, _future(15), 2200),
                ("Cartouches d'encre HP 302 Couleur", 2, _future(15), 2800),
                ("Ramette papier photo A4 glossy",    1, _future(15), 1500),
            ],
        )

        fi_pending_dir = self._create_fi(
            created_by=emp1,
            department=dept_of(emp1),
            status=FicheInterneStatus.PENDING_DIRECTOR,
            notes="Validé par DAF, en attente directeur",
            items=[
                ("Ordinateur portable HP 15s",   1, _future(10), 95000),
                ("Écran PC 24 pouces Full HD",   1, _future(10), 38000),
                ("Clavier mécanique USB",        1, _future(10),  6500),
                ("Webcam HD 1080p",              1, _future(10),  4200),
            ],
        )

        fi_approved = self._create_fi(
            created_by=emp1,
            department=dept_of(emp1),
            status=FicheInterneStatus.APPROVED,
            notes="Approuvé — commande en cours",
            items=[
                ("Imprimante laser multifonction", 1, _future(7), 48000),
                ("Rame de papier A4 80g (carton)", 5, _future(7),  4500),
            ],
        )

        fi_rejected = self._create_fi(
            created_by=emp1,
            department=dept_of(emp1),
            status=FicheInterneStatus.REJECTED,
            notes="Rejeté — budget insuffisant ce trimestre",
            items=[
                ("Tableau blanc effaçable 120×90 cm", 2, _future(60), 15000),
                ("Marqueurs effaçables (lot 10)",      3, _future(60),  1200),
            ],
        )

        fi_approved2 = self._create_fi(
            created_by=emp2,
            department=dept_of(emp2),
            status=FicheInterneStatus.APPROVED,
            notes="Commande mobilier approuvée",
            items=[
                ("Chaise de bureau ergonomique",   2, _future(14), 22000),
                ("Bureau réglable en hauteur",     1, _future(14), 45000),
                ("Lampe de bureau LED",            2, _future(14),  3800),
            ],
        )

        fi_pending_mgr2 = self._create_fi(
            created_by=emp2,
            department=dept_of(emp2),
            status=FicheInterneStatus.PENDING_MANAGER,
            notes="Fournitures cuisine / cafétéria",
            items=[
                ("Café arabica 250 g (lot x6)",  2, _future(10), 2400),
                ("Sucre en morceaux 1 kg",        4, _future(10),  480),
                ("Gobelets jetables 20 cl (x50)", 6, _future(10),  900),
            ],
        )

        # ------------------------------------------------------------------
        # Validations — FicheInterne
        # ------------------------------------------------------------------
        self.stdout.write("  Création des Validations (Fiches Internes)…")

        # PENDING_DAF  → manager APPROVED
        _make_validation(
            fi_pending_daf, FicheType.INTERNE, manager, Role.MANAGER,
            ValidationStatus.APPROVED,
            "Besoin confirmé par le manager.",
        )

        # PENDING_DIRECTOR → manager APPROVED + DAF APPROVED
        _make_validation(
            fi_pending_dir, FicheType.INTERNE, manager, Role.MANAGER,
            ValidationStatus.APPROVED,
            "Besoin justifié.",
        )
        _make_validation(
            fi_pending_dir, FicheType.INTERNE, daf, Role.DAF,
            ValidationStatus.APPROVED,
            "Budget disponible, validation DAF accordée.",
        )

        # APPROVED (emp1) → manager + DAF + director all APPROVED
        _make_validation(
            fi_approved, FicheType.INTERNE, manager, Role.MANAGER,
            ValidationStatus.APPROVED,
            "Validé manager.",
        )
        _make_validation(
            fi_approved, FicheType.INTERNE, daf, Role.DAF,
            ValidationStatus.APPROVED,
            "Validé DAF — enveloppe budgétaire conforme.",
        )
        _make_validation(
            fi_approved, FicheType.INTERNE, director, Role.DIRECTOR,
            ValidationStatus.APPROVED,
            "Approuvé par la direction.",
        )

        # REJECTED → manager REJECTED
        _make_validation(
            fi_rejected, FicheType.INTERNE, manager, Role.MANAGER,
            ValidationStatus.REJECTED,
            "Budget trimestriel déjà engagé. Reporter au prochain trimestre.",
        )

        # APPROVED (emp2) → manager + DAF + director all APPROVED
        _make_validation(
            fi_approved2, FicheType.INTERNE, manager, Role.MANAGER,
            ValidationStatus.APPROVED,
            "Renouvellement mobilier justifié.",
        )
        _make_validation(
            fi_approved2, FicheType.INTERNE, daf, Role.DAF,
            ValidationStatus.APPROVED,
            "Montant dans les limites du budget mobilier.",
        )
        _make_validation(
            fi_approved2, FicheType.INTERNE, director, Role.DIRECTOR,
            ValidationStatus.APPROVED,
            "Approuvé.",
        )

        # ------------------------------------------------------------------
        # FicheExterne
        # ------------------------------------------------------------------
        self.stdout.write("  Création des Fiches Externes…")

        fe_draft = self._create_fe(
            created_by=emp1,
            department=dept_of(emp1),
            status=FicheExterneStatus.DRAFT,
            notes="Brouillon — prestation communication",
            items=[
                ("Conception logo entreprise",           1, "Studio Graphique Alpha",       _future(45), 35000,  50000),
                ("Charte graphique complète",            1, "Studio Graphique Alpha",       _future(60), 55000,  75000),
            ],
        )

        fe_pending_mgr = self._create_fe(
            created_by=emp1,
            department=dept_of(emp1),
            status=FicheExterneStatus.PENDING_MANAGER,
            notes="Soumis — campagne digitale Q2",
            items=[
                ("Campagne publicité Facebook & Instagram", 1, "Agence Communication XYZ", _future(20), 120000, 160000),
                ("Création de 4 visuels publicitaires",    4, "Agence Communication XYZ", _future(25),  18000,  25000),
                ("Rapport de performance mensuel",         1, "Agence Communication XYZ", _future(35),   8000,  12000),
            ],
        )

        fe_pending_dir = self._create_fe(
            created_by=emp2,
            department=dept_of(emp2),
            status=FicheExterneStatus.PENDING_DIRECTOR,
            notes="Validé manager — développement site web",
            items=[
                ("Développement site web vitrine",         1, "WebAgency Pro",             _future(90), 280000, 380000),
                ("Hébergement & nom de domaine (1 an)",    1, "WebAgency Pro",             _future(90),  12000,  18000),
            ],
        )

        fe_approved = self._create_fe(
            created_by=emp2,
            department=dept_of(emp2),
            status=FicheExterneStatus.APPROVED,
            notes="Approuvé — prestation traduction",
            items=[
                ("Traduction technique FR → EN (50 pages)", 1, "Bureau Traductions Elite", _future(10),  45000,  65000),
                ("Relecture & mise en page",                 1, "Bureau Traductions Elite", _future(12),  15000,  22000),
                ("Livraison format Word + PDF",              1, "Bureau Traductions Elite", _future(12),   5000,   8000),
            ],
        )

        fe_rejected = self._create_fe(
            created_by=emp1,
            department=dept_of(emp1),
            status=FicheExterneStatus.REJECTED,
            notes="Rejeté — prestataire non référencé",
            items=[
                ("Audit sécurité informatique",  1, "CyberSec Consulting SARL", _future(30), 180000, 250000),
                ("Rapport d'audit détaillé",      1, "CyberSec Consulting SARL", _future(35),  30000,  45000),
            ],
        )

        # ------------------------------------------------------------------
        # Validations — FicheExterne
        # ------------------------------------------------------------------
        self.stdout.write("  Création des Validations (Fiches Externes)…")

        # PENDING_DIRECTOR → manager APPROVED
        _make_validation(
            fe_pending_dir, FicheType.EXTERNE, manager, Role.MANAGER,
            ValidationStatus.APPROVED,
            "Prestataire vérifié, offre technique conforme.",
        )

        # APPROVED → manager APPROVED + director APPROVED
        _make_validation(
            fe_approved, FicheType.EXTERNE, manager, Role.MANAGER,
            ValidationStatus.APPROVED,
            "Besoin validé côté opérationnel.",
        )
        _make_validation(
            fe_approved, FicheType.EXTERNE, director, Role.DIRECTOR,
            ValidationStatus.APPROVED,
            "Approuvé par la direction générale.",
        )

        # REJECTED → manager REJECTED
        _make_validation(
            fe_rejected, FicheType.EXTERNE, manager, Role.MANAGER,
            ValidationStatus.REJECTED,
            "Prestataire non référencé au catalogue fournisseurs approuvés.",
        )

        # ------------------------------------------------------------------
        # Summary
        # ------------------------------------------------------------------
        fi_count  = FicheInterne.objects.count()
        fe_count  = FicheExterne.objects.count()
        val_count = Validation.objects.count()

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeding terminé — "
                f"{fi_count} FicheInterne, "
                f"{fe_count} FicheExterne, "
                f"{val_count} Validation(s) en base."
            )
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _reset(self):
        self.stdout.write(self.style.WARNING("  Suppression des fiches et validations existantes…"))
        Validation.objects.all().delete()
        FicheInterneItem.objects.all().delete()
        FicheInterne.objects.all().delete()
        FicheExterneItem.objects.all().delete()
        FicheExterne.objects.all().delete()
        self.stdout.write("  Suppression terminée.")

    def _create_fi(
        self,
        *,
        created_by: User,
        department,
        status: str,
        notes: str,
        items: list,
    ) -> FicheInterne:
        """Create a FicheInterne together with its line items."""
        fiche = FicheInterne.objects.create(
            created_by=created_by,
            department=department,
            status=status,
            notes=notes,
        )
        for designation, quantity, date_requise, montant in items:
            FicheInterneItem.objects.create(
                fiche=fiche,
                designation=designation,
                quantity=quantity,
                date_requise=date_requise,
                montant=montant,
            )
        self.stdout.write(
            f"    [FI] {status:20s} | {department} | {created_by}"
        )
        return fiche

    def _create_fe(
        self,
        *,
        created_by: User,
        department,
        status: str,
        notes: str,
        items: list,
    ) -> FicheExterne:
        """Create a FicheExterne together with its line items."""
        fiche = FicheExterne.objects.create(
            created_by=created_by,
            department=department,
            status=status,
            notes=notes,
        )
        for designation, quantity, affectation, date_requise, montant_presta, montant_client in items:
            FicheExterneItem.objects.create(
                fiche=fiche,
                designation=designation,
                quantity=quantity,
                affectation=affectation,
                date_requise=date_requise,
                montant_prestataire=montant_presta,
                montant_client=montant_client,
            )
        self.stdout.write(
            f"    [FE] {status:20s} | {department} | {created_by}"
        )
        return fiche
