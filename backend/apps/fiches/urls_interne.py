"""
URL patterns for FicheInterne endpoints (/api/fiches-internes/).
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import FicheInterneViewSet

router = DefaultRouter()
router.register(r"", FicheInterneViewSet, basename="fiches-internes")

urlpatterns = [
    path("", include(router.urls)),
]
