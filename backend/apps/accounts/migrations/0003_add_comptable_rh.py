from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_add_matricule_and_agent_liaison"),
    ]
    operations = [
        migrations.AddField(
            model_name="user",
            name="is_comptable",
            field=models.BooleanField(
                default=False,
                verbose_name="Comptable",
                help_text="Peut uploader des factures proforma et gérer les bons de commande.",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="is_rh",
            field=models.BooleanField(
                default=False,
                verbose_name="Responsable RH",
                help_text="Peut gérer les missions et suivre les fiches de besoin.",
            ),
        ),
    ]
