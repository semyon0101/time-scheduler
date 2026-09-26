"""Application configuration access."""

from functools import lru_cache

from sqlalchemy.engine import URL, make_url

from backend.Models.settings import Settings


@lru_cache
def get_settings() -> Settings:
    return Settings()


def sqlalchemy_url(database_url: str) -> URL:
    """Select the installed PostgreSQL driver across SQLAlchemy versions."""
    url = make_url(database_url)
    if url.drivername == "postgresql":
        return url.set(drivername="postgresql+psycopg2")
    return url
