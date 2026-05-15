from functools import lru_cache

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "local"
    project_name: str = "Hinduja Antibiotic Guide"
    database_url: str = "postgresql+asyncpg://atlas:atlas@localhost:5432/atlas_antibiotic"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = Field(default="change-me-in-production", min_length=16)
    jwt_issuer: str = "hinduja-antibiotic-guide"
    access_token_minutes: int = 30
    refresh_token_days: int = 30
    otp_ttl_seconds: int = 300
    allowed_origins: list[AnyHttpUrl | str] = ["http://localhost:3000", "http://localhost:8081"]
    pdf_storage_path: str = "/tmp/reports"
    event_stream: str = "clinical-events"


@lru_cache
def get_settings() -> Settings:
    return Settings()
