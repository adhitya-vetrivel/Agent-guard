from pydantic_settings import BaseSettings
from typing import Optional
from pydantic import model_validator


class Settings(BaseSettings):
    APP_NAME: str = "AgentGuard"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://agentguard:agentguard@postgres:5432/agentguard"
    DATABASE_URL_SYNC: str = "postgresql://agentguard:agentguard@postgres:5432/agentguard"

    REDIS_URL: str = "redis://redis:6379/0"

    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://frontend:5173"]

    ADMIN_EMAIL: str = "admin@agentguard.io"
    ADMIN_PASSWORD: str = ""

    DEMO_MODE: bool = True
    DEFAULT_RISK_THRESHOLD: int = 80

    RATE_LIMIT_PER_MINUTE: int = 60

    @model_validator(mode="after")
    def check_secrets(self):
        if not self.SECRET_KEY:
            raise ValueError("SECRET_KEY must be set via .env or environment variable")
        if not self.ADMIN_PASSWORD:
            raise ValueError("ADMIN_PASSWORD must be set via .env or environment variable")
        return self

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
