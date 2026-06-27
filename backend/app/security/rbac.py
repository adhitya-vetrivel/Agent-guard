from fastapi import Depends, HTTPException, status
from app.models.user import User, UserRole
from app.security.auth import get_current_user


def require_role(required_role: UserRole):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{required_role.value}' required, got '{current_user.role.value}'",
            )
        return current_user
    return role_checker


def require_any_role(required_roles: list[UserRole]):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in required_roles:
            role_names = ", ".join(r.value for r in required_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of roles [{role_names}] required, got '{current_user.role.value}'",
            )
        return current_user
    return role_checker
