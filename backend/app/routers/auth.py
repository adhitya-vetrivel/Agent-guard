from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.base import get_session
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest
from app.security.auth import hash_password, verify_password, create_access_token, create_refresh_token, decode_token, get_current_user
from app.config.settings import settings

router = APIRouter(prefix="/api", tags=["Authentication"])

_used_refresh_tokens: set[str] = set()


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(request.password, user.password_hash):
        if user:
            from app.services.operator_service import OperatorSecurityService
            op_service = OperatorSecurityService(session)
            await op_service.log_activity(
                user_id=user.id,
                user_email=user.email,
                user_role=user.role.value,
                action="login_failure",
                details=f"Failed login attempt for {user.email}",
                is_login_failure=True
            )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    access_token = create_access_token({"sub": user.id, "role": user.role.value, "email": user.email})
    refresh_token = create_refresh_token({"sub": user.id, "type": "refresh"})
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        role=user.role.value,
    )


@router.post("/refresh")
async def refresh_token(request: RefreshRequest):
    if request.refresh_token in _used_refresh_tokens:
        raise HTTPException(status_code=401, detail="Refresh token has already been used")
    payload = decode_token(request.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    _used_refresh_tokens.add(request.refresh_token)
    access_token = create_access_token({"sub": payload["sub"]})
    new_refresh = create_refresh_token({"sub": payload["sub"], "type": "refresh"})
    return {"access_token": access_token, "refresh_token": new_refresh, "token_type": "bearer"}


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
    }
