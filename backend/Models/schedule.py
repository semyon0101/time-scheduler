from pydantic import BaseModel, Field

from backend.Models.engineer import EngineerOut
from backend.Models.task import TaskOut


class ScheduleStopOut(BaseModel):
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


class EngineerRouteOut(BaseModel):
    engineer_id: str
    engineer_name: str
    transport_type: str
    skills: list[str]
    start_lat: float
    start_lon: float
    shift_start: str
    shift_end: str
    stops: list[ScheduleStopOut]
    total_distance_km: float
    total_work_min: int
    total_travel_min: int


class UnassignedTaskOut(BaseModel):
    task_id: str
    address: str
    reason: str
    priority: str = "Обычная"


class MetricsOut(BaseModel):
    baseline_engineers: int
    baseline_mileage: float
    optimized_engineers: int
    optimized_mileage: float
    assigned_count: int
    unassigned_count: int
    mileage_reduction_pct: float | None = None
    engineers_reduction_pct: float | None = None


class StateResponse(BaseModel):
    dispatcher_id: str
    active_preset: str
    engineers: list[EngineerOut]
    tasks: list[TaskOut]
    schedule: list[EngineerRouteOut]
    metrics: MetricsOut | None = None
    unassigned_tasks: list[UnassignedTaskOut] = Field(default_factory=list)
