from backend.Algorithm.schemas import (
    EngineerModel,
    EngineerRoute,
    PlanMetrics,
    ScheduleStop,
    TaskModel,
    UnassignedTask,
)
from backend.Algorithm.utils.geo import (
    calc_travel_min,
    haversine_km,
    minutes_to_time,
    time_to_minutes,
)
from backend.Models.VRPTW.request import EngineerRequest, Request, TaskRequest
from backend.Models.VRPTW.request_types import (
    EngineerStatus,
    EngineerStatusEnum,
    Position,
    Priority,
    Skill,
    Time,
    TransportType,
)
from backend.Models.VRPTW.solver import solve_engineer_route


def evaluate_route_feasibility(
    engineer: EngineerModel, task_sequence: list[TaskModel]
) -> tuple[bool, list[ScheduleStop], float, int, int]:
    """
    Checks if a sequence of tasks is feasible for an engineer in terms of:
    1. Qualifications
    2. Transport requirements
    3. Time windows and shift limits
    Returns (is_feasible, stops, total_km, total_work_min, total_travel_min).
    """
    current_lat = engineer.start_lat
    current_lon = engineer.start_lon
    current_time_min = time_to_minutes(engineer.shift_start)
    shift_end_min = time_to_minutes(engineer.shift_end)

    stops: list[ScheduleStop] = []
    total_km = 0.0
    total_travel_min = 0
    total_work_min = 0

    for idx, task in enumerate(task_sequence):
        # 1. Qualification
        if task.required_skill not in engineer.skills:
            return False, [], 0.0, 0, 0

        # 2. Transport
        if task.required_transport and engineer.transport_type != task.required_transport:
            return False, [], 0.0, 0, 0

        dist_km = haversine_km(current_lat, current_lon, task.lat, task.lon)
        travel_min = calc_travel_min(dist_km, engineer.transport_type)

        earliest_arrival = current_time_min + travel_min
        task_w_start = time_to_minutes(task.window_start)
        task_w_end = time_to_minutes(task.window_end)
        service_start = max(earliest_arrival, task_w_start)
        service_end = service_start + task.duration_min

        # 3. Time window & Shift
        if service_start > task_w_end or service_end > shift_end_min:
            return False, [], 0.0, 0, 0

        stops.append(
            ScheduleStop(
                task_id=task.id,
                address=task.address,
                district=task.district,
                lat=task.lat,
                lon=task.lon,
                order=idx + 1,
                arrival_time=minutes_to_time(earliest_arrival),
                start_time=minutes_to_time(service_start),
                end_time=minutes_to_time(service_end),
                travel_km=dist_km,
                travel_min=travel_min,
                required_skill=task.required_skill,
                priority=task.priority,
            )
        )

        total_km = round(total_km + dist_km, 2)
        total_travel_min += travel_min
        total_work_min += task.duration_min

        current_lat = task.lat
        current_lon = task.lon
        current_time_min = service_end

    return True, stops, total_km, total_work_min, total_travel_min


def diagnose_unassigned_reason(task: TaskModel, engineers: list[EngineerModel]) -> str:
    """Diagnoses human-readable failure reason for unassigned task."""
    has_skill = [e for e in engineers if task.required_skill in e.skills]
    if not has_skill:
        return f"В штате отсутствует исполнитель с квалификацией «{task.required_skill}»"

    has_transport = [e for e in has_skill if not task.required_transport or e.transport_type == task.required_transport]
    if not has_transport:
        return f"Нет доступного специалиста с требуемым типом транспорта «{task.required_transport}»"

    task_w_start = time_to_minutes(task.window_start)
    task_w_end = time_to_minutes(task.window_end)
    fits_shift = [
        e
        for e in has_transport
        if time_to_minutes(e.shift_start) <= task_w_end
        and time_to_minutes(e.shift_end) >= task_w_start + task.duration_min
    ]
    if not fits_shift:
        return f"Окно визита ({task.window_start}–{task.window_end}) не укладывается в смены подходящих инженеров"

    return f"Плотный график: все подходящие специалисты ({len(fits_shift)} чел) заняты в окне {task.window_start}–{task.window_end} или не успевают доехать"


def solve_vrptw(
    engineers: list[EngineerModel], tasks: list[TaskModel]
) -> tuple[list[EngineerRoute], PlanMetrics, list[UnassignedTask]]:
    """Run the one-engineer OR-Tools solver for every engineer on remaining tasks."""
    remaining = {task.id: task for task in tasks}
    routes: dict[str, EngineerRoute] = {}

    # Specialists first: leave multi-skilled engineers available for tasks others cannot do.
    for engineer in sorted(engineers, key=lambda e: len(e.skills)):
        request = Request(
            engineers=EngineerRequest(
                id=engineer.id,
                start_pos=Position(lat=engineer.start_lat, lon=engineer.start_lon),
                shift_start=_vrptw_time(engineer.shift_start),
                shift_end=_vrptw_time(engineer.shift_end),
                skills=[Skill(skill=skill) for skill in engineer.skills],
                transport_type=TransportType(transport_type=engineer.transport_type),
                status=EngineerStatus(status=EngineerStatusEnum.ACTIVE),
            ),
            tasks=[
                TaskRequest(
                    id=task.id,
                    pos=Position(address=task.address, lat=task.lat, lon=task.lon),
                    window_start=_vrptw_time(task.window_start),
                    window_end=_vrptw_time(task.window_end),
                    duration=_vrptw_time(f"{task.duration_min // 60:02d}:{task.duration_min % 60:02d}"),
                    required_skill=Skill(skill=task.required_skill),
                    required_transport=(
                        TransportType(transport_type=task.required_transport) if task.required_transport else None
                    ),
                    priority=Priority(priority=task.priority),
                )
                for task in remaining.values()
            ],
        )
        result = solve_engineer_route(request)
        stops = []
        total_work_min = 0
        for order, stop in enumerate(result.stops, start=1):
            task = remaining.pop(stop.task_id)
            total_work_min += task.duration_min
            stops.append(
                ScheduleStop(
                    task_id=task.id,
                    address=task.address,
                    district=task.district,
                    lat=task.lat,
                    lon=task.lon,
                    order=order,
                    arrival_time=stop.arrival_time,
                    start_time=stop.service_start,
                    end_time=stop.service_end,
                    travel_km=stop.distance_from_prev_km,
                    travel_min=stop.travel_minutes,
                    required_skill=task.required_skill,
                    priority=task.priority,
                )
            )
        routes[engineer.id] = EngineerRoute(
            engineer_id=engineer.id,
            engineer_name=engineer.name,
            transport_type=engineer.transport_type,
            skills=engineer.skills,
            start_lat=engineer.start_lat,
            start_lon=engineer.start_lon,
            shift_start=engineer.shift_start,
            shift_end=engineer.shift_end,
            stops=stops,
            total_distance_km=result.total_distance_km,
            total_work_min=total_work_min,
            total_travel_min=sum(stop.travel_min for stop in stops),
        )

    result_routes = [routes[engineer.id] for engineer in engineers]
    unassigned = [
        UnassignedTask(
            task_id=task.id,
            address=task.address,
            reason=diagnose_unassigned_reason(task, engineers),
            priority=task.priority,
        )
        for task in remaining.values()
    ]
    metrics = PlanMetrics(
        total_engineers_used=sum(bool(route.stops) for route in result_routes),
        total_mileage_km=round(sum(route.total_distance_km for route in result_routes), 2),
        assigned_tasks_count=len(tasks) - len(unassigned),
        unassigned_tasks_count=len(unassigned),
    )
    return result_routes, metrics, unassigned


def _vrptw_time(clock: str) -> Time:
    hours, minutes = map(int, clock.split(":"))
    return Time(time=clock, hours=hours, minutes=minutes, absolute_time=hours * 60 + minutes)
