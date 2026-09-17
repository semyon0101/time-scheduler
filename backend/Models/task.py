from pydantic import BaseModel, ConfigDict


class TaskCreate(BaseModel):
    id: str | None = None
    address: str
    district: str | None = ""
    lat: float
    lon: float
    window_start: str = "09:00"
    window_end: str = "22:00"
    duration_min: int = 45
    required_skill: str = "Локальные работы"
    required_transport: str | None = None
    priority: str = "Обычная"


class TaskOut(BaseModel):
    id: str
    address: str
    district: str | None = ""
    lat: float
    lon: float
    window_start: str
    window_end: str
    duration_min: int
    required_skill: str
    required_transport: str | None = None
    priority: str
    status: str = "active"
    control_assigned_engineer: str | None = None

    model_config = ConfigDict(from_attributes=True)
