from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.config import get_settings, sqlalchemy_url

settings = get_settings()

DATABASE_URL = settings.database_url

# PostgreSQL configuration with connection health checks
engine = create_engine(sqlalchemy_url(DATABASE_URL), pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables(bind_engine=None):
    target_engine = bind_engine or engine
    Base.metadata.create_all(bind=target_engine)
    from backend.Repository.schema_migrations import migrate_planning_fields

    migrate_planning_fields(target_engine)
