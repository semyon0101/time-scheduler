from sqlalchemy.orm import Session

from backend.Entities.dispatcher import Dispatcher


class DispatcherRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, dispatcher_id: str) -> Dispatcher | None:
        return self.db.query(Dispatcher).filter(Dispatcher.id == dispatcher_id).first()

    def create(self, dispatcher_id: str, active_preset: str = "vostok") -> Dispatcher:
        dispatcher = Dispatcher(id=dispatcher_id, active_preset=active_preset)
        self.db.add(dispatcher)
        self.db.commit()
        self.db.refresh(dispatcher)
        return dispatcher

    def update_preset(self, dispatcher_id: str, preset: str) -> Dispatcher | None:
        dispatcher = self.get_by_id(dispatcher_id)
        if dispatcher:
            dispatcher.active_preset = preset
            self.db.commit()
            self.db.refresh(dispatcher)
        return dispatcher

    def delete(self, dispatcher_id: str) -> bool:
        dispatcher = self.get_by_id(dispatcher_id)
        if dispatcher:
            self.db.delete(dispatcher)
            self.db.commit()
            return True
        return False
