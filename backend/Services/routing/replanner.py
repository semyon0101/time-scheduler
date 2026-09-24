from typing import Any

from backend.Models.optimization import (
    ChangeEvent,
    EngineerModel,
    EngineerRoute,
    PlanMetrics,
    TaskModel,
    UnassignedTask,
)
from backend.Services.routing.feasibility import (
    diagnose_unassigned_reason,
    evaluate_route_feasibility,
)


def apply_batch_replanning(
    current_schedule: list[EngineerRoute], engineers: list[EngineerModel], events: list[ChangeEvent]
) -> tuple[list[EngineerRoute], PlanMetrics, list[UnassignedTask], dict[str, Any]]:
    """
    Applies an atomic batch array of real-time events to the current schedule:
    - URGENT_TASK: Inserts urgent task with highest priority into optimal position.
    - CANCEL_TASK: Removes task and tightens downstream timetable.
    - ENGINEER_UNAVAILABLE: Takes all tasks of the sick/broken engineer and re-distributes them.
    """
    # Reconstruct TaskModel list per engineer from current_schedule
    eng_tasks: dict[str, list[TaskModel]] = {}
    for r in current_schedule:
        task_list = []
        for s in r.stops:
            task_list.append(
                TaskModel(
                    id=s.task_id,
                    address=s.address,
                    district=s.district,
                    lat=s.lat,
                    lon=s.lon,
                    window_start=s.start_time,
                    window_end="22:00",
                    duration_min=45,
                    required_skill=s.required_skill,
                    priority=s.priority,
                )
            )
        eng_tasks[r.engineer_id] = task_list

    diff: dict[str, Any] = {
        "cancelled_tasks": [],
        "urgent_tasks_added": [],
        "reassigned_tasks": [],
        "unavailable_engineers": [],
        "notes": [],
    }

    pending_tasks: list[TaskModel] = []
    disabled_engineers = set()

    for event in events:
        if event.event_type == "CANCEL_TASK" and event.task_id:
            for eid, tlist in eng_tasks.items():
                found = [t for t in tlist if t.id == event.task_id]
                if found:
                    eng_tasks[eid] = [t for t in tlist if t.id != event.task_id]
                    diff["cancelled_tasks"].append(event.task_id)
                    diff["notes"].append(f"Заявка #{event.task_id} успешно отменена")
                    break

        elif event.event_type == "ENGINEER_UNAVAILABLE" and event.engineer_id:
            eid = event.engineer_id
            disabled_engineers.add(eid)
            diff["unavailable_engineers"].append(eid)
            # Take all tasks from this engineer to be reassigned
            orphaned = eng_tasks.get(eid, [])
            pending_tasks.extend(orphaned)
            eng_tasks[eid] = []
            diff["notes"].append(f"Инженер {eid} сошел с линии, {len(orphaned)} заявок направлены на перераспределение")

        elif event.event_type == "URGENT_TASK" and event.task:
            pending_tasks.insert(0, event.task)  # Urgent takes priority
            diff["urgent_tasks_added"].append(event.task.id)
            diff["notes"].append(f"Срочная заявка #{event.task.id} поступила в обработку")

    # Available engineers for reallocation
    active_pool = [e for e in engineers if e.id not in disabled_engineers]
    unassigned: list[UnassignedTask] = []

    # Insert pending tasks into best feasible positions
    for task in pending_tasks:
        best_eng_id = None
        best_pos = -1
        best_cost = float("inf")

        for eng in active_pool:
            if task.required_skill not in eng.skills:
                continue
            if task.required_transport and eng.transport_type != task.required_transport:
                continue

            existing = eng_tasks.get(eng.id, [])
            for pos in range(len(existing) + 1):
                cand = existing[:pos] + [task] + existing[pos:]
                feasible, _, total_km, _, _ = evaluate_route_feasibility(eng, cand)
                if feasible:
                    cost = total_km + (50.0 if len(existing) == 0 else 0.0)
                    if cost < best_cost:
                        best_cost = cost
                        best_eng_id = eng.id
                        best_pos = pos

        if best_eng_id:
            eng_tasks[best_eng_id].insert(best_pos, task)
            diff["reassigned_tasks"].append({"task_id": task.id, "assigned_to": best_eng_id})
        else:
            reason = diagnose_unassigned_reason(task, active_pool)
            unassigned.append(
                UnassignedTask(task_id=task.id, address=task.address, reason=reason, priority=task.priority)
            )

    # Rebuild EngineerRoute objects
    result_routes: list[EngineerRoute] = []
    for eng in engineers:
        route_tasks = eng_tasks.get(eng.id, [])
        if eng.id in disabled_engineers:
            stops, total_km, total_work_min, total_travel_min = [], 0.0, 0, 0
        elif route_tasks:
            _, stops, total_km, total_work_min, total_travel_min = evaluate_route_feasibility(eng, route_tasks)
        else:
            stops, total_km, total_work_min, total_travel_min = [], 0.0, 0, 0

        result_routes.append(
            EngineerRoute(
                engineer_id=eng.id,
                engineer_name=eng.name,
                transport_type=eng.transport_type,
                skills=eng.skills,
                start_lat=eng.start_lat,
                start_lon=eng.start_lon,
                shift_start=eng.shift_start,
                shift_end=eng.shift_end,
                stops=stops,
                total_distance_km=total_km,
                total_work_min=total_work_min,
                total_travel_min=total_travel_min,
            )
        )

    active_count = sum(1 for r in result_routes if len(r.stops) > 0)
    total_km = round(sum(r.total_distance_km for r in result_routes), 2)
    assigned_count = sum(len(r.stops) for r in result_routes)

    metrics = PlanMetrics(
        total_engineers_used=active_count,
        total_mileage_km=total_km,
        assigned_tasks_count=assigned_count,
        unassigned_tasks_count=len(unassigned),
    )

    return result_routes, metrics, unassigned, diff
