"""Загрузка заявок из CSV «Обезличивание» в Request."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from .request import EngineerRequest, Request, TaskRequest
from .request_types import (
    EngineerStatus,
    EngineerStatusEnum,
    Position,
    Priority,
    PriorityEnum,
    Skill,
    SkillEnum,
    Time,
    TransportType,
    TransportTypeEnum,
)

ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT / "data" / "Обезличивание"
if not DATA_DIR.is_dir():
    DATA_DIR = Path.cwd() / "data" / "Обезличивание"
CACHE_PATH = Path(__file__).with_name("address_cache.json")

# Тип заявки HD -> навык из справочника ТЗ
HD_SKILL: dict[str, SkillEnum] = {
    "Авария": SkillEnum.EMERGENCY,
    "Нет линка": SkillEnum.EMERGENCY,
    "Рост ошибок на порту": SkillEnum.EMERGENCY,
    "Разрывы": SkillEnum.EMERGENCY,
    "Низкая скорость": SkillEnum.EMERGENCY,
    "IP-адрес 169...": SkillEnum.EMERGENCY,
    "Конвергенция абонента": SkillEnum.LOCKAL,
    "Работа с кабелем": SkillEnum.LOCKAL,
    "Переключение на Гбит/с": SkillEnum.LOCKAL,
    "TVE/ENT. Замена приставки техником": SkillEnum.LOCKAL,
    "Роутер. Замена техническим специалистом": SkillEnum.LOCKAL,
    "Заявка на подключение": SkillEnum.CONNECT,
    "Заказ подключения/Дозаказ оборудования": SkillEnum.CONNECT,
    "Дозаказ оборудования": SkillEnum.CONNECT,
}

# Длительность работ, минут (в CSV её нет)
DURATION_MIN: dict[SkillEnum, int] = {
    SkillEnum.EMERGENCY: 50,
    SkillEnum.LOCKAL: 40,
    SkillEnum.CONNECT: 60,
}

SYNTHETIC_FILES = (
    "Восток Синтетические данные.csv",
    "Юго-восток Синтетические данные.csv",
    "Югоцентр Синтетические данные.csv",
)

_cache: dict | None = None


def _load_cache() -> dict:
    global _cache
    if _cache is None:
        _cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return _cache


def time_from_clock(hours: int, minutes: int) -> Time:
    return Time(
        time=f"{hours:02d}:{minutes:02d}",
        hours=hours,
        minutes=minutes,
        absolute_time=hours * 60 + minutes,
    )


def time_from_minutes(total: int) -> Time:
    return time_from_clock(total // 60, total % 60)


def _parse_window(raw: str) -> tuple[int, int]:
    # "17.08.2026 20:00" или "17.08.2026 0:01"
    clock = raw.strip().split()[-1]
    h, m = clock.split(":")
    return int(h), int(m)


def read_rows(path: Path) -> list[dict[str, str]]:
    text = path.read_bytes().decode("cp1251")
    return list(csv.DictReader(text.splitlines(), delimiter=";"))


def office_position(rows: list[dict[str, str]]) -> Position | None:
    cache = _load_cache()
    for row in rows:
        if (row.get("Заявка") or "").strip() == "Адрес Офиса":
            addr = (row.get("Тип заявки BK") or "").strip()
            hit = cache.get(addr)
            if isinstance(hit, dict) and "lat" in hit:
                return Position(address=addr, lat=hit["lat"], lon=hit["lon"])
    return None


def tasks_from_rows(rows: list[dict[str, str]]) -> list[TaskRequest]:
    cache = _load_cache()
    tasks: list[TaskRequest] = []
    for row in rows:
        task_id = (row.get("Заявка") or "").strip()
        if not task_id.isdigit():
            continue
        hd = (row.get("Тип заявки HD") or "").strip()
        skill = HD_SKILL.get(hd)
        if skill is None:
            continue
        start_raw = (row.get("Начало") or "").strip()
        end_raw = (row.get("Окончание") or "").strip()
        addr = (row.get("Адрес") or "").strip()
        if not start_raw or not end_raw or not addr:
            continue
        hit = cache.get(addr)
        if not isinstance(hit, dict) or "lat" not in hit:
            continue
        sh, sm = _parse_window(start_raw)
        eh, em = _parse_window(end_raw)
        start_abs = sh * 60 + sm
        end_abs = eh * 60 + em
        if end_abs <= start_abs:
            continue
        duration = DURATION_MIN[skill]
        bk = (row.get("Тип заявки BK") or "").strip()
        priority = PriorityEnum.URGENT if bk == "Глобальная проблема" else PriorityEnum.NORMAL
        tasks.append(
            TaskRequest(
                id=task_id,
                pos=Position(address=addr, lat=hit["lat"], lon=hit["lon"]),
                window_start=time_from_clock(sh, sm),
                window_end=time_from_clock(eh, em),
                duration=time_from_minutes(duration),
                required_skill=Skill(skill=skill),
                required_transport=None,
                priority=Priority(priority=priority),
            )
        )
    return tasks


def synthetic_engineer(start: Position, engineer_id: str = "engineer-1") -> EngineerRequest:
    return EngineerRequest(
        id=engineer_id,
        start_pos=start,
        shift_start=time_from_clock(9, 0),
        shift_end=time_from_clock(22, 0),
        skills=[Skill(skill=s) for s in SkillEnum],
        transport_type=TransportType(transport_type=TransportTypeEnum.CAR),
        status=EngineerStatus(status=EngineerStatusEnum.ACTIVE),
    )


def load_synthetic_request(filename: str) -> Request:
    path = DATA_DIR / filename
    rows = read_rows(path)
    start = office_position(rows)
    if start is None:
        # запасной старт — первая заявка
        tasks = tasks_from_rows(rows)
        if not tasks:
            raise ValueError(f"нет заявок в {filename}")
        start = tasks[0].pos
    else:
        tasks = tasks_from_rows(rows)
    return Request(engineers=synthetic_engineer(start, filename), tasks=tasks)
