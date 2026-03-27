from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FicheMissionViewSet, AbsenceAgentViewSet

router = DefaultRouter()
router.register("absences", AbsenceAgentViewSet, basename="absences-agents")
router.register("", FicheMissionViewSet, basename="missions")

urlpatterns = [
    path("", include(router.urls)),
]
