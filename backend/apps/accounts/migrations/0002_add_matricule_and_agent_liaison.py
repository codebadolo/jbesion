from django.db import migrations, models
from django.utils import timezone


def generate_matricules(apps, schema_editor):
    """Génère un matricule pour tous les utilisateurs existants."""
    User = apps.get_model("accounts", "User")
    year = timezone.now().year
    for user in User.objects.all().order_by("id"):
        if not user.matricule:
            user.matricule = f"MAT-{year}-{user.pk:05d}"
            user.save(update_fields=["matricule"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        # Étape 1 : ajouter le champ sans la contrainte unique
        migrations.AddField(
            model_name="user",
            name="matricule",
            field=models.CharField(
                blank=True,
                default="",
                max_length=20,
                verbose_name="Numéro Matricule",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="is_agent_liaison",
            field=models.BooleanField(
                default=False,
                verbose_name="Agent de liaison",
                help_text="Indique si cet utilisateur peut être affecté comme agent de liaison.",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="fonction",
            field=models.CharField(
                blank=True,
                default="",
                max_length=150,
                verbose_name="Fonction / Poste",
            ),
        ),
        # Étape 2 : peupler les matricules existants
        migrations.RunPython(generate_matricules, migrations.RunPython.noop),
        # Étape 3 : ajouter la contrainte unique
        migrations.AlterField(
            model_name="user",
            name="matricule",
            field=models.CharField(
                blank=True,
                default="",
                max_length=20,
                unique=True,
                verbose_name="Numéro Matricule",
            ),
        ),
    ]
