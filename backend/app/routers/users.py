from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.database.base import get_session
from app.security.auth import get_admin_user, hash_password
from app.models.user import User, UserRole
from app.models.audit_log import AuditAction
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api/users", tags=["User Management"])


class UserCreateRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str


class UserUpdateRequest(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    created_at: str


@router.get("", response_model=list[UserResponse])
async def list_users(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    result = await session.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role.value,
            is_active=u.is_active,
            created_at=u.created_at.isoformat() if u.created_at else "",
        )
        for u in users
    ]


@router.post("", response_model=UserResponse)
async def create_user(
    data: UserCreateRequest,
    fastapi_request: FastAPIRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    existing = await session.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already in use")

    try:
        role = UserRole(data.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")

    new_user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
        role=role,
    )
    session.add(new_user)
    await session.flush()

    audit = AuditService(session)
    await audit.log(
        action=AuditAction.USER_CREATED,
        user_id=user.id,
        details=f"User '{data.email}' created with role '{data.role}'",
        ip_address=fastapi_request.client.host if fastapi_request.client else None,
    )
    from app.services.operator_service import OperatorSecurityService
    op_service = OperatorSecurityService(session)
    await op_service.log_activity(
        user_id=user.id,
        user_email=user.email,
        user_role=user.role.value,
        action="user_creation",
        details=f"User '{data.email}' created with role '{data.role}' by {user.email}",
        ip_address=fastapi_request.client.host if fastapi_request.client else "127.0.0.1"
    )

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        name=new_user.name,
        role=new_user.role.value,
        is_active=new_user.is_active,
        created_at=new_user.created_at.isoformat() if new_user.created_at else "",
    )


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdateRequest,
    fastapi_request: FastAPIRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    result = await session.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    changes = []
    if data.email is not None:
        target.email = data.email
        changes.append(f"email={data.email}")
    if data.name is not None:
        target.name = data.name
        changes.append(f"name={data.name}")
    if data.is_active is not None:
        target.is_active = data.is_active
        changes.append(f"active={data.is_active}")
    if data.role is not None:
        old_role = target.role.value
        try:
            target.role = UserRole(data.role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")
        changes.append(f"role={old_role}->{data.role}")

    await session.flush()

    audit = AuditService(session)
    action = AuditAction.ROLE_CHANGED if data.role else AuditAction.USER_UPDATED
    await audit.log(
        action=action,
        user_id=user.id,
        details=f"User '{target.email}' updated: {', '.join(changes)}",
        ip_address=fastapi_request.client.host if fastapi_request.client else None,
    )
    from app.services.operator_service import OperatorSecurityService
    op_service = OperatorSecurityService(session)
    action_type = "role_change" if data.role is not None else "settings_change"
    await op_service.log_activity(
        user_id=user.id,
        user_email=user.email,
        user_role=user.role.value,
        action=action_type,
        details=f"User '{target.email}' updated: {', '.join(changes)} by {user.email}",
        ip_address=fastapi_request.client.host if fastapi_request.client else "127.0.0.1"
    )
    return UserResponse(
        id=target.id,
        email=target.email,
        name=target.name,
        role=target.role.value,
        is_active=target.is_active,
        created_at=target.created_at.isoformat() if target.created_at else "",
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    fastapi_request: FastAPIRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    result = await session.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    email = target.email
    await session.delete(target)
    await session.flush()

    audit = AuditService(session)
    await audit.log(
        action=AuditAction.USER_DELETED,
        user_id=user.id,
        details=f"User '{email}' deleted",
        ip_address=fastapi_request.client.host if fastapi_request.client else None,
    )

    return {"message": f"User '{email}' deleted"}
