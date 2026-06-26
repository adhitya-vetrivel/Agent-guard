from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.security.auth import get_current_user
from app.models.user import User
from app.services.policy_dsl import compile_dsl, PolicyDSEngine

router = APIRouter(prefix="/api/policy-dsl", tags=["Policy DSL"])


class DSLValidateRequest(BaseModel):
    source: str


class DSLCompileRequest(BaseModel):
    source: str


@router.post("/validate")
async def validate_dsl(
    request: DSLValidateRequest,
    user: User = Depends(get_current_user),
):
    engine = PolicyDSEngine()
    errors = engine.validate(request.source)
    return {"valid": len(errors) == 0, "errors": errors}


@router.post("/compile")
async def compile_dsl_endpoint(
    request: DSLCompileRequest,
    user: User = Depends(get_current_user),
):
    try:
        rules = compile_dsl(request.source)
        return {"rules": rules, "rule_count": len(rules)}
    except SyntaxError as e:
        raise HTTPException(status_code=400, detail=str(e))
