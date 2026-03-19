"""
URL patterns for the dashboard endpoint (/api/dashboard/).
"""

from django.urls import path

from .views import DashboardView

urlpatterns = [
    path("stats/", DashboardView.as_view(), name="dashboard-stats"),
]
