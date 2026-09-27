from pydantic import BaseModel

from backend.Models.task import TaskCreate


class SeedRequest(BaseModel):
    preset: str = "vostok"


class ChangeEventIn(BaseModel):
    event_type: str  # REGULAR_TASK accepts either task or task_id of an existing unassigned task
    timestamp: str | None = None
    task: TaskCreate | None = None
    task_id: str | None = None
    engineer_id: str | None = None


class ReplanRequestIn(BaseModel):
    events: list[ChangeEventIn]


class ExplanationOut(BaseModel):
    task_id: str
    assigned_engineer_id: str | None = None
    explanation: str
    cached: bool = False
