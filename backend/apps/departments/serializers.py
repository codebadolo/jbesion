"""
Serializers for the departments app.
"""

from rest_framework import serializers

from .models import Department


class DepartmentShortSerializer(serializers.ModelSerializer):
    """
    Minimal representation used when embedding department info inside
    other serializers (e.g. UserSerializer).
    """

    class Meta:
        model = Department
        fields = ["id", "name", "code"]


class DepartmentSerializer(serializers.ModelSerializer):
    """Full department representation."""

    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            "id",
            "name",
            "code",
            "description",
            "member_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_member_count(self, obj: Department) -> int:
        """Number of active users belonging to this department."""
        return obj.members.filter(is_active=True).count()
