"""
Views for the departments app.

- Admin users can create / update / delete departments.
- All authenticated users can list / retrieve.
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsAdminOrReadOnly
from .models import Department
from .serializers import DepartmentSerializer


class DepartmentViewSet(viewsets.ModelViewSet):
    """
    CRUD for departments.

    Permissions:
      GET  list / retrieve  → any authenticated user
      POST / PUT / PATCH / DELETE → admin only
    """

    queryset = Department.objects.all().order_by("name")
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
