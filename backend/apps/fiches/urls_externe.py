"""
URL patterns for FicheExterne endpoints (/api/fiches-externes/).
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import FicheExterneViewSet

router = DefaultRouter()
router.register(r"", FicheExterneViewSet, basename="fiches-externes")

urlpatterns = [
    path("", include(router.urls)),
]
