from sqlalchemy.orm import Session

from backend.Entities.explanation import ExplanationCache


class ExplanationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_cache(self, dispatcher_id: str, task_id: str) -> ExplanationCache | None:
        return (
            self.db.query(ExplanationCache)
            .filter(ExplanationCache.dispatcher_id == dispatcher_id, ExplanationCache.task_id == task_id)
            .first()
        )

    def save_cache(self, cache: ExplanationCache) -> ExplanationCache:
        self.db.add(cache)
        self.db.commit()
        self.db.refresh(cache)
        return cache

    def delete_by_dispatcher(self, dispatcher_id: str) -> int:
        count = self.db.query(ExplanationCache).filter(ExplanationCache.dispatcher_id == dispatcher_id).delete()
        self.db.commit()
        return count

    def delete_by_engineer(self, dispatcher_id: str, engineer_id: str) -> int:
        count = (
            self.db.query(ExplanationCache)
            .filter(
                ExplanationCache.dispatcher_id == dispatcher_id, ExplanationCache.assigned_engineer_id == engineer_id
            )
            .delete()
        )
        self.db.commit()
        return count

    def delete_by_task(self, dispatcher_id: str, task_id: str) -> int:
        count = (
            self.db.query(ExplanationCache)
            .filter(ExplanationCache.dispatcher_id == dispatcher_id, ExplanationCache.task_id == task_id)
            .delete()
        )
        self.db.commit()
        return count
