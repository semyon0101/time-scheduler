"""Application configuration access."""

from functools import lru_cache

from backend.Models.settings import Settings


@lru_cache
def get_settings() -> Settings:
    return Settings()
