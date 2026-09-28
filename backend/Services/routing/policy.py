"""Shared admissibility and lexicographic service priorities for a one-day plan."""

import os
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from backend.Models.optimization import EngineerModel, EngineerRoute, PlanMetrics, TaskModel
from backend.Services.routing.geo import time_to_minutes

MOSCOW = ZoneInfo("Europe/Moscow")
RESPONSE_TARGET_MIN = int(os.getenv("RESPONSE_TARGET_MIN", "60"))  # monitoring only
RESPONSE_LIMIT_MIN = int(os.getenv("RESPONSE_LIMIT_MIN", "120"))  # soft limit, never a hard time window


def received_datetime(received: datetime) -> datetime:
    return received.astimezone(MOSCOW) if received.tzinfo else received.replace(tzinfo=MOSCOW)


def eligible_fields(
    *,
    engineer_area: str,
    is_on_duty: bool,
    status: str,
    skills: list[str],
    transport: str,
    task_area: str,
    required_skill: str,
    required_transport: str | None,
) -> bool:
    return (
        status != "unavailable"
        and is_on_duty
        and engineer_area == task_area
        and required_skill in skills
        and (not required_transport or required_transport == transport)
    )


def eligible_for(engineer: EngineerModel, task: TaskModel) -> bool:
    return eligible_fields(
        engineer_area=engineer.area_id,
        is_on_duty=engineer.is_on_duty,
        status=engineer.status,
        skills=engineer.skills,
        transport=engineer.transport_type,
        task_area=task.area_id,
        required_skill=task.required_skill,
        required_transport=task.required_transport,
    )


def available_at(created_at: datetime | None, planning_date: date) -> int:
    if created_at is None:
        return 0
    received = received_datetime(created_at)
    if received.date() < planning_date:
        return 0
    if received.date() > planning_date:
        return 24 * 60
    return received.hour * 60 + received.minute


def available_minute(task: TaskModel, planning_date: date) -> int:
    return available_at(task.created_at, planning_date)


def assess_plan(
    routes: list[EngineerRoute],
    tasks: list[TaskModel],
    *,
    planning_date: date | None = None,
    published: list[EngineerRoute] | None = None,
) -> tuple[PlanMetrics, tuple]:
    """Return human-readable metrics and the strict whole-plan comparison key."""
    planning_date = planning_date or datetime.now(MOSCOW).date()
    task_by_id = {task.id: task for task in tasks}
    stops = {stop.task_id: (route.engineer_id, stop) for route in routes for stop in route.stops}
    if len(stops) != sum(len(route.stops) for route in routes):
        raise ValueError("Заявка назначена нескольким инженерам")
    if not stops.keys() <= task_by_id.keys():
        raise ValueError("В расписании есть неизвестная заявка")
    for task_id, (_, stop) in stops.items():
        task = task_by_id[task_id]
        if time_to_minutes(stop.start_time) < available_minute(task, planning_date):
            raise ValueError(f"Заявка {task.id} обслужена до поступления")
    unassigned = [task for task in tasks if task.id not in stops]
    emergencies = [task for task in tasks if task.category == "emergency"]
    unassigned_emergencies = [task for task in unassigned if task.category == "emergency"]
    late_count = excess_min = response_min = measured = target_met = 0
    for task in emergencies:
        if task.id not in stops or task.created_at is None:
            continue
        start = time_to_minutes(stops[task.id][1].start_time)
        created = received_datetime(task.created_at)
        service = datetime.combine(planning_date, time(start // 60, start % 60), tzinfo=MOSCOW)
        reaction = max(0, int((service - created).total_seconds() // 60))
        measured += 1
        response_min += reaction
        if reaction <= RESPONSE_TARGET_MIN:
            target_met += 1
        if reaction > RESPONSE_LIMIT_MIN:
            late_count += 1
            excess_min += reaction - RESPONSE_LIMIT_MIN

    old_stops = {stop.task_id: (route.engineer_id, stop) for route in published or [] for stop in route.stops}
    reassigned = sum(
        old_stops[task_id][0] != engineer_id for task_id, (engineer_id, _) in stops.items() if task_id in old_stops
    )
    shifted = sum(
        abs(time_to_minutes(stop.start_time) - time_to_minutes(old_stops[task_id][1].start_time))
        for task_id, (_, stop) in stops.items()
        if task_id in old_stops
    )
    used = sum(bool(route.stops) for route in routes)
    distance = round(sum(route.total_distance_km for route in routes), 2)
    metrics = PlanMetrics(
        total_engineers_used=used,
        total_mileage_km=distance,
        assigned_tasks_count=len(stops),
        unassigned_tasks_count=len(unassigned),
        unassigned_emergencies=len(unassigned_emergencies),
        unassigned_connections=sum(task.category == "connection" for task in unassigned),
        late_emergencies=late_count,
        emergency_excess_min=excess_min,
        emergency_response_min=response_min,
        measured_emergencies=measured,
        target_met_emergencies=target_met,
        reassigned_tasks=reassigned,
        shifted_start_min=shifted,
    )
    # Age matters only if every emergency has a real intake timestamp; CSV presets do not.
    age_key = (
        tuple(
            -stamp
            for stamp in sorted(int(received_datetime(task.created_at).timestamp()) for task in unassigned_emergencies)
        )
        if emergencies and all(task.created_at is not None for task in emergencies)
        else ()
    )
    key = (
        metrics.unassigned_emergencies,
        age_key,
        late_count,
        excess_min,
        metrics.unassigned_connections,
        len(unassigned) - metrics.unassigned_emergencies - metrics.unassigned_connections,
        response_min,
        reassigned,
        shifted,
        sum(route.total_travel_min for route in routes),
        used,
        round(distance * 1000),
        tuple(
            (route.engineer_id, tuple(stop.task_id for stop in route.stops))
            for route in sorted(routes, key=lambda r: r.engineer_id)
        ),
    )
    return metrics, key
