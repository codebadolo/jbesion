"""
Signals for the bons_paiement app.
Auto-generates the `numero` field (BP-XXXXX) after a new BonPaiement is created.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import BonPaiement


@receiver(post_save, sender=BonPaiement)
def set_numero(sender, instance, created, **kwargs):
    if created and not instance.numero:
        instance.numero = f"BP-{instance.pk:05d}"
        BonPaiement.objects.filter(pk=instance.pk).update(numero=instance.numero)
