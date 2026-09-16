from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class EngineerModel(BaseModel):
    id: str
    name: str
    start_lat: float
    start_lon: float
    shift_start: str = "09:00"
    shift_end: str = "22:00"
    skills: List[str] = Field(default_factory=list)
    transport_type: str = "Автомобиль"

class TaskModel(BaseModel):
    id: str
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

class ScheduleStop(BaseModel):
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

class EngineerRoute(BaseModel):
    engineer_id: str
    engineer_name: str
    transport_type: str
    skills: List[str]
    start_lat: float
    start_lon: float
    shift_start: str
    shift_end: str
    stops: List[ScheduleStop] = Field(default_factory=list)
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
    mileage_reduction_pct: Optional[float] = None
    engineers_reduction_pct: Optional[float] = None

class OptimizeRequest(BaseModel):
    engineers: List[EngineerModel]
    tasks: List[TaskModel]

class OptimizeResponse(BaseModel):
    baseline_metrics: PlanMetrics
    baseline_routes: List[EngineerRoute]
    optimized_metrics: PlanMetrics
    optimized_routes: List[EngineerRoute]
    unassigned_tasks: List[UnassignedTask]

class ChangeEvent(BaseModel):
    event_type: str  # "URGENT_TASK" | "CANCEL_TASK" | "ENGINEER_UNAVAILABLE"
    timestamp: Optional[str] = None
    task: Optional[TaskModel] = None
    task_id: Optional[str] = None
    engineer_id: Optional[str] = None

class ReplanRequest(BaseModel):
    current_schedule: List[EngineerRoute]
    engineers: List[EngineerModel]
    events: List[ChangeEvent]

class ReplanResponse(BaseModel):
    updated_routes: List[EngineerRoute]
    unassigned_tasks: List[UnassignedTask]
    metrics: PlanMetrics
    diff: Dict[str, Any]

class ExplainRequest(BaseModel):
    task_id: str
    assigned_engineer_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

class ExplainResponse(BaseModel):
    task_id: str
    assigned_engineer_id: Optional[str] = None
    explanation: str
