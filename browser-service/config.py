"""
Configuration management using pydantic-settings
"""
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with environment variable support"""

    # Application
    environment: str = "development"
    log_level: str = "INFO"
    api_key: str = ""  # Internal API key for service authentication

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 2

    # Redis Queue
    redis_url: str = "redis://localhost:6379/0"
    queue_name: str = "browser-automation"
    job_timeout: int = 600  # 10 minutes max per job
    result_ttl: int = 3600  # Keep results for 1 hour

    # Browser Settings
    headless: bool = True
    max_browser_sessions: int = 3
    browser_timeout: int = 60000  # 60 seconds

    # AI/LLM API Keys
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None

    # Supabase (if needed for direct DB access)
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None

    # Monitoring
    sentry_dsn: Optional[str] = None
    sentry_environment: Optional[str] = None
    sentry_traces_sample_rate: float = 0.1

    # Gmail OAuth
    gmail_client_id: Optional[str] = None
    gmail_client_secret: Optional[str] = None
    gmail_redirect_uri: Optional[str] = None

    # Rate Limiting
    max_concurrent_jobs: int = 5
    rate_limit_per_minute: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# For backwards compatibility
settings = get_settings()
