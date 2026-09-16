from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class EngineerCreate(BaseModel):
    id: Optional[str] = None
    name: str
    start_lat: float
    start_lon: float
    shift_start: str = "09:00"
    shift_end: str = "22:00"
    skills: List[str] = Field(default_factory=list)
    transport_type: str = "Автомобиль"

class EngineerOut(BaseModel):
    id: str
    name: str
    start_lat: float
    start_lon: float
    shift_start: str
    shift_end: str
    skills: List[str]
    transport_type: str
    status: str = "active"

    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    id: Optional[str] = None
    address: str
    district: Optional[str] = ""
    lat: float
    lon: float
    window_start: str = "09:00"
    window_end: str = "22:00"
    duration_min: int = 45
    required_skill: str = "Локальные работы"
    required_transport: Optional[str] = None
    priority: str = "Обычная"

class TaskOut(BaseModel):
    id: str
    address: str
    district: Optional[str] = ""
    lat: float
    lon: float
    window_start: str
    window_end: str
    duration_min: int
    required_skill: str
    required_transport: Optional[str] = None
    priority: str
    status: str = "active"
    control_assigned_engineer: Optional[str] = None

    class Config:
        from_attributes = True

class ScheduleStopOut(BaseModel):
    task_id: str
    address: str
    district: Optional[str] = ""
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
    skills: List[str]
    start_lat: float
    start_lon: float
    shift_start: str
    shift_end: str
    stops: List[ScheduleStopOut]
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
    mileage_reduction_pct: Optional[float] = None
    engineers_reduction_pct: Optional[float] = None

class StateResponse(BaseModel):
    dispatcher_id: str
    active_preset: str
    engineers: List[EngineerOut]
    tasks: List[TaskOut]
    schedule: List[EngineerRouteOut]
    metrics: Optional[MetricsOut] = None
    unassigned_tasks: List[UnassignedTaskOut] = Field(default_factory=list)

class SeedRequest(BaseModel):
    preset: str = "vostok"  # "vostok" | "yugovostok" | "yugocentr"

class ChangeEventIn(BaseModel):
    event_type: str
    timestamp: Optional[str] = None
    task: Optional[TaskCreate] = None
    task_id: Optional[str] = None
    engineer_id: Optional[str] = None

class ReplanRequestIn(BaseModel):
    events: List[ChangeEventIn]

class ExplanationOut(BaseModel):
    task_id: str
    assigned_engineer_id: Optional[str] = None
    explanation: str
    cached: bool = False
