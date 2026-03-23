"""
Serializers for the accounts app.

Includes:
  - UserSerializer        : full user representation (read)
  - UserCreateSerializer  : admin user creation
  - UserUpdateSerializer  : profile update by the user themselves
  - LoginSerializer       : validate credentials and return tokens
  - TokenRefreshSerializer: thin wrapper (re-uses simplejwt)
  - ChangePasswordSerializer
"""

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from apps.departments.serializers import DepartmentShortSerializer
from .models import User


# ---------------------------------------------------------------------------
# User serializers
# ---------------------------------------------------------------------------

class ManagerShortSerializer(serializers.ModelSerializer):
    """Minimal manager representation embedded in UserSerializer."""

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "role"]


class UserSerializer(serializers.ModelSerializer):
    """
    Full user representation (used for GET /me/ and user listings).
    Embeds a short department and manager representation.
    """
    department_detail = DepartmentShortSerializer(source="department", read_only=True)
    manager_detail = ManagerShortSerializer(source="manager", read_only=True)
    full_name = serializers.SerializerMethodField()
    is_finance_team = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "department",
            "department_detail",
            "manager",
            "manager_detail",
            "phone",
            "avatar",
            "is_active",
            "is_finance_team",
            "date_joined",
            "last_login",
        ]
        read_only_fields = ["id", "date_joined", "last_login"]

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name() or obj.username

    def get_is_finance_team(self, obj: User) -> bool:
        return bool(obj.department and obj.department.code == "AF")


class UserCreateSerializer(serializers.ModelSerializer):
    """
    Used by admins to create a new user.
    Requires a password that is validated via Django's built-in validators.
    """
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "department",
            "manager",
            "phone",
            "password",
            "password_confirm",
        ]

    def validate(self, data: dict) -> dict:
        if data["password"] != data.pop("password_confirm"):
            raise serializers.ValidationError(
                {"password_confirm": "Les mots de passe ne correspondent pas."}
            )
        validate_password(data["password"])
        return data

    def create(self, validated_data: dict) -> User:
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Allows an authenticated user to update their own profile.
    Role and is_active are excluded (only admin can change those).
    """

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "email",
            "phone",
            "avatar",
            "department",
            "manager",
        ]


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """
    Used by admins to update any user's profile, including role, department,
    manager and active status. Password update is optional.
    """
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "email",
            "phone",
            "role",
            "department",
            "manager",
            "is_active",
            "password",
        ]

    def update(self, instance: User, validated_data: dict) -> User:
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    """Change password for the authenticated user."""
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)
    new_password_confirm = serializers.CharField(required=True, write_only=True)

    def validate_old_password(self, value: str) -> str:
        user: User = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("L'ancien mot de passe est incorrect.")
        return value

    def validate(self, data: dict) -> dict:
        if data["new_password"] != data["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Les nouveaux mots de passe ne correspondent pas."}
            )
        validate_password(data["new_password"])
        return data

    def save(self, **kwargs) -> User:
        user: User = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user


# ---------------------------------------------------------------------------
# Authentication serializers
# ---------------------------------------------------------------------------

class LoginSerializer(serializers.Serializer):
    """
    Validates username + password and returns a pair of JWT tokens
    together with the user's profile.
    """
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, data: dict) -> dict:
        username = data.get("username")
        password = data.get("password")

        user = authenticate(
            request=self.context.get("request"),
            username=username,
            password=password,
        )

        if not user:
            raise serializers.ValidationError(
                "Identifiants invalides. Veuillez vérifier votre nom d'utilisateur et mot de passe."
            )

        if not user.is_active:
            raise serializers.ValidationError("Ce compte a été désactivé.")

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        return {
            "user": user,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
