"""
Views for the accounts app.

Covers:
  - AuthViewSet        : login, refresh, logout, me (GET/PUT), change_password
  - UserViewSet        : admin CRUD + /managers/ helper endpoint
"""

from django.contrib.auth import update_session_auth_hash
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .models import User, Role
from .permissions import IsAdminRole, IsOwnerOrAdmin
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    AdminUserUpdateSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
)


# ---------------------------------------------------------------------------
# Auth endpoints  (/api/auth/)
# ---------------------------------------------------------------------------

class AuthViewSet(viewsets.ViewSet):
    """
    Handles authentication actions:
      POST /login/          → obtain JWT pair
      POST /refresh/        → refresh access token
      POST /logout/         → blacklist refresh token
      GET  /me/             → current user profile
      PUT  /me/             → update current user profile
      POST /me/change_password/ → change password
    """

    def get_permissions(self):
        if self.action in ("login",):
            return [AllowAny()]
        return [IsAuthenticated()]

    # ------------------------------------------------------------------
    # POST /api/auth/login/
    # ------------------------------------------------------------------
    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def login(self, request: Request) -> Response:
        """Authenticate with username + password, return JWT tokens."""
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        user: User = data["user"]
        user_data = UserSerializer(user, context={"request": request}).data

        return Response(
            {
                "access": data["access"],
                "refresh": data["refresh"],
                "user": user_data,
            },
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # POST /api/auth/refresh/
    # ------------------------------------------------------------------
    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def refresh(self, request: Request) -> Response:
        """
        Accepts {"refresh": "<token>"} and returns a new access token.
        """
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Le token de rafraîchissement est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            return Response({"access": str(token.access_token)}, status=status.HTTP_200_OK)
        except Exception:
            return Response(
                {"detail": "Token de rafraîchissement invalide ou expiré."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

    # ------------------------------------------------------------------
    # POST /api/auth/logout/
    # ------------------------------------------------------------------
    @action(detail=False, methods=["post"])
    def logout(self, request: Request) -> Response:
        """Blacklist the provided refresh token."""
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "Le token de rafraîchissement est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {"detail": "Déconnexion réussie."},
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # GET / PUT /api/auth/me/
    # ------------------------------------------------------------------
    @action(detail=False, methods=["get", "put", "patch"])
    def me(self, request: Request) -> Response:
        """Return or update the current user's profile."""
        user: User = request.user

        if request.method == "GET":
            serializer = UserSerializer(user, context={"request": request})
            return Response(serializer.data)

        # PUT / PATCH
        partial = request.method == "PATCH"
        serializer = UserUpdateSerializer(
            user, data=request.data, partial=partial, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            UserSerializer(user, context={"request": request}).data
        )

    # ------------------------------------------------------------------
    # POST /api/auth/me/change_password/
    # ------------------------------------------------------------------
    @action(detail=False, methods=["post"], url_path="me/change_password")
    def change_password(self, request: Request) -> Response:
        """Change the current user's password."""
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # Keep session alive after password change
        update_session_auth_hash(request, user)
        return Response(
            {"detail": "Mot de passe modifié avec succès."},
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# User management  (/api/users/)
# ---------------------------------------------------------------------------

class UserViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD for users + convenience helper /managers/.

    Permissions:
      - list / retrieve : Admin only (other roles use /auth/me/)
      - create / update / delete : Admin only
    """

    queryset = User.objects.select_related("department", "manager").order_by(
        "last_name", "first_name"
    )
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_queryset(self):
        qs = super().get_queryset()
        manager_id = self.request.query_params.get("manager")
        if manager_id:
            qs = qs.filter(manager_id=manager_id)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("update", "partial_update"):
            return AdminUserUpdateSerializer
        return UserSerializer

    def get_permissions(self):
        # Managers and agents_liaison endpoints are accessible to all authenticated users
        if self.action in ("managers", "agents_liaison"):
            return [IsAuthenticated()]
        # DIRECTOR and DAF can read the user list (but not create/edit/delete)
        if self.action in ("list", "retrieve") and getattr(self.request.user, "role", None) in (
            Role.DIRECTOR, Role.DAF
        ):
            return [IsAuthenticated()]
        return super().get_permissions()

    # ------------------------------------------------------------------
    # GET /api/users/managers/
    # ------------------------------------------------------------------
    @action(detail=False, methods=["get"])
    def managers(self, request: Request) -> Response:
        """Return all users with MANAGER or DIRECTOR role (used in dropdowns)."""
        qs = User.objects.filter(
            role__in=[Role.MANAGER, Role.DIRECTOR, Role.DAF],
            is_active=True,
        ).order_by("last_name", "first_name")
        serializer = UserSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def agents_liaison(self, request: Request) -> Response:
        """Return all active agents de liaison (used in dropdowns)."""
        qs = User.objects.filter(is_agent_liaison=True, is_active=True).order_by(
            "last_name", "first_name"
        )
        serializer = UserSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        """Prevent deleting your own account."""
        instance: User = self.get_object()
        if instance == request.user:
            return Response(
                {"detail": "Vous ne pouvez pas supprimer votre propre compte."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)
