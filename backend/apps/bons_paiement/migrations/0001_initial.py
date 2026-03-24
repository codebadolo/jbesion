from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="BonPaiement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("numero", models.CharField(blank=True, max_length=20, unique=True, verbose_name="Numéro de bon")),
                ("date", models.DateField(verbose_name="Date")),
                ("beneficiaire", models.CharField(max_length=255, verbose_name="Bénéficiaire (Reçu par)")),
                ("motif", models.TextField(verbose_name="Motif")),
                (
                    "mode_paiement",
                    models.CharField(
                        choices=[
                            ("ESPECE", "Espèce"),
                            ("VIREMENT", "Virement bancaire"),
                            ("CHEQUE", "Chèque"),
                            ("MOBILE_MONEY", "Mobile Money"),
                            ("CARTE", "Carte bancaire"),
                            ("AUTRE", "Autre"),
                        ],
                        max_length=20,
                        verbose_name="Mode de paiement",
                    ),
                ),
                ("montant", models.DecimalField(decimal_places=2, max_digits=14, verbose_name="Montant (FCFA)")),
                ("montant_lettres", models.CharField(blank=True, default="", max_length=500, verbose_name="Montant en lettres")),
                ("notes", models.TextField(blank=True, default="", verbose_name="Notes / Observations")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("DRAFT", "Brouillon"),
                            ("VALIDATED", "Validé"),
                            ("CANCELLED", "Annulé"),
                        ],
                        default="DRAFT",
                        max_length=20,
                        verbose_name="Statut",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Créé le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Modifié le")),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="bons_paiement",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Créé par",
                    ),
                ),
            ],
            options={
                "verbose_name": "Bon de Paiement",
                "verbose_name_plural": "Bons de Paiement",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="BonPaiementItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("designation", models.CharField(max_length=255, verbose_name="Désignation / Détail")),
                ("montant", models.DecimalField(decimal_places=2, max_digits=14, verbose_name="Montant (FCFA)")),
                (
                    "bon",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="bons_paiement.bonpaiement",
                        verbose_name="Bon de Paiement",
                    ),
                ),
            ],
            options={
                "verbose_name": "Article (Bon de Paiement)",
                "verbose_name_plural": "Articles (Bons de Paiement)",
            },
        ),
    ]
