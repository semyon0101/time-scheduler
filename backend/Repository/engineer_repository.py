from sqlalchemy.orm import Session

from backend.Entities.engineer import Engineer


class EngineerRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all_by_dispatcher(self, dispatcher_id: str) -> list[Engineer]:
        return self.db.query(Engineer).filter(Engineer.dispatcher_id == dispatcher_id).all()

    def get_active_by_dispatcher(self, dispatcher_id: str) -> list[Engineer]:
        return (
            self.db.query(Engineer)
            .filter(Engineer.dispatcher_id == dispatcher_id, Engineer.status != "unavailable")
            .all()
        )

    def get_by_id(self, dispatcher_id: str, engineer_id: str) -> Engineer | None:
        return (
            self.db.query(Engineer).filter(Engineer.dispatcher_id == dispatcher_id, Engineer.id == engineer_id).first()
        )

    def create(self, engineer: Engineer) -> Engineer:
        self.db.add(engineer)
        self.db.commit()
        self.db.refresh(engineer)
        return engineer

    def delete(self, dispatcher_id: str, engineer_id: str) -> bool:
        eng = self.get_by_id(dispatcher_id, engineer_id)
        if eng:
            self.db.delete(eng)
            self.db.commit()
            return True
        return False

    def delete_all_by_dispatcher(self, dispatcher_id: str) -> int:
        count = self.db.query(Engineer).filter(Engineer.dispatcher_id == dispatcher_id).delete()
        self.db.commit()
        return count

    def set_status(self, dispatcher_id: str, engineer_id: str, status: str) -> Engineer | None:
        eng = self.get_by_id(dispatcher_id, engineer_id)
        if eng:
            eng.status = status
            self.db.commit()
            self.db.refresh(eng)
        return eng

    def mark_status_for_dispatcher(self, dispatcher_id: str, from_status: str, to_status: str) -> int:
        engs = (
            self.db.query(Engineer)
            .filter(Engineer.dispatcher_id == dispatcher_id, Engineer.status == from_status)
            .all()
        )
        for e in engs:
            e.status = to_status
        self.db.commit()
        return len(engs)
