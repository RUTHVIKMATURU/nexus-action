import os
from typing import Optional

try:
    # Pydantic v2 compatibility
    from pydantic_settings import BaseSettings, SettingsConfigDict
    
    class Settings(BaseSettings):
        PORT: int
        LLM_API_KEY: str

        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore"
        )
except ImportError:
    # Pydantic v1 fallback
    from pydantic import BaseSettings
    
    class Settings(BaseSettings):
        PORT: int
        LLM_API_KEY: str

        class Config:
            env_file = ".env"
            extra = "ignore"

settings = Settings()
