"""
Root URL configuration for the Gestion des Fiches de Besoins project.

All API routes are prefixed with /api/.
"""

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

# ── Schéma drf-yasg ────────────────────────────────────────────────────────

schema_view = get_schema_view(
    openapi.Info(
        title="Gestion des Fiches de Besoins — API",
        default_version="v1",
        description=(
            "API REST pour la gestion et le suivi des fiches de besoins "
            "internes et externes au sein de l'entreprise.\n\n"
            "## Authentification\n"
            "Toutes les routes (sauf `/api/auth/login/`) nécessitent un token JWT.\n"
            "Obtenez un token via `POST /api/auth/login/` puis transmettez-le dans l'en-tête :\n"
            "```\nAuthorization: Bearer <access_token>\n```\n\n"
            "## Workflows de validation\n"
            "- **Fiche Interne** : `DRAFT → PENDING_MANAGER → PENDING_DAF → PENDING_DIRECTOR → APPROVED / REJECTED`\n"
            "- **Fiche Externe** : `DRAFT → PENDING_MANAGER → PENDING_DIRECTOR → APPROVED / REJECTED`"
        ),
        contact=openapi.Contact(email="admin@jofedigital.com"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    # Django admin
    path("admin/", admin.site.urls),

    # ── API ────────────────────────────────────────────────────────────────
    path("api/auth/",            include("apps.accounts.urls")),
    path("api/users/",           include("apps.accounts.user_urls")),
    path("api/departments/",     include("apps.departments.urls")),
    path("api/fiches-internes/", include("apps.fiches.urls_interne")),
    path("api/fiches-externes/", include("apps.fiches.urls_externe")),
    path("api/dashboard/",       include("apps.fiches.urls_dashboard")),
    path("api/notifications/",   include("apps.fiches.urls_notifications")),
    path("api/bons-paiement/",   include("apps.bons_paiement.urls")),
    path("api/bons-commande/",   include("apps.bons_commande.urls")),
    path("api/missions/",        include("apps.missions.urls")),

    # ── Documentation ──────────────────────────────────────────────────────
    # Schéma brut JSON/YAML  →  /api/schema.json  ou  /api/schema.yaml
    re_path(r"^api/schema(?P<format>\.json|\.yaml)$",
            schema_view.without_ui(cache_timeout=0), name="schema-json"),
    # Swagger UI  →  http://localhost:8000/api/swagger/
    path("api/swagger/",
         schema_view.with_ui("swagger", cache_timeout=0), name="schema-swagger-ui"),
    # ReDoc       →  http://localhost:8000/api/redoc/
    path("api/redoc/",
         schema_view.with_ui("redoc",   cache_timeout=0), name="schema-redoc"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
