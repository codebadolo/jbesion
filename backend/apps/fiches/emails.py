"""
Utilitaires d'envoi d'e-mails de notification.

Usage :
    from apps.fiches.emails import notify_email

    notify_email(
        recipients=[user1, user2],           # objets User (ou tout objet avec .email)
        subject="Titre du mail",
        body="Corps du message.",
    )
"""

import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def notify_email(recipients, subject: str, body: str) -> None:
    """
    Envoie un e-mail à chaque destinataire qui possède une adresse e-mail.
    Échoue silencieusement pour ne jamais bloquer le workflow.

    Un lien vers l'interface est automatiquement ajouté en pied de message
    si FRONTEND_BASE_URL est défini dans les settings.
    """
    if not recipients:
        return

    frontend_url = getattr(settings, "FRONTEND_BASE_URL", "")
    full_body = body
    if frontend_url:
        full_body += f"\n\n---\nConnectez-vous : {frontend_url}"

    seen: set = set()
    for user in recipients:
        email = getattr(user, "email", None)
        if not email or email in seen:
            continue
        seen.add(email)
        try:
            send_mail(
                subject=f"[GestFiches] {subject}",
                message=full_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as exc:
            logger.warning("Envoi e-mail vers %s échoué : %s", email, exc)
