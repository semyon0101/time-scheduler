from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TaskTimeWindow(BaseModel):
    window_start: str = Field(default="09:00", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    window_end: str = Field(default="22:00", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")

    @model_validator(mode="after")
    def validate_window(self) -> Self:
        if self.window_start >= self.window_end:
            raise ValueError("Окончание окна заявки должно быть позже его начала")
        return self


class TaskCreate(TaskTimeWindow):
    id: str | None = None
    address: str
    district: str | None = ""
    lat: float
    lon: float
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
