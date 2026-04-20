"""
Development-specific Django settings.

Extends base.py with development conveniences:
  - DEBUG = True
  - CORS allow all origins
  - Django debug toolbar (optional, installed separately)
  - Console email backend
"""

from .base import *  # noqa: F401, F403

# ---------------------------------------------------------------------------
# Debug
# ---------------------------------------------------------------------------

DEBUG = True

# ---------------------------------------------------------------------------
# CORS — allow every origin in development
# ---------------------------------------------------------------------------

CORS_ALLOW_ALL_ORIGINS = True

# If you prefer to whitelist specific origins uncomment and adjust:
# CORS_ALLOWED_ORIGINS = env.list(
#     "CORS_ALLOWED_ORIGINS",
#     default=["http://localhost:3000", "http://127.0.0.1:3000"],
# )

# ---------------------------------------------------------------------------
# Email — SMTP si EMAIL_HOST_USER est défini, sinon console
# ---------------------------------------------------------------------------

if env("EMAIL_HOST_USER", default=""):  # noqa: F405
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# ---------------------------------------------------------------------------
# DRF  — add browsable API renderer in development
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
}
