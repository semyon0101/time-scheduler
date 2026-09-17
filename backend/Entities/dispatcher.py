import datetime

from sqlalchemy import Column, DateTime, String
from sqlalchemy.orm import relationship

from backend.Entities.database import Base


def get_utc_now():
    return datetime.datetime.now(datetime.UTC)


class Dispatcher(Base):
    __tablename__ = "dispatchers"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=get_utc_now)
    active_preset = Column(String, default="vostok")

    engineers = relationship("Engineer", back_populates="dispatcher", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="dispatcher", cascade="all, delete-orphan")
    schedule_items = relationship("ScheduleRecord", back_populates="dispatcher", cascade="all, delete-orphan")
