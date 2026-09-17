from sqlalchemy.orm import Session

from backend.Entities.schedule import ScheduleRecord


class ScheduleRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all_by_dispatcher(self, dispatcher_id: str) -> list[ScheduleRecord]:
        return (
            self.db.query(ScheduleRecord)
            .filter(ScheduleRecord.dispatcher_id == dispatcher_id)
            .order_by(ScheduleRecord.engineer_id, ScheduleRecord.order)
            .all()
        )

    def get_by_engineer(self, dispatcher_id: str, engineer_id: str) -> list[ScheduleRecord]:
        return (
            self.db.query(ScheduleRecord)
            .filter(ScheduleRecord.dispatcher_id == dispatcher_id, ScheduleRecord.engineer_id == engineer_id)
            .order_by(ScheduleRecord.order)
            .all()
        )

    def get_by_task(self, dispatcher_id: str, task_id: str) -> ScheduleRecord | None:
        return (
            self.db.query(ScheduleRecord)
            .filter(ScheduleRecord.dispatcher_id == dispatcher_id, ScheduleRecord.task_id == task_id)
            .first()
        )

    def bulk_create(self, records: list[ScheduleRecord]) -> None:
        if records:
            self.db.add_all(records)
            self.db.commit()

    def delete_all_by_dispatcher(self, dispatcher_id: str) -> int:
        count = self.db.query(ScheduleRecord).filter(ScheduleRecord.dispatcher_id == dispatcher_id).delete()
        self.db.commit()
        return count

    def delete_by_engineer(self, dispatcher_id: str, engineer_id: str) -> int:
        count = (
            self.db.query(ScheduleRecord)
            .filter(ScheduleRecord.dispatcher_id == dispatcher_id, ScheduleRecord.engineer_id == engineer_id)
            .delete()
        )
        self.db.commit()
        return count

    def delete_by_task(self, dispatcher_id: str, task_id: str) -> int:
        count = (
            self.db.query(ScheduleRecord)
            .filter(ScheduleRecord.dispatcher_id == dispatcher_id, ScheduleRecord.task_id == task_id)
            .delete()
        )
        self.db.commit()
        return count
