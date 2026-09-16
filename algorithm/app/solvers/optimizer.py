from typing import List, Tuple, Optional, Dict
from app.schemas import EngineerModel, TaskModel, EngineerRoute, ScheduleStop, PlanMetrics, UnassignedTask
from app.utils.geo import haversine_km, calc_travel_min, time_to_minutes, minutes_to_time

def evaluate_route_feasibility(
    engineer: EngineerModel,
    task_sequence: List[TaskModel]
) -> Tuple[bool, List[ScheduleStop], float, int, int]:
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

    stops: List[ScheduleStop] = []
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

        stops.append(ScheduleStop(
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
            priority=task.priority
        ))

        total_km = round(total_km + dist_km, 2)
        total_travel_min += travel_min
        total_work_min += task.duration_min

        current_lat = task.lat
        current_lon = task.lon
        current_time_min = service_end

    return True, stops, total_km, total_work_min, total_travel_min

def diagnose_unassigned_reason(task: TaskModel, engineers: List[EngineerModel]) -> str:
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
        e for e in has_transport
        if time_to_minutes(e.shift_start) <= task_w_end and time_to_minutes(e.shift_end) >= task_w_start + task.duration_min
    ]
    if not fits_shift:
        return f"Окно визита ({task.window_start}–{task.window_end}) не укладывается в смены подходящих инженеров"

    return f"Плотный график: все подходящие специалисты ({len(fits_shift)} чел) заняты в окне {task.window_start}–{task.window_end} или не успевают доехать"

def solve_vrptw(
    engineers: List[EngineerModel],
    tasks: List[TaskModel]
) -> Tuple[List[EngineerRoute], PlanMetrics, List[UnassignedTask]]:
    """
    Intelligent VRPTW Solver with Fleet Size Minimization + Cheapest Insertion + 2-Opt.
    """
    # 1. Sort tasks: urgent first, then earlier window start, then tighter window duration
    def task_sort_key(t: TaskModel):
        priority_weight = 0 if t.priority == "Срочная" else 1
        w_start = time_to_minutes(t.window_start)
        w_span = time_to_minutes(t.window_end) - w_start
        return (priority_weight, w_start, w_span)

    sorted_tasks = sorted(tasks, key=task_sort_key)

    # Routes representation: engineer_id -> list of TaskModel
    current_routes: Dict[str, List[TaskModel]] = {e.id: [] for e in engineers}
    eng_map = {e.id: e for e in engineers}
    unassigned: List[UnassignedTask] = []

    for task in sorted_tasks:
        best_eng_id: Optional[str] = None
        best_insert_pos: int = -1
        best_cost = float('inf')

        for eng in engineers:
            # Quick compatibility checks
            if task.required_skill not in eng.skills:
                continue
            if task.required_transport and eng.transport_type != task.required_transport:
                continue

            existing_tasks = current_routes[eng.id]
            is_new_engineer = (len(existing_tasks) == 0)

            # Try all possible insertion positions: 0 .. len(existing_tasks)
            for pos in range(len(existing_tasks) + 1):
                candidate_seq = existing_tasks[:pos] + [task] + existing_tasks[pos:]
                feasible, _, total_km, _, _ = evaluate_route_feasibility(eng, candidate_seq)

                if feasible:
                    # Cost function:
                    # 1. Heavily penalize activating an unused engineer (to minimize fleet size!)
                    # 2. Add extra mileage
                    cost = total_km
                    if is_new_engineer:
                        cost += 100.0  # Fleet size reduction weight

                    # Prefer earlier stops to be close in time
                    if cost < best_cost:
                        best_cost = cost
                        best_eng_id = eng.id
                        best_insert_pos = pos

        if best_eng_id is not None:
            current_routes[best_eng_id].insert(best_insert_pos, task)
        else:
            reason = diagnose_unassigned_reason(task, engineers)
            unassigned.append(UnassignedTask(
                task_id=task.id,
                address=task.address,
                reason=reason,
                priority=task.priority
            ))

    # 2-Opt local search refinement on each engineer's route
    for eng_id, route_tasks in current_routes.items():
        if len(route_tasks) <= 2:
            continue
        eng = eng_map[eng_id]
        improved = True
        while improved:
            improved = False
            _, _, base_km, _, _ = evaluate_route_feasibility(eng, route_tasks)
            for i in range(len(route_tasks) - 1):
                for j in range(i + 1, len(route_tasks)):
                    # Reverse sub-segment [i:j+1]
                    new_seq = route_tasks[:i] + route_tasks[i:j+1][::-1] + route_tasks[j+1:]
                    feasible, _, new_km, _, _ = evaluate_route_feasibility(eng, new_seq)
                    if feasible and new_km < base_km - 0.1:
                        route_tasks = new_seq
                        base_km = new_km
                        improved = True
                        break
                if improved:
                    break
            current_routes[eng_id] = route_tasks

    # Build final EngineerRoute objects
    result_routes: List[EngineerRoute] = []
    for eng in engineers:
        route_tasks = current_routes[eng.id]
        if route_tasks:
            _, stops, total_km, total_work_min, total_travel_min = evaluate_route_feasibility(eng, route_tasks)
        else:
            stops, total_km, total_work_min, total_travel_min = [], 0.0, 0, 0

        result_routes.append(EngineerRoute(
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
            total_travel_min=total_travel_min
        ))

    active_engineers = sum(1 for r in result_routes if len(r.stops) > 0)
    total_mileage = round(sum(r.total_distance_km for r in result_routes), 2)
    assigned_count = len(tasks) - len(unassigned)

    metrics = PlanMetrics(
        total_engineers_used=active_engineers,
        total_mileage_km=total_mileage,
        assigned_tasks_count=assigned_count,
        unassigned_tasks_count=len(unassigned)
    )

    return result_routes, metrics, unassigned
