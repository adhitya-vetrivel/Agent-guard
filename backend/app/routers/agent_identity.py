from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Any
from app.database.base import get_session
from app.security.auth import get_current_user
from app.models.user import User
from app.services.agent_identity import AgentCryptoService

router = APIRouter(prefix="/api/agent-identity", tags=["Agent Identity"])


class KeyGenResponse(BaseModel):
    private_key: str
    public_key: str


class RegisterKeyRequest(BaseModel):
    agent_id: str
    public_key: str


class SignRequest(BaseModel):
    agent_id: str
    payload: dict[str, Any]


class VerifyRequest(BaseModel):
    agent_id: str
    payload: dict[str, Any]
    signature: str


@router.post("/generate-keys", response_model=KeyGenResponse)
async def generate_keys(user: User = Depends(get_current_user)):
    private_key, public_key = AgentCryptoService.generate_key_pair()
    return KeyGenResponse(private_key=private_key, public_key=public_key)


@router.post("/register-key")
async def register_key(
    request: RegisterKeyRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    service = AgentCryptoService(session)
    ok = await service.register_public_key(request.agent_id, request.public_key)
    if not ok:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"status": "registered"}


@router.post("/sign")
async def sign_request(
    request: SignRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.agent import Agent
    result = await session.execute(select(Agent).where(Agent.id == request.agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    # For demo, sign with a generated key pair
    private_key, _ = AgentCryptoService.generate_key_pair()
    signature = AgentCryptoService.sign_request(private_key, request.payload)
    return {"signature": signature, "agent_id": request.agent_id}


@router.post("/verify")
async def verify_request(
    request: VerifyRequest,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.agent import Agent
    result = await session.execute(select(Agent).where(Agent.id == request.agent_id))
    agent = result.scalar_one_or_none()
    if not agent or not agent.public_key:
        raise HTTPException(status_code=400, detail="Agent has no registered public key")
    valid = AgentCryptoService.verify_signature(agent.public_key, request.payload, request.signature)
    return {"valid": valid}
