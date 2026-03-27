from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BonCommandeViewSet

router = DefaultRouter()
router.register("", BonCommandeViewSet, basename="bons-commande")

urlpatterns = [
    path("", include(router.urls)),
]
