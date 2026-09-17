import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from backend.Entities.database import Base


def get_utc_now():
    return datetime.datetime.now(datetime.UTC)


class ExplanationCache(Base):
    __tablename__ = "explanation_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dispatcher_id = Column(String, index=True)
    task_id = Column(String, index=True)
    assigned_engineer_id = Column(String, nullable=True)
    explanation_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=get_utc_now)
