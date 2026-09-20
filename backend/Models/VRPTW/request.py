from pydantic import BaseModel
from VRPTW.request_types import (
    EngineerStatus,
    Position,
    Priority,
    Skill,
    Time,
    TransportType,
)


class EngineerRequest(BaseModel):
    id: str  # id engineer
    start_pos: Position  # home position
    shift_start: Time  # time when engineer starts working (you can use by default 9:00)
    shift_end: Time  # time when engineer ends working (you can use by default 22:00)
    skills: list[Skill]
    transport_type: TransportType
    status: EngineerStatus


class TaskRequest(BaseModel):
    id: str  # id task
    pos: Position  # possition of the task
    window_start: Time  # time when engineer can start task
    window_end: Time  # time when engineer must end the task
    duration: Time  # duration of task
    required_skill: Skill
    required_transport: TransportType | None = None
    priority: Priority


class Request(BaseModel):
    engineers: EngineerRequest
    tasks: TaskRequest
