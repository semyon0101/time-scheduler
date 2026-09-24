from enum import Enum

from pydantic import BaseModel, Field

# to do: replace all types in /backend to the sames as this:


class TransportTypeEnum(str, Enum):
    PUBLIC = "Общественный транспорт"
    BICYCLE = "Велосипед"
    PEDESTRIAN = "Пешеход"
    CAR = "Автомобиль"


class EngineerStatusEnum(str, Enum):
    ACTIVE = "active"
    UNAVAILABLE = "unavailable"
    NEW = "new"


class PriorityEnum(str, Enum):
    NORMAL = "Обычная"
    URGENT = "Срочная"


class SkillEnum(str, Enum):
    LOCKAL = "Локальные работы"
    EMERGENCY = "Аварийные работы"
    CONNECT = "Работы на подключение и дозаказы"


class TransportType(BaseModel):
    transport_type: TransportTypeEnum


class EngineerStatus(BaseModel):
    status: EngineerStatusEnum


class Time(BaseModel):
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    hours: int = Field(ge=0, le=23)
    minutes: int = Field(ge=0, le=59)
    absolute_time: int = Field(ge=0, le=1439)  # = h*60+m


class Skill(BaseModel):
    skill: str


class Position(BaseModel):
    address: str | None = None
    lat: float  # lat coordinate of position on the map
    lon: float  # lon coordinate of position on the map


class Priority(BaseModel):
    priority: PriorityEnum
