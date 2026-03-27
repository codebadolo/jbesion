import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Créer BonCommande SANS le FK vers FactureProforma
        migrations.CreateModel(
            name="BonCommande",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("numero", models.CharField(blank=True, max_length=20, unique=True, verbose_name="Numéro")),
                ("date", models.DateField(verbose_name="Date")),
                ("objet", models.TextField(verbose_name="Objet / Description")),
                ("reference", models.CharField(blank=True, default="", max_length=255, verbose_name="Référence (optionnelle)")),
                ("fiche_type", models.CharField(blank=True, choices=[("INTERNE", "Interne"), ("EXTERNE", "Externe")], default="", max_length=10, verbose_name="Type de fiche liée")),
                ("fiche_id", models.PositiveIntegerField(blank=True, null=True, verbose_name="ID de la fiche liée")),
                ("status", models.CharField(choices=[("DRAFT", "Brouillon"), ("PENDING_DAF", "En attente du DAF"), ("PENDING_DG", "En attente du DG"), ("APPROVED", "Approuvé"), ("REJECTED", "Rejeté"), ("IN_EXECUTION", "En cours d'exécution"), ("DONE", "Exécuté / Clôturé")], default="DRAFT", max_length=20, verbose_name="Statut")),
                ("daf_approuve_le", models.DateTimeField(blank=True, null=True, verbose_name="Approuvé le (DAF)")),
                ("daf_commentaire", models.TextField(blank=True, default="", verbose_name="Commentaire DAF")),
                ("dg_approuve_le", models.DateTimeField(blank=True, null=True, verbose_name="Approuvé le (DG)")),
                ("dg_commentaire", models.TextField(blank=True, default="", verbose_name="Commentaire DG")),
                ("notes", models.TextField(blank=True, default="", verbose_name="Notes / Observations")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Créé le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Modifié le")),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="bons_commande_crees", to=settings.AUTH_USER_MODEL, verbose_name="Créé par")),
                ("daf_approuve_par", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="bons_commande_daf", to=settings.AUTH_USER_MODEL, verbose_name="Approuvé par (DAF)")),
                ("dg_approuve_par", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="bons_commande_dg", to=settings.AUTH_USER_MODEL, verbose_name="Approuvé par (DG)")),
            ],
            options={"verbose_name": "Bon de Commande", "verbose_name_plural": "Bons de Commande", "ordering": ["-created_at"]},
        ),
        # 2. Créer FactureProforma avec FK vers BonCommande
        migrations.CreateModel(
            name="FactureProforma",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("fournisseur_nom", models.CharField(max_length=255, verbose_name="Nom du fournisseur")),
                ("reference", models.CharField(blank=True, default="", max_length=255, verbose_name="Référence facture proforma")),
                ("montant", models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True, verbose_name="Montant (FCFA)")),
                ("fichier", models.FileField(blank=True, null=True, upload_to="proformas/%Y/%m/", verbose_name="Fichier (scan / PDF)")),
                ("notes", models.TextField(blank=True, default="", verbose_name="Notes")),
                ("uploaded_at", models.DateTimeField(auto_now_add=True, verbose_name="Uploadé le")),
                ("bon_commande", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="factures_proforma", to="bons_commande.boncommande", verbose_name="Bon de Commande")),
                ("uploaded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="factures_proforma_uploadees", to=settings.AUTH_USER_MODEL, verbose_name="Uploadé par")),
            ],
            options={"verbose_name": "Facture Proforma", "verbose_name_plural": "Factures Proforma", "ordering": ["uploaded_at"]},
        ),
        # 3. Ajouter la FK fournisseur_selectionne sur BonCommande (après création de FactureProforma)
        migrations.AddField(
            model_name="boncommande",
            name="fournisseur_selectionne",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="bons_commande.factureproforma",
                verbose_name="Fournisseur sélectionné",
            ),
        ),
    ]
