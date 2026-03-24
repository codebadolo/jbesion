from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bons_paiement", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="bonpaiement",
            name="fiche_type",
            field=models.CharField(
                blank=True,
                choices=[("INTERNE", "Interne"), ("EXTERNE", "Externe")],
                default="",
                max_length=10,
                verbose_name="Type de fiche liée",
            ),
        ),
        migrations.AddField(
            model_name="bonpaiement",
            name="fiche_id",
            field=models.PositiveIntegerField(
                blank=True, null=True, verbose_name="ID de la fiche liée"
            ),
        ),
    ]
