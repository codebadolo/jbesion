import datetime

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("missions", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="fichemission",
            name="date",
            field=models.DateField(default=datetime.date.today, verbose_name="Date de la fiche"),
        ),
    ]
