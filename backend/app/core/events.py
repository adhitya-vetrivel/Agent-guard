from app.database.base import init_db
from app.services.demo_service import seed_demo_data
from app.database.base import async_session_factory
from app.services.behavior_service import BehaviorService
from app.models.agent import Agent
from sqlalchemy import select


async def _init_anomaly_detector():
    """Load existing data into anomaly detector so it's trained on startup."""
    from app.anomaly.detector import anomaly_detector
    import random

    async with async_session_factory() as session:
        result = await session.execute(select(Agent).where(Agent.is_demo == True))
        agents = result.scalars().all()
        if not agents:
            return

        behavior_service = BehaviorService(session)
        for agent in agents:
            profile = await behavior_service.build_behavior_profile(agent.id)
            features = anomaly_detector.extract_features(profile)
            n = 6 if profile.get("tool_frequency_24h", 0) > 40 else 4
            for _ in range(n):
                noisy = [f + random.uniform(-0.5, 0.5) * max(abs(f), 1) for f in features]
                anomaly_detector.add_sample(noisy, role=agent.role, agent_id=agent.id)

        print(f"Anomaly detector initialized: {len(anomaly_detector.global_buffer)} global samples, trained={anomaly_detector.global_initialized}, roles={list(anomaly_detector.role_models.keys())}")


async def startup_event():
    await init_db()
    from app.config.settings import settings
    if settings.DEMO_MODE:
        await seed_demo_data()
    await _init_anomaly_detector()
