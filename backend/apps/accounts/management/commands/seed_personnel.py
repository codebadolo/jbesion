"""
Management command: seed_personnel
-----------------------------------
Charge les données du fichier "Liste du personnel pour IT.xlsx"
dans la base de données PostgreSQL.

Usage:
    python manage.py seed_personnel
    python manage.py seed_personnel --reset   # supprime et recrée tout
"""

import unicodedata
import re

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand

from apps.accounts.models import User, Role
from apps.departments.models import Department


# ---------------------------------------------------------------------------
# Données extraites du fichier Excel
# ---------------------------------------------------------------------------

DEPARTMENTS_DATA = [
    {"name": "Direction Générale",  "code": "DG"},
    {"name": "Admin & Finance",     "code": "AF"},
    {"name": "Commercial",          "code": "COM"},
    {"name": "Marketing",           "code": "MKT"},
    {"name": "Production",          "code": "PROD"},
]

# Format : (nom_complet, poste, département, email, rôle_app, est_manager_de_dept)
PERSONNEL_DATA = [
    # ── Administrateur système ──────────────────────────────────────────────
    (
        "Administrateur Système",
        "Administrateur IT",
        "Direction Générale",
        "admin@jofedigital.com",
        Role.ADMIN,
        False,
    ),

    # ── Direction Générale ──────────────────────────────────────────────────
    (
        "NOUGBOLO Gérard",
        "Directeur Général",
        "Direction Générale",
        "ngerard@jofedigital.com",
        Role.DIRECTOR,
        False,
    ),

    # ── Admin & Finance ─────────────────────────────────────────────────────
    (
        "BAMA Begniamonne Christian",
        "Directeur Administratif et Financier",
        "Admin & Finance",
        "bchristian@jofedigital.com",
        Role.DAF,
        True,   # manager du département
    ),
    (
        "NIGNA Tatié Brice",
        "Comptable",
        "Admin & Finance",
        "finance@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "PITROIPA J. Laeticia",
        "Assistante Ressources Humaines",
        "Admin & Finance",
        "rh@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "SANDWIDI Amanda Ange",
        "Secrétaire Comptable",
        "Admin & Finance",
        "asandwidi@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "DELMA Edwige",
        "Assistante Comptable",
        "Admin & Finance",
        "assistantcomptable@jofedigital.bf",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "NONG-NAABA Toucoumnongo Adé",
        "Agent de liaison",
        "Admin & Finance",
        None,
        Role.COLLABORATEUR,
        False,
    ),
    (
        "SOURABIE Oumar",
        "Agent de liaison",
        "Admin & Finance",
        None,
        Role.COLLABORATEUR,
        False,
    ),

    # ── Commercial ──────────────────────────────────────────────────────────
    (
        "SOULAMA Franck",
        "Business Developer Sénior",
        "Commercial",
        None,
        Role.MANAGER,
        True,   # manager du département
    ),
    (
        "TABSOBA Fanny",
        "Business Developer Junior",
        "Commercial",
        "ftapsoba@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),

    # ── Marketing ───────────────────────────────────────────────────────────
    (
        "ASSALE Serge",
        "Directeur de création et du Marketing",
        "Marketing",
        "sassale@jofedigital.com",
        Role.MANAGER,
        True,   # manager du département
    ),
    (
        "BARRY Faridatou",
        "Community Manager",
        "Marketing",
        "faridatou.barry@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "BOMBIRI BATIONON Flora Maryse",
        "Cheffe de pub & Responsable E-réputation",
        "Marketing",
        None,
        Role.COLLABORATEUR,
        False,
    ),
    (
        "GOUBA Enos",
        "Coordonnateur de production",
        "Marketing",
        "genos@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "KABORE Wendpouiré Linda",
        "Analyste / Media Planner",
        "Marketing",
        "linda.kabore@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "KARAMBIRI Ariane Vanessa Kevine",
        "Business Developer",
        "Marketing",
        "kvanessa@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "NEBIE Wébou",
        "Copywriter",
        "Marketing",
        "nwebou@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "OUEDRAOGO Paul Junior Wend-T",
        "Graphiste Designer",
        "Marketing",
        "graphic.designer1@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "OUEDRAOGO Abdoul Latif",
        "Graphiste Designer",
        "Marketing",
        "graphic.designer2@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "PARE Bienvenue Bientama",
        "Graphiste Designer",
        "Marketing",
        "graphic.designer3@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "SAMPEBGO Jean-Jacques",
        "Superviseur Graphiste Designer",
        "Marketing",
        "graphic.supervisor@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "KABORE Florita",
        "Webmaster",
        "Marketing",
        "florita.kabore@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "YANOGO Stéphanas Fortunatus",
        "Photographe / Vidéaste",
        "Marketing",
        "pvjofe@gmail.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "GUIGUEMDE Djamilatou",
        "Cheffe de pub Junior",
        "Marketing",
        None,
        Role.COLLABORATEUR,
        False,
    ),
    (
        "CISSE Issa",
        "Graphiste Designer Junior",
        "Marketing",
        "graphic.junior@jofedigital.com",
        Role.COLLABORATEUR,
        False,
    ),
    (
        "BONKOUNGOU Stéphanie",
        "Photographe / Vidéaste",
        "Marketing",
        None,
        Role.COLLABORATEUR,
        False,
    ),

    # ── Production ──────────────────────────────────────────────────────────
    (
        "BADOLO Géofroy",
        "Développeur Full Stack",
        "Production",
        None,
        Role.MANAGER,   # seul dans le dept → Manager
        True,
    ),
]

DEFAULT_PASSWORD = "Test@1234"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify_name(name: str) -> str:
    """Convert 'BARRY Faridatou' → 'barry.faridatou' (unique username base)."""
    name = unicodedata.normalize("NFD", name)
    name = name.encode("ascii", "ignore").decode("ascii")
    name = name.lower()
    # Remove special chars except letters, digits, spaces and hyphens
    name = re.sub(r"[^a-z0-9 \-]", "", name)
    parts = name.split()
    if len(parts) >= 2:
        # Nom de famille (premier mot) . premier prénom (dernier mot)
        return f"{parts[0]}.{parts[-1]}"
    return parts[0] if parts else "user"



# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

class Command(BaseCommand):
    help = "Charge le personnel IT depuis le fichier Excel dans la base de données"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Supprime tous les utilisateurs et départements existants avant de recharger",
        )

    def handle(self, *args, **options):
        if options["reset"]:
            self.stdout.write(self.style.WARNING("⚠  Reset : suppression des données existantes…"))
            User.objects.exclude(is_superuser=True).delete()
            Department.objects.all().delete()
            self.stdout.write(self.style.WARNING("   Données supprimées.\n"))

        # ── 1. Créer les départements ────────────────────────────────────────
        self.stdout.write("📁 Création des départements…")
        dept_map: dict[str, Department] = {}
        for d in DEPARTMENTS_DATA:
            dept, created = Department.objects.get_or_create(
                code=d["code"],
                defaults={"name": d["name"]},
            )
            dept_map[d["name"]] = dept
            flag = "✓ créé" if created else "→ existant"
            self.stdout.write(f"   [{flag}] {dept.name} ({dept.code})")

        # ── 2. Premier passage : créer tous les utilisateurs ─────────────────
        self.stdout.write("\n👥 Création des utilisateurs…")

        # On garde une map nom_complet → User pour assigner les managers ensuite
        user_map: dict[str, User] = {}
        # dept_name → User qui est manager de ce dept
        dept_manager_map: dict[str, User] = {}

        hashed_password = make_password(DEFAULT_PASSWORD)

        for (full_name, poste, dept_name, email, role, is_dept_manager) in PERSONNEL_DATA:
            dept = dept_map[dept_name]

            # Username fixe basé sur le nom — jamais de suffixe numérique
            username = slugify_name(full_name)

            # Email (ignorer les valeurs invalides)
            clean_email = ""
            if email and email.lower() not in ("néant", "none", ""):
                clean_email = email

            # Nom / Prénom depuis "NOM Prénom …"
            parts = full_name.split()
            # Cherche où finissent les mots tout-en-majuscules (= nom de famille)
            last_name_parts = []
            first_name_parts = []
            for i, p in enumerate(parts):
                if p.isupper() or p.replace("-", "").isupper():
                    last_name_parts.append(p)
                else:
                    first_name_parts = parts[i:]
                    break
            last_name = " ".join(last_name_parts) if last_name_parts else parts[0]
            first_name = " ".join(first_name_parts) if first_name_parts else ""

            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": clean_email,
                    "password": hashed_password,
                    "role": role,
                    "department": dept,
                    "is_active": True,
                },
            )

            if not created:
                # Mettre à jour si l'utilisateur existait déjà
                user.role = role
                user.department = dept
                if not user.email and clean_email:
                    user.email = clean_email
                user.save(update_fields=["role", "department", "email"])

            flag = "✓ créé" if created else "→ màj"
            role_label = dict(Role.choices)[role]
            self.stdout.write(
                f"   [{flag}] {full_name:<40} | {role_label:<12} | {dept_name} | @{username}"
            )

            user_map[full_name] = user
            if is_dept_manager:
                dept_manager_map[dept_name] = user

        # ── 3. Deuxième passage : assigner les managers ──────────────────────
        self.stdout.write("\n🔗 Assignation des relations hiérarchiques…")

        director = user_map.get("NOUGBOLO Gérard")

        for (full_name, _, dept_name, _, role, is_dept_manager) in PERSONNEL_DATA:
            user = user_map[full_name]
            dept_manager = dept_manager_map.get(dept_name)

            if role == Role.DIRECTOR:
                # Le directeur n'a pas de manager
                user.manager = None
            elif role in (Role.MANAGER, Role.DAF):
                # Les managers/DAF reportent au directeur
                user.manager = director
            elif dept_manager and user != dept_manager:
                # Les employés reportent au manager de leur département
                user.manager = dept_manager
            else:
                user.manager = director

            user.save(update_fields=["manager"])

        # ── 4. Résumé ────────────────────────────────────────────────────────
        self.stdout.write("\n" + "─" * 60)
        self.stdout.write(self.style.SUCCESS("✅ Chargement terminé avec succès !\n"))
        self.stdout.write(f"   Départements : {Department.objects.count()}")
        self.stdout.write(f"   Utilisateurs : {User.objects.exclude(is_superuser=True).count()}")
        self.stdout.write(f"\n   Mot de passe par défaut : {DEFAULT_PASSWORD}")
        self.stdout.write("   (À changer en production !)\n")

        self.stdout.write("\n📋 Comptes de test utiles :")
        self.stdout.write(f"   Directeur : nougbolo.gerard  / {DEFAULT_PASSWORD}")
        self.stdout.write(f"   DAF       : bama.christian   / {DEFAULT_PASSWORD}")
        self.stdout.write(f"   Manager   : assale.serge     / {DEFAULT_PASSWORD}")
        self.stdout.write(f"   Employé   : barry.faridatou  / {DEFAULT_PASSWORD}")
