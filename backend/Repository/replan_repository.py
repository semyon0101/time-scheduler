"""Persist a validated replanning result as one database transaction."""

import json

from sqlalchemy.orm import Session

from backend.Entities.engineer import Engineer
from backend.Entities.explanation import ExplanationCache
from backend.Entities.metrics import PlanMetricsRecord
from backend.Entities.schedule import ScheduleRecord
from backend.Entities.task import Task
from backend.Models.optimization import QUALITY_METRIC_FIELDS, PlanMetrics, UnassignedTask


class ReplanRepository:
    def __init__(self, db: Session):
        self.db = db

    def save(
        self,
        dispatcher_id: str,
        *,
        new_tasks: list[Task],
        cancelled_ids: set[str],
        unavailable_ids: set[str],
        schedule_records: list[ScheduleRecord],
        replace_schedule: bool,
        metrics: PlanMetrics,
        unassigned: list[UnassignedTask],
    ) -> None:
        assigned_ids = {record.task_id for record in schedule_records}
        try:
            self.db.add_all(new_tasks)
            self.db.query(Task).filter(Task.dispatcher_id == dispatcher_id, Task.id.in_(cancelled_ids)).update(
                {Task.status: "cancelled"}, synchronize_session=False
            )
            self.db.query(Task).filter(Task.dispatcher_id == dispatcher_id, Task.id.in_(assigned_ids)).update(
                {Task.status: "active"}, synchronize_session=False
            )
            self.db.query(Engineer).filter(
                Engineer.dispatcher_id == dispatcher_id, Engineer.id.in_(unavailable_ids)
            ).update({Engineer.status: "unavailable"}, synchronize_session=False)
            if replace_schedule:
                self.db.query(ScheduleRecord).filter(ScheduleRecord.dispatcher_id == dispatcher_id).delete(
                    synchronize_session=False
                )
                self.db.query(ExplanationCache).filter(ExplanationCache.dispatcher_id == dispatcher_id).delete(
                    synchronize_session=False
                )
                self.db.add_all(schedule_records)
            rec = self.db.query(PlanMetricsRecord).filter(PlanMetricsRecord.dispatcher_id == dispatcher_id).first()
            if rec is None:
                rec = PlanMetricsRecord(dispatcher_id=dispatcher_id)
                self.db.add(rec)
            rec.optimized_engineers = metrics.total_engineers_used
            rec.optimized_mileage = metrics.total_mileage_km
            rec.assigned_count = metrics.assigned_tasks_count
            rec.unassigned_count = metrics.unassigned_tasks_count
            rec.unassigned_json = json.dumps([item.model_dump() for item in unassigned], ensure_ascii=False)
            rec.mileage_reduction_pct = metrics.mileage_reduction_pct
            rec.engineers_reduction_pct = metrics.engineers_reduction_pct
            for field in QUALITY_METRIC_FIELDS:
                setattr(rec, field, getattr(metrics, field))
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
