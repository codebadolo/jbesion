from django.db import migrations, models


def generate_references(apps, schema_editor):
    FicheInterne = apps.get_model("fiches", "FicheInterne")
    for fiche in FicheInterne.objects.filter(reference=""):
        year = fiche.created_at.year
        fiche.reference = f"FI-{year}-{fiche.pk:05d}"
        fiche.save(update_fields=["reference"])

    FicheExterne = apps.get_model("fiches", "FicheExterne")
    for fiche in FicheExterne.objects.filter(reference=""):
        year = fiche.created_at.year
        fiche.reference = f"FE-{year}-{fiche.pk:05d}"
        fiche.save(update_fields=["reference"])


class Migration(migrations.Migration):

    dependencies = [
        ("fiches", "0005_add_bp_notification_types"),
    ]

    operations = [
        # 1. Ajouter les champs sans contrainte unique (pour les lignes existantes)
        migrations.AddField(
            model_name="ficheinterne",
            name="reference",
            field=models.CharField(blank=True, default="", max_length=20, verbose_name="Référence"),
        ),
        migrations.AddField(
            model_name="ficheexterne",
            name="reference",
            field=models.CharField(blank=True, default="", max_length=20, verbose_name="Référence"),
        ),
        # 2. Remplir les références existantes
        migrations.RunPython(generate_references, migrations.RunPython.noop),
        # 3. Appliquer la contrainte unique
        migrations.AlterField(
            model_name="ficheinterne",
            name="reference",
            field=models.CharField(blank=True, max_length=20, unique=True, verbose_name="Référence"),
        ),
        migrations.AlterField(
            model_name="ficheexterne",
            name="reference",
            field=models.CharField(blank=True, max_length=20, unique=True, verbose_name="Référence"),
        ),
    ]
