import datetime

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bons_paiement", "0003_simplify_mode_paiement"),
    ]

    operations = [
        migrations.AlterField(
            model_name="bonpaiement",
            name="date",
            field=models.DateField(default=datetime.date.today, verbose_name="Date"),
        ),
    ]
