from sqlalchemy import Column, Float, Integer, String, Text

from backend.Entities.database import Base


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
