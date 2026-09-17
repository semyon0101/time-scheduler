from sqlalchemy.orm import Session

from backend.Entities.task import Task


class TaskRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all_by_dispatcher(self, dispatcher_id: str) -> list[Task]:
        return self.db.query(Task).filter(Task.dispatcher_id == dispatcher_id).all()

    def get_active_by_dispatcher(self, dispatcher_id: str) -> list[Task]:
        return self.db.query(Task).filter(Task.dispatcher_id == dispatcher_id, Task.status != "cancelled").all()

    def get_by_id(self, dispatcher_id: str, task_id: str) -> Task | None:
        return self.db.query(Task).filter(Task.dispatcher_id == dispatcher_id, Task.id == task_id).first()

    def create(self, task: Task) -> Task:
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def delete(self, dispatcher_id: str, task_id: str) -> bool:
        t = self.get_by_id(dispatcher_id, task_id)
        if t:
            self.db.delete(t)
            self.db.commit()
            return True
        return False

    def delete_all_by_dispatcher(self, dispatcher_id: str) -> int:
        count = self.db.query(Task).filter(Task.dispatcher_id == dispatcher_id).delete()
        self.db.commit()
        return count

    def set_status(self, dispatcher_id: str, task_id: str, status: str) -> Task | None:
        t = self.get_by_id(dispatcher_id, task_id)
        if t:
            t.status = status
            self.db.commit()
            self.db.refresh(t)
        return t

    def mark_status_for_dispatcher(self, dispatcher_id: str, from_status: str, to_status: str) -> int:
        tasks = self.db.query(Task).filter(Task.dispatcher_id == dispatcher_id, Task.status == from_status).all()
        for t in tasks:
            t.status = to_status
        self.db.commit()
        return len(tasks)
