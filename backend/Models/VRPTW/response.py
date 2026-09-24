from pydantic import BaseModel


class StopResponse(BaseModel):
    task_id: str
    arrival_time: str  # HH:MM
    service_start: str  # HH:MM
    service_end: str  # HH:MM
    distance_from_prev_km: float
    travel_minutes: int
    wait_minutes: int


class UnassignedTask(BaseModel):
    task_id: str
    reason: str


class EngineerRouteResponse(BaseModel):
    engineer_id: str
    stops: list[StopResponse]
    total_distance_km: float
    assigned_count: int
    unassigned: list[UnassignedTask]
