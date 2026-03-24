from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import BonPaiementViewSet

router = DefaultRouter()
router.register(r"", BonPaiementViewSet, basename="bons-paiement")

urlpatterns = [
    path("", include(router.urls)),
]
