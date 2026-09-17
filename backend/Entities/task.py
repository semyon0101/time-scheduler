from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.Entities.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, index=True)
    dispatcher_id = Column(String, ForeignKey("dispatchers.id", ondelete="CASCADE"), primary_key=True, index=True)
    address = Column(String, nullable=False)
    district = Column(String, default="")
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    window_start = Column(String, default="09:00")
    window_end = Column(String, default="22:00")
    duration_min = Column(Integer, default=45)
    required_skill = Column(String, default="Локальные работы")
    required_transport = Column(String, nullable=True)
    priority = Column(String, default="Обычная")
    status = Column(String, default="active")  # "active" | "cancelled" | "new"
    control_assigned_engineer = Column(String, nullable=True)

    dispatcher = relationship("Dispatcher", back_populates="tasks")
