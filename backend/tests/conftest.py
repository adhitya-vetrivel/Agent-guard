import os
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["ADMIN_PASSWORD"] = "test-admin-password"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"
os.environ["DATABASE_URL_SYNC"] = "sqlite:///./test.db"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["DEBUG"] = "false"
os.environ["DEMO_MODE"] = "false"
os.environ["RATE_LIMIT_PER_MINUTE"] = "1000"

import asyncio
import uuid
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.database.base import Base

# Import ALL models so they register with Base.metadata and relationships resolve
from app.models import user, agent, policy, tool_call, audit_log, risk_event, session, scenario, risk_contribution, incident_report, trust_edge, operator_activity, replay_event, demo_environment
from app.models.agent import Agent, AgentStatus


TEST_DATABASE_URL = "sqlite+aiosqlite://"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def session(engine) -> AsyncGenerator[AsyncSession, None]:
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as s:
        try:
            await s.begin()
            yield s
        finally:
            await s.rollback()


@pytest_asyncio.fixture
async def sample_agent(session: AsyncSession) -> Agent:
    agent = Agent(
        id=str(uuid.uuid4()),
        name="TestAgent",
        role="research",
        capabilities='["search_web", "read_file"]',
        status=AgentStatus.ACTIVE,
        risk_score=0.0,
        is_demo=False,
    )
    session.add(agent)
    await session.flush()
    return agent


@pytest_asyncio.fixture
async def sample_agent_with_risk(session: AsyncSession) -> Agent:
    agent = Agent(
        id=str(uuid.uuid4()),
        name="HighRiskAgent",
        role="admin",
        capabilities='["search_web", "read_file", "write_file", "execute_command"]',
        status=AgentStatus.ACTIVE,
        risk_score=50.0,
        is_demo=False,
    )
    session.add(agent)
    await session.flush()
    return agent
