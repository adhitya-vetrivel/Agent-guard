from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.config.settings import settings
from app.core.events import startup_event
from app.security.rate_limit import rate_limiter
from app.routers import auth, agents, execute, policies, audit, risk, dashboard, websocket_route, settings as settings_router, anomaly, compare, scenario, verify, risk_explanation, incidents, trust_graph, policy_dsl, agent_identity, honeytools, users, operator, demo, replay
from sqlalchemy import select, func
from app.database.base import async_session_factory
from app.models.agent import Agent
from app.models.tool_call import ToolCall
from app.models.risk_event import RiskEvent


@asynccontextmanager
async def lifespan(app: FastAPI):
    await startup_event()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"],
)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path not in ["/ws/dashboard"]:
        await rate_limiter.check(request)
    response = await call_next(request)
    return response


app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(execute.router)
app.include_router(policies.router)
app.include_router(audit.router)
app.include_router(risk.router)
app.include_router(dashboard.router)
app.include_router(websocket_route.router)
app.include_router(settings_router.router)
app.include_router(anomaly.router)
app.include_router(compare.router)
app.include_router(scenario.router)
app.include_router(verify.router)
app.include_router(risk_explanation.router)
app.include_router(incidents.router)
app.include_router(trust_graph.router)
app.include_router(policy_dsl.router)
app.include_router(agent_identity.router)
app.include_router(honeytools.router)
app.include_router(users.router)
app.include_router(operator.router)
app.include_router(demo.router)
app.include_router(replay.router)


@app.get("/api/health")
async def health():
    async with async_session_factory() as session:
        agent_count = (await session.execute(select(func.count(Agent.id)))).scalar() or 0
        tool_call_count = (await session.execute(select(func.count(ToolCall.id)))).scalar() or 0
        risk_event_count = (await session.execute(select(func.count(RiskEvent.id)))).scalar() or 0
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "demo_mode": settings.DEMO_MODE,
        "stats": {
            "agents": agent_count,
            "tool_calls": tool_call_count,
            "risk_events": risk_event_count,
        },
    }
