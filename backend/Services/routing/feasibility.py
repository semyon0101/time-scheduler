"""Validate a fixed visit order when replanning an existing route."""

from backend.Models.optimization import EngineerModel, ScheduleStop, TaskModel
from backend.Services.routing.geo import calc_travel_min, haversine_km, minutes_to_time, time_to_minutes


def evaluate_route_feasibility(
    engineer: EngineerModel, task_sequence: list[TaskModel]
) -> tuple[bool, list[ScheduleStop], float, int, int]:
    """Return feasibility and timings for the supplied order of visits."""
    current_lat = engineer.start_lat
    current_lon = engineer.start_lon
    current_time_min = time_to_minutes(engineer.shift_start)
    shift_end_min = time_to_minutes(engineer.shift_end)

    stops: list[ScheduleStop] = []
    total_km = 0.0
    total_travel_min = 0
    total_work_min = 0

    for idx, task in enumerate(task_sequence):
        if task.required_skill not in engineer.skills:
            return False, [], 0.0, 0, 0
        if task.required_transport and engineer.transport_type != task.required_transport:
            return False, [], 0.0, 0, 0

        dist_km = haversine_km(current_lat, current_lon, task.lat, task.lon)
        travel_min = calc_travel_min(dist_km, engineer.transport_type)
        earliest_arrival = current_time_min + travel_min
        service_start = max(earliest_arrival, time_to_minutes(task.window_start))
        service_end = service_start + task.duration_min

        if service_end > time_to_minutes(task.window_end) or service_end > shift_end_min:
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
    """Diagnose why no engineer could take this task."""
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
