import datetime

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bons_commande", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="boncommande",
            name="date",
            field=models.DateField(default=datetime.date.today, verbose_name="Date"),
        ),
    ]
