"""
Initial migration for the departments app.
Creates the Department table.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Department",
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
                    "name",
                    models.CharField(
                        max_length=150,
                        unique=True,
                        verbose_name="Nom du département",
                    ),
                ),
                (
                    "code",
                    models.CharField(
                        help_text="Identifiant court unique, ex: FIN, IT, RH",
                        max_length=20,
                        unique=True,
                        verbose_name="Code",
                    ),
                ),
                (
                    "description",
                    models.TextField(
                        blank=True,
                        default="",
                        verbose_name="Description",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        verbose_name="Date de création",
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(
                        auto_now=True,
                        verbose_name="Dernière modification",
                    ),
                ),
            ],
            options={
                "verbose_name": "Département",
                "verbose_name_plural": "Départements",
                "ordering": ["name"],
            },
        ),
    ]
