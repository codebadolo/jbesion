"""
Initial migration for the fiches app.
Creates FicheInterne, FicheInterneItem, FicheExterne, FicheExterneItem,
and Validation tables.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("accounts", "0001_initial"),
        ("contenttypes", "0002_remove_content_type_name"),
        ("departments", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ------------------------------------------------------------------
        # FicheInterne
        # ------------------------------------------------------------------
        migrations.CreateModel(
            name="FicheInterne",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "date_creation",
                    models.DateField(
                        auto_now_add=True, verbose_name="Date de création"
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("DRAFT", "Brouillon"),
                            ("PENDING_MANAGER", "En attente du Manager"),
                            ("PENDING_DAF", "En attente du DAF"),
                            ("PENDING_DIRECTOR", "En attente du Directeur"),
                            ("APPROVED", "Approuvée"),
                            ("REJECTED", "Rejetée"),
                        ],
                        default="DRAFT",
                        max_length=30,
                        verbose_name="Statut",
                    ),
                ),
                (
                    "notes",
                    models.TextField(
                        blank=True,
                        default="",
                        verbose_name="Notes / Observations",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True, verbose_name="Créé le"
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="Modifié le"),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="fiches_internes",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Créé par",
                    ),
                ),
                (
                    "department",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="fiches_internes",
                        to="departments.department",
                        verbose_name="Département",
                    ),
                ),
            ],
            options={
                "verbose_name": "Fiche Interne",
                "verbose_name_plural": "Fiches Internes",
                "ordering": ["-created_at"],
            },
        ),
        # ------------------------------------------------------------------
        # FicheInterneItem
        # ------------------------------------------------------------------
        migrations.CreateModel(
            name="FicheInterneItem",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "designation",
                    models.CharField(max_length=255, verbose_name="Désignation"),
                ),
                (
                    "quantity",
                    models.PositiveIntegerField(default=1, verbose_name="Quantité"),
                ),
                (
                    "date_requise",
                    models.DateField(verbose_name="Date requise"),
                ),
                (
                    "montant",
                    models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=14,
                        null=True,
                        verbose_name="Montant estimé (DZD)",
                    ),
                ),
                (
                    "fiche",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="fiches.ficheinterne",
                        verbose_name="Fiche Interne",
                    ),
                ),
            ],
            options={
                "verbose_name": "Article (Fiche Interne)",
                "verbose_name_plural": "Articles (Fiches Internes)",
            },
        ),
        # ------------------------------------------------------------------
        # FicheExterne
        # ------------------------------------------------------------------
        migrations.CreateModel(
            name="FicheExterne",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "date_creation",
                    models.DateField(
                        auto_now_add=True, verbose_name="Date de création"
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("DRAFT", "Brouillon"),
                            ("PENDING_MANAGER", "En attente du Manager"),
                            ("PENDING_DIRECTOR", "En attente du Directeur"),
                            ("APPROVED", "Approuvée"),
                            ("REJECTED", "Rejetée"),
                        ],
                        default="DRAFT",
                        max_length=30,
                        verbose_name="Statut",
                    ),
                ),
                (
                    "notes",
                    models.TextField(
                        blank=True,
                        default="",
                        verbose_name="Notes / Observations",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True, verbose_name="Créé le"
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="Modifié le"),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="fiches_externes",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Créé par",
                    ),
                ),
                (
                    "department",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="fiches_externes",
                        to="departments.department",
                        verbose_name="Département",
                    ),
                ),
            ],
            options={
                "verbose_name": "Fiche Externe",
                "verbose_name_plural": "Fiches Externes",
                "ordering": ["-created_at"],
            },
        ),
        # ------------------------------------------------------------------
        # FicheExterneItem
        # ------------------------------------------------------------------
        migrations.CreateModel(
            name="FicheExterneItem",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "designation",
                    models.CharField(max_length=255, verbose_name="Désignation"),
                ),
                (
                    "quantity",
                    models.PositiveIntegerField(default=1, verbose_name="Quantité"),
                ),
                (
                    "affectation",
                    models.CharField(
                        help_text="Nom du partenaire ou prestataire concerné",
                        max_length=255,
                        verbose_name="Affectation / Prestataire",
                    ),
                ),
                (
                    "date_requise",
                    models.DateField(verbose_name="Date requise"),
                ),
                (
                    "montant_prestataire",
                    models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=14,
                        null=True,
                        verbose_name="Montant Prestataire (DZD)",
                    ),
                ),
                (
                    "montant_client",
                    models.DecimalField(
                        blank=True,
                        decimal_places=2,
                        max_digits=14,
                        null=True,
                        verbose_name="Montant Client (DZD)",
                    ),
                ),
                (
                    "fiche",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="fiches.ficheexterne",
                        verbose_name="Fiche Externe",
                    ),
                ),
            ],
            options={
                "verbose_name": "Article (Fiche Externe)",
                "verbose_name_plural": "Articles (Fiches Externes)",
            },
        ),
        # ------------------------------------------------------------------
        # Validation
        # ------------------------------------------------------------------
        migrations.CreateModel(
            name="Validation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "fiche_type",
                    models.CharField(
                        choices=[("INTERNE", "Interne"), ("EXTERNE", "Externe")],
                        max_length=10,
                        verbose_name="Type de fiche",
                    ),
                ),
                ("object_id", models.PositiveIntegerField()),
                (
                    "role_at_validation",
                    models.CharField(
                        help_text="Role that the validator held at the time of validation",
                        max_length=20,
                        verbose_name="Rôle lors de la validation",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("APPROVED", "Approuvée"),
                            ("REJECTED", "Rejetée"),
                        ],
                        max_length=10,
                        verbose_name="Décision",
                    ),
                ),
                (
                    "date_validation",
                    models.DateTimeField(
                        auto_now_add=True, verbose_name="Date de validation"
                    ),
                ),
                (
                    "commentaire",
                    models.TextField(
                        blank=True,
                        default="",
                        verbose_name="Commentaire",
                    ),
                ),
                (
                    "content_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="contenttypes.contenttype",
                    ),
                ),
                (
                    "validator",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="validations",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Validateur",
                    ),
                ),
            ],
            options={
                "verbose_name": "Validation",
                "verbose_name_plural": "Validations",
                "ordering": ["-date_validation"],
            },
        ),
    ]
