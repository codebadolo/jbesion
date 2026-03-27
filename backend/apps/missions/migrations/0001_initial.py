import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("departments", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="FicheMission",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("numero", models.CharField(blank=True, max_length=20, unique=True, verbose_name="Numéro de fiche")),
                ("date", models.DateField(verbose_name="Date de la fiche")),
                ("matricule_display", models.CharField(blank=True, default="", max_length=20, verbose_name="Numéro Matricule")),
                ("nom_prenom", models.CharField(max_length=255, verbose_name="Nom et Prénom")),
                ("fonction", models.CharField(blank=True, default="", max_length=150, verbose_name="Fonction / Poste")),
                ("destination", models.CharField(max_length=255, verbose_name="Destination / Lieu de mission")),
                ("objet_mission", models.TextField(verbose_name="Objet de la mission")),
                ("date_debut", models.DateField(verbose_name="Date de départ")),
                ("date_fin", models.DateField(verbose_name="Date de retour")),
                ("hebergement", models.DecimalField(decimal_places=2, default=0, max_digits=14, verbose_name="Hébergement (FCFA)")),
                ("restauration", models.DecimalField(decimal_places=2, default=0, max_digits=14, verbose_name="Restauration (FCFA)")),
                ("transport_aller_retour", models.DecimalField(decimal_places=2, default=0, max_digits=14, verbose_name="Transport Aller-Retour (FCFA)")),
                ("autres_frais", models.DecimalField(decimal_places=2, default=0, max_digits=14, verbose_name="Autres frais (FCFA)")),
                ("prestataire_nom", models.CharField(blank=True, default="", max_length=255, verbose_name="Nom du prestataire (si externe)")),
                ("fiche_externe_id", models.PositiveIntegerField(blank=True, null=True, verbose_name="ID Fiche Externe liée")),
                ("status", models.CharField(choices=[("DRAFT", "Brouillon"), ("PENDING_MANAGER", "En attente du Manager"), ("PENDING_DAF", "En attente du DAF"), ("PENDING_DG", "En attente du DG"), ("APPROVED", "Approuvée"), ("REJECTED", "Rejetée"), ("IN_PROGRESS", "En cours"), ("DONE", "Terminée / Clôturée")], default="DRAFT", max_length=20, verbose_name="Statut")),
                ("notes", models.TextField(blank=True, default="", verbose_name="Notes / Observations")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Créé le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Modifié le")),
                ("agent_liaison", models.ForeignKey(blank=True, limit_choices_to={"is_agent_liaison": True}, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="missions_comme_agent_liaison", to=settings.AUTH_USER_MODEL, verbose_name="Agent de liaison")),
                ("beneficiaire", models.ForeignKey(blank=True, help_text="Laisser vide pour un prestataire externe", null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="fiches_mission", to=settings.AUTH_USER_MODEL, verbose_name="Bénéficiaire (personnel)")),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="fiches_mission_creees", to=settings.AUTH_USER_MODEL, verbose_name="Créé par")),
                ("department", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="fiches_mission", to="departments.department", verbose_name="Département")),
            ],
            options={"verbose_name": "Fiche de Mission", "verbose_name_plural": "Fiches de Mission", "ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="AbsenceAgent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date_debut", models.DateField(verbose_name="Date de début")),
                ("date_fin", models.DateField(verbose_name="Date de fin")),
                ("motif", models.CharField(choices=[("MISSION", "Déplacement mission"), ("FORMATION", "Formation / Cours"), ("ACTIVITE", "Activité extérieure entreprise"), ("AUTRE", "Autre")], default="MISSION", max_length=20, verbose_name="Motif")),
                ("description", models.TextField(blank=True, default="", verbose_name="Description")),
                ("status", models.CharField(choices=[("DECLARED", "Déclarée"), ("VALIDATED", "Validée"), ("CANCELLED", "Annulée")], default="DECLARED", max_length=20, verbose_name="Statut")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Déclarée le")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Modifiée le")),
                ("agent", models.ForeignKey(limit_choices_to={"is_agent_liaison": True}, on_delete=django.db.models.deletion.CASCADE, related_name="absences", to=settings.AUTH_USER_MODEL, verbose_name="Agent")),
                ("fiche_mission", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="absences_agents", to="missions.fichemission", verbose_name="Fiche de mission associée")),
            ],
            options={"verbose_name": "Absence Agent", "verbose_name_plural": "Absences Agents", "ordering": ["-date_debut"]},
        ),
    ]
