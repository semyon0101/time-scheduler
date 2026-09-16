import datetime
import json
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Dispatcher(Base):
    __tablename__ = "dispatchers"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    active_preset = Column(String, default="vostok")

    engineers = relationship("Engineer", back_populates="dispatcher", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="dispatcher", cascade="all, delete-orphan")
    schedule_items = relationship("ScheduleRecord", back_populates="dispatcher", cascade="all, delete-orphan")

class Engineer(Base):
    __tablename__ = "engineers"

    id = Column(String, primary_key=True, index=True)
    dispatcher_id = Column(String, ForeignKey("dispatchers.id", ondelete="CASCADE"), primary_key=True, index=True)
    name = Column(String, nullable=False)
    start_lat = Column(Float, nullable=False)
    start_lon = Column(Float, nullable=False)
    shift_start = Column(String, default="09:00")
    shift_end = Column(String, default="22:00")
    skills_json = Column(Text, default="[]")
    transport_type = Column(String, default="Автомобиль")
    status = Column(String, default="active")  # "active" | "unavailable" | "new"

    dispatcher = relationship("Dispatcher", back_populates="engineers")

    @property
    def skills(self):
        try:
            return json.loads(self.skills_json)
        except Exception:
            return []

    @skills.setter
    def skills(self, val):
        self.skills_json = json.dumps(val, ensure_ascii=False)

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

class ExplanationCache(Base):
    __tablename__ = "explanation_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dispatcher_id = Column(String, index=True)
    task_id = Column(String, index=True)
    assigned_engineer_id = Column(String, nullable=True)
    explanation_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PlanMetricsRecord(Base):
    __tablename__ = "plan_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dispatcher_id = Column(String, unique=True, index=True)
    baseline_engineers = Column(Integer, default=0)
    baseline_mileage = Column(Float, default=0.0)
    optimized_engineers = Column(Integer, default=0)
    optimized_mileage = Column(Float, default=0.0)
    assigned_count = Column(Integer, default=0)
    unassigned_count = Column(Integer, default=0)
    mileage_reduction_pct = Column(Float, nullable=True)
    engineers_reduction_pct = Column(Float, nullable=True)
    unassigned_json = Column(Text, default="[]")
