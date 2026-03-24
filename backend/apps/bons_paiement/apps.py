from django.apps import AppConfig


class BonsPaiementConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.bons_paiement"
    verbose_name = "Bons de Paiement"

    def ready(self):
        import apps.bons_paiement.signals  # noqa: F401
