from typing import Any

from pydantic import BaseModel, Field

from backend.Models.task import TaskTimeWindow


class EngineerModel(BaseModel):
    id: str
    name: str
    start_lat: float
    start_lon: float
    shift_start: str = "09:00"
    shift_end: str = "22:00"
    skills: list[str] = Field(default_factory=list)
    transport_type: str = "Автомобиль"
    status: str = "active"


class TaskModel(TaskTimeWindow):
    id: str
    address: str
    district: str | None = ""
    lat: float
    lon: float
    duration_min: int = 45
    required_skill: str = "Локальные работы"
    required_transport: str | None = None
    priority: str = "Обычная"


class ScheduleStop(BaseModel):
    task_id: str
    address: str
    district: str | None = ""
    lat: float
    lon: float
    order: int
    arrival_time: str
    start_time: str
    end_time: str
    travel_km: float
    travel_min: int
    required_skill: str
    priority: str


class EngineerRoute(BaseModel):
    engineer_id: str
    engineer_name: str
    transport_type: str
    skills: list[str]
    start_lat: float
    start_lon: float
    shift_start: str
    shift_end: str
    stops: list[ScheduleStop] = Field(default_factory=list)
    total_distance_km: float = 0.0
    total_work_min: int = 0
    total_travel_min: int = 0


class UnassignedTask(BaseModel):
    task_id: str
    address: str
    reason: str
    priority: str = "Обычная"


class PlanMetrics(BaseModel):
    total_engineers_used: int
    total_mileage_km: float
    assigned_tasks_count: int
    unassigned_tasks_count: int
    mileage_reduction_pct: float | None = None
    engineers_reduction_pct: float | None = None


class OptimizeRequest(BaseModel):
    engineers: list[EngineerModel]
    tasks: list[TaskModel]


class OptimizeResponse(BaseModel):
    baseline_metrics: PlanMetrics
    baseline_routes: list[EngineerRoute]
    optimized_metrics: PlanMetrics
    optimized_routes: list[EngineerRoute]
    unassigned_tasks: list[UnassignedTask]


class ChangeEvent(BaseModel):
    event_type: str  # "REGULAR_TASK" | "URGENT_TASK" | "CANCEL_TASK" | "ENGINEER_UNAVAILABLE"
    timestamp: str | None = None
    task: TaskModel | None = None
    task_id: str | None = None
    engineer_id: str | None = None


class ReplanRequest(BaseModel):
    current_schedule: list[EngineerRoute]
    engineers: list[EngineerModel]
    tasks: list[TaskModel]
    events: list[ChangeEvent]


class ReplanResponse(BaseModel):
    updated_routes: list[EngineerRoute]
    unassigned_tasks: list[UnassignedTask]
    metrics: PlanMetrics
    diff: dict[str, Any]


class ExplainRequest(BaseModel):
    task_id: str
    assigned_engineer_id: str | None = None
    context: dict[str, Any] | None = None


class ExplainResponse(BaseModel):
    task_id: str
    assigned_engineer_id: str | None = None
    explanation: str
