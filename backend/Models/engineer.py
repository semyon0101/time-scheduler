from pydantic import BaseModel, ConfigDict, Field


class EngineerCreate(BaseModel):
    id: str | None = None
    name: str
    start_lat: float
    start_lon: float
    shift_start: str = "09:00"
    shift_end: str = "22:00"
    skills: list[str] = Field(default_factory=list)
    transport_type: str = "Автомобиль"
    area_id: str | None = None
    is_on_duty: bool = True


class EngineerOut(BaseModel):
    id: str
    name: str
    start_lat: float
    start_lon: float
    shift_start: str
    shift_end: str
    skills: list[str]
    transport_type: str
    area_id: str = "default"
    is_on_duty: bool = True
    status: str = "active"

    model_config = ConfigDict(from_attributes=True)
