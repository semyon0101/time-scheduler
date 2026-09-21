from enum import StrEnum

from pydantic import BaseModel, Field

# to do: replace all types in /backend to the sames as this:


class TransportTypeEnum(StrEnum):
    PUBLIC = "Общественный транспорт"
    BICYCLE = "Велосипед"
    PEDESTRIAN = "Пешеход"
    CAR = "Автомобиль"


class EngineerStatusEnum(StrEnum):
    ACTIVE = "active"
    UNAVAILABLE = "unavailable"
    NEW = "new"


class PriorityEnum(StrEnum):
    NORMAL = "Обычная"
    URGENT = "Срочная"


class SkillEnum(StrEnum):
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
    skill: SkillEnum


class Position(BaseModel):
    address: str
    lat: float  # lat coordinate of position on the map
    lon: float  # lon coordinate of position on the map


class Priority(BaseModel):
    priority: PriorityEnum
