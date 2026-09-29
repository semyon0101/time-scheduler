"""Replan published routes while preserving work already started."""

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from backend.Models.optimization import (
    ChangeEvent,
    EngineerModel,
    EngineerRoute,
    PlanMetrics,
    ScheduleStop,
    TaskModel,
    UnassignedTask,
)
from backend.Services.routing.feasibility import evaluate_route_feasibility
from backend.Services.routing.geo import time_to_minutes
from backend.Services.routing.policy import MOSCOW, assess_plan, received_datetime, validate_plan


def _event_minutes(timestamp: str | None) -> int:
    """The current schedule represents one Moscow workday (without a date)."""
    if timestamp is None:
        clock = datetime.now(MOSCOW)
    elif len(timestamp) == 5 and timestamp[2] == ":":
        try:
            hour, minute = map(int, timestamp.split(":"))
        except ValueError as exc:
            raise ValueError("Некорректное время события") from exc
        if not (0 <= hour < 24 and 0 <= minute < 60):
            raise ValueError("Некорректное время события")
        return hour * 60 + minute
    else:
        try:
            clock = datetime.fromisoformat(timestamp)
        except ValueError as exc:
            raise ValueError("Время события должно быть HH:MM или ISO 8601") from exc
        if clock.tzinfo is not None:
            clock = clock.astimezone(MOSCOW)
    return clock.hour * 60 + clock.minute


@dataclass
class _Route:
    engineer: EngineerModel
    committed: list[ScheduleStop] = field(default_factory=list)
    future: list[TaskModel] = field(default_factory=list)
    published_starts: dict[str, int] = field(default_factory=dict)
    published: EngineerRoute | None = None
    original_future_ids: list[str] = field(default_factory=list)
    planning_date: date | None = None

    def evaluate(self, sequence: list[TaskModel], now: int, *, keep_starts: bool) -> tuple[bool, list[ScheduleStop]]:
        last = self.committed[-1] if self.committed else None
        feasible, stops, _, _, _ = evaluate_route_feasibility(
            self.engineer,
            sequence,
            fixed_starts=self.published_starts if keep_starts else None,
            start_time_min=max(now, time_to_minutes(last.end_time)) if last else now,
            start_position=(last.lat, last.lon) if last else None,
            planning_date=self.planning_date,
        )
        return feasible, stops

    def result(self, now: int) -> EngineerRoute:
        if self.published is not None and [task.id for task in self.future] == self.original_future_ids:
            stops = self.published.stops
        else:
            feasible, suffix = self.evaluate(self.future, now, keep_starts=True)
            if not feasible:
                raise ValueError(f"Не удалось сохранить расписание инженера {self.engineer.id}")
            stops = self.committed + [
                stop.model_copy(update={"order": order})
                for order, stop in enumerate(suffix, start=len(self.committed) + 1)
            ]
        return EngineerRoute(
            engineer_id=self.engineer.id,
            engineer_name=self.engineer.name,
            transport_type=self.engineer.transport_type,
            skills=self.engineer.skills,
            start_lat=self.engineer.start_lat,
            start_lon=self.engineer.start_lon,
            shift_start=self.engineer.shift_start,
            shift_end=self.engineer.shift_end,
            stops=stops,
            total_distance_km=round(sum(stop.travel_km for stop in stops), 2),
            total_work_min=sum(time_to_minutes(stop.end_time) - time_to_minutes(stop.start_time) for stop in stops),
            total_travel_min=sum(stop.travel_min for stop in stops),
        )


def _insert(
    task: TaskModel,
    routes: dict[str, _Route],
    now: int,
    *,
    keep_starts: bool,
    tasks: list[TaskModel],
    published: list[EngineerRoute],
    planning_date: date,
) -> str | None:
    best: tuple | None = None
    best_place: tuple[str, int] | None = None
    for engineer_id, route in routes.items():
        if route.engineer.status == "unavailable":
            continue
        feasible, _ = route.evaluate(route.future, now, keep_starts=keep_starts)
        if not feasible:
            raise ValueError(f"Не удалось сохранить расписание инженера {engineer_id}")
        for pos in range(len(route.future) + 1):
            sequence = route.future[:pos] + [task] + route.future[pos:]
            feasible, _ = route.evaluate(sequence, now, keep_starts=keep_starts)
            if feasible:
                candidate = dict(routes)
                candidate[engineer_id] = _Route(
                    route.engineer,
                    route.committed,
                    sequence,
                    route.published_starts if keep_starts else {},
                    planning_date=planning_date,
                )
                candidate_routes = [part.result(now) for part in candidate.values()]
                _, score = assess_plan(candidate_routes, tasks, planning_date=planning_date, published=published)
                if best is None or score < best:
                    best, best_place = score, (engineer_id, pos)
    if best_place is None:
        return None
    engineer_id, pos = best_place
    routes[engineer_id].future.insert(pos, task)
    return engineer_id


def insert_regular_task(
    task: TaskModel,
    routes: dict[str, _Route],
    now: int,
    tasks: list[TaskModel],
    published: list[EngineerRoute],
    planning_date: date,
) -> str | None:
    """Try an insertion without changing existing assignees, visit order or start times."""
    return _insert(task, routes, now, keep_starts=True, tasks=tasks, published=published, planning_date=planning_date)


def replan_emergency(
    pending: list[TaskModel],
    routes: dict[str, _Route],
    now: int,
    tasks: list[TaskModel],
    published: list[EngineerRoute],
    planning_date: date,
) -> None:
    """Reassign all non-committed visits; completed and ongoing stops stay intact."""
    for route in routes.values():
        route.future = []
        route.published_starts.clear()
        route.published = None
    for task in pending:
        _insert(task, routes, now, keep_starts=False, tasks=tasks, published=published, planning_date=planning_date)


def apply_batch_replanning(
    current_schedule: list[EngineerRoute],
    engineers: list[EngineerModel],
    events: list[ChangeEvent],
    tasks: list[TaskModel],
) -> tuple[list[EngineerRoute], PlanMetrics, list[UnassignedTask], dict[str, Any]]:
    """Calculate a new plan without mutating either the inputs or persistence."""
    now = max((_event_minutes(event.timestamp) for event in events), default=_event_minutes(None))
    task_by_id = {task.id: task for task in tasks}
    dated = [
        received_datetime(datetime.fromisoformat(event.timestamp))
        for event in events
        if event.timestamp and len(event.timestamp) > 5
    ]
    planning_date = max(dated).date() if dated else datetime.now(MOSCOW).date()
    routes = {engineer.id: _Route(engineer, planning_date=planning_date) for engineer in engineers}
    original_assignees: dict[str, str] = {}
    for published in current_schedule:
        if published.engineer_id not in routes:
            raise ValueError(f"Неизвестный инженер {published.engineer_id} в расписании")
        route = routes[published.engineer_id]
        route.published = published
        for stop in sorted(published.stops, key=lambda s: s.order):
            if stop.task_id not in task_by_id:
                raise ValueError(f"Нет исходных данных заявки {stop.task_id}")
            if stop.task_id in original_assignees:
                raise ValueError(f"Заявка {stop.task_id} назначена дважды")
            original_assignees[stop.task_id] = published.engineer_id
            if time_to_minutes(stop.start_time) <= now:
                route.committed.append(stop)
            else:
                route.future.append(task_by_id[stop.task_id])
                route.published_starts[stop.task_id] = time_to_minutes(stop.start_time)
                route.original_future_ids.append(stop.task_id)

    diff: dict[str, Any] = {
        "cancelled_tasks": [],
        "urgent_tasks_added": [],
        "reassigned_tasks": [],
        "unavailable_engineers": [],
        "notes": [],
    }
    cancelled: set[str] = set()
    unavailable = {engineer.id for engineer in engineers if engineer.status == "unavailable"}
    urgent: list[TaskModel] = []
    regular: list[TaskModel] = []
    new_ids: set[str] = set()

    for event in events:
        if event.event_type == "CANCEL_TASK" and event.task_id:
            if event.task_id not in task_by_id:
                raise ValueError(f"Неизвестная заявка {event.task_id}")
            if any(stop.task_id == event.task_id for route in routes.values() for stop in route.committed):
                raise ValueError(f"Нельзя отменить начатую или завершённую заявку {event.task_id}")
            cancelled.add(event.task_id)
            diff["cancelled_tasks"].append(event.task_id)
        elif event.event_type == "ENGINEER_UNAVAILABLE" and event.engineer_id:
            if event.engineer_id not in routes:
                raise ValueError(f"Неизвестный инженер {event.engineer_id}")
            unavailable.add(event.engineer_id)
            diff["unavailable_engineers"].append(event.engineer_id)
        elif event.event_type in {"REGULAR_TASK", "URGENT_TASK"} and event.task:
            task = (
                event.task.model_copy(update={"category": "emergency", "priority": "Срочная"})
                if event.event_type == "URGENT_TASK"
                else event.task
            )
            if task.id in task_by_id or task.id in new_ids:
                raise ValueError(f"Заявка {task.id} уже существует")
            new_ids.add(task.id)
            task_by_id[task.id] = task
            if event.event_type == "URGENT_TASK":
                urgent.append(task)
                diff["urgent_tasks_added"].append(task.id)
            else:
                regular.append(task)
        elif event.event_type == "REGULAR_TASK" and event.task_id:
            if event.task_id not in task_by_id or event.task_id in original_assignees:
                raise ValueError(f"Заявка {event.task_id} не найдена среди неназначенных")
            regular.append(task_by_id[event.task_id])
        else:
            raise ValueError(f"Некорректное событие {event.event_type}")

    if len({task.id for task in regular}) != len(regular):
        raise ValueError("Обычная заявка передана на вставку дважды")

    for route in routes.values():
        route.future = [task for task in route.future if task.id not in cancelled]
        route.published_starts = {key: value for key, value in route.published_starts.items() if key not in cancelled}

    pending: list[TaskModel] = []
    for engineer_id in unavailable:
        route = routes[engineer_id]
        pending.extend(route.future)
        route.future = []
        route.published_starts.clear()
        route.engineer = route.engineer.model_copy(update={"status": "unavailable"})

    if urgent:
        pending.extend(task for route in routes.values() for task in route.future)
        pending.sort(
            key=lambda task: ({"emergency": 0, "connection": 1}.get(task.category, 2), task.window_end, task.id)
        )
        replan_emergency(urgent + pending, routes, now, list(task_by_id.values()), current_schedule, planning_date)
    else:
        for task in pending:
            _insert(
                task,
                routes,
                now,
                keep_starts=True,
                tasks=list(task_by_id.values()),
                published=current_schedule,
                planning_date=planning_date,
            )

    # After an emergency, the newly published future is the fixed reference for ordinary insertions.
    if regular and urgent:
        for route in routes.values():
            _, stops = route.evaluate(route.future, now, keep_starts=False)
            route.published_starts = {stop.task_id: time_to_minutes(stop.start_time) for stop in stops}

    for task in regular:
        if task.id in cancelled:
            raise ValueError(f"Заявка {task.id} уже отменена")
        if insert_regular_task(task, routes, now, list(task_by_id.values()), current_schedule, planning_date) is None:
            diff["notes"].append(f"Нет свободного интервала для заявки {task.id} без изменения расписания")

    result_routes = [route.result(now) for route in routes.values()]
    validate_plan(
        result_routes,
        engineers,
        [task for task in task_by_id.values() if task.id not in cancelled],
        planning_date=planning_date,
    )
    assignees = {stop.task_id: route.engineer_id for route in result_routes for stop in route.stops}
    diff["reassigned_tasks"] = [
        {"task_id": task_id, "assigned_to": engineer_id}
        for task_id, engineer_id in assignees.items()
        if original_assignees.get(task_id) != engineer_id
    ]
    regular_ids = {task.id for task in regular}
    unassigned = [
        UnassignedTask(
            task_id=task.id,
            address=task.address,
            priority=task.priority,
            reason=(
                "Нет свободного интервала без изменения опубликованного плана"
                if task.id in regular_ids
                else "Не удалось назначить в текущем плане"
            ),
        )
        for task in task_by_id.values()
        if task.id not in assignees and task.id not in cancelled
    ]
    metrics, _ = assess_plan(
        result_routes,
        [task for task in task_by_id.values() if task.id not in cancelled],
        planning_date=planning_date,
        published=current_schedule,
    )
    return result_routes, metrics, unassigned, diff
