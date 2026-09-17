from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.Entities.database import Base


class ScheduleRecord(Base):
    __tablename__ = "schedule_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dispatcher_id = Column(String, ForeignKey("dispatchers.id", ondelete="CASCADE"), index=True)
    engineer_id = Column(String, nullable=False, index=True)
    engineer_name = Column(String, nullable=False)
    transport_type = Column(String, default="Автомобиль")
    task_id = Column(String, nullable=False)
    task_address = Column(String, nullable=False)
    district = Column(String, default="")
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    order = Column(Integer, nullable=False)
    arrival_time = Column(String, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    travel_km = Column(Float, default=0.0)
    travel_min = Column(Integer, default=0)
    required_skill = Column(String, default="Локальные работы")
    priority = Column(String, default="Обычная")

    dispatcher = relationship("Dispatcher", back_populates="schedule_items")
