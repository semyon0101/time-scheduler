from sqlalchemy.orm import Session

from backend.Entities.metrics import PlanMetricsRecord


class MetricsRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_dispatcher(self, dispatcher_id: str) -> PlanMetricsRecord | None:
        return self.db.query(PlanMetricsRecord).filter(PlanMetricsRecord.dispatcher_id == dispatcher_id).first()

    def upsert(self, metrics: PlanMetricsRecord) -> PlanMetricsRecord:
        existing = self.get_by_dispatcher(metrics.dispatcher_id)
        if existing:
            existing.baseline_engineers = metrics.baseline_engineers
            existing.baseline_mileage = metrics.baseline_mileage
            existing.optimized_engineers = metrics.optimized_engineers
            existing.optimized_mileage = metrics.optimized_mileage
            existing.assigned_count = metrics.assigned_count
            existing.unassigned_count = metrics.unassigned_count
            existing.mileage_reduction_pct = metrics.mileage_reduction_pct
            existing.engineers_reduction_pct = metrics.engineers_reduction_pct
            existing.unassigned_json = metrics.unassigned_json
            self.db.commit()
            self.db.refresh(existing)
            return existing
        else:
            self.db.add(metrics)
            self.db.commit()
            self.db.refresh(metrics)
            return metrics

    def delete_by_dispatcher(self, dispatcher_id: str) -> int:
        count = self.db.query(PlanMetricsRecord).filter(PlanMetricsRecord.dispatcher_id == dispatcher_id).delete()
        self.db.commit()
        return count
