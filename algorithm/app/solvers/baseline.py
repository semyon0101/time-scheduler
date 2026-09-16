from typing import List, Tuple
from app.schemas import EngineerModel, TaskModel, EngineerRoute, ScheduleStop, PlanMetrics, UnassignedTask
from app.utils.geo import haversine_km, calc_travel_min, time_to_minutes, minutes_to_time

def solve_baseline(engineers: List[EngineerModel], tasks: List[TaskModel]) -> Tuple[List[EngineerRoute], PlanMetrics, List[UnassignedTask]]:
    """
    Implements the baseline FIFO allocator according to Section 2.3 of Beeline specification:
    - Tasks are processed in order of receipt (input order).
    - Assigned to the FIRST available engineer in input list who satisfies mandatory constraints.
    - Visit order corresponds to assignment order (no re-routing / no global optimization).
    """
    # Initialize routes for each engineer
    routes = {
        eng.id: EngineerRoute(
            engineer_id=eng.id,
            engineer_name=eng.name,
            transport_type=eng.transport_type,
            skills=eng.skills,
            start_lat=eng.start_lat,
            start_lon=eng.start_lon,
            shift_start=eng.shift_start,
            shift_end=eng.shift_end,
            stops=[],
            total_distance_km=0.0,
            total_work_min=0,
            total_travel_min=0
        )
        for eng in engineers
    }

    # Track current state for each engineer: (current_lat, current_lon, current_time_min)
    eng_state = {
        eng.id: {
            "lat": eng.start_lat,
            "lon": eng.start_lon,
            "time_min": time_to_minutes(eng.shift_start),
            "shift_end_min": time_to_minutes(eng.shift_end)
        }
        for eng in engineers
    }

    unassigned: List[UnassignedTask] = []

    for task in tasks:
        assigned = False
        task_w_start = time_to_minutes(task.window_start)
        task_w_end = time_to_minutes(task.window_end)
        task_dur = task.duration_min

        # Check engineers sequentially in given list order
        for eng in engineers:
            # 1. Qualification constraint
            if task.required_skill not in eng.skills:
                continue

            # 2. Transport constraint
            if task.required_transport and eng.transport_type != task.required_transport:
                continue

            state = eng_state[eng.id]
            dist_km = haversine_km(state["lat"], state["lon"], task.lat, task.lon)
            travel_min = calc_travel_min(dist_km, eng.transport_type)

            earliest_arrival = state["time_min"] + travel_min
            # Can service start within client time window?
            actual_start = max(earliest_arrival, task_w_start)

            # 3. Time window & Shift constraints
            if actual_start <= task_w_end and (actual_start + task_dur) <= state["shift_end_min"]:
                # Fits! Assign to this engineer
                end_time_min = actual_start + task_dur
                stop_order = len(routes[eng.id].stops) + 1

                stop = ScheduleStop(
                    task_id=task.id,
                    address=task.address,
                    district=task.district,
                    lat=task.lat,
                    lon=task.lon,
                    order=stop_order,
                    arrival_time=minutes_to_time(earliest_arrival),
                    start_time=minutes_to_time(actual_start),
                    end_time=minutes_to_time(end_time_min),
                    travel_km=dist_km,
                    travel_min=travel_min,
                    required_skill=task.required_skill,
                    priority=task.priority
                )

                routes[eng.id].stops.append(stop)
                routes[eng.id].total_distance_km = round(routes[eng.id].total_distance_km + dist_km, 2)
                routes[eng.id].total_travel_min += travel_min
                routes[eng.id].total_work_min += task_dur

                # Update engineer state
                state["lat"] = task.lat
                state["lon"] = task.lon
                state["time_min"] = end_time_min

                assigned = True
                break

        if not assigned:
            unassigned.append(UnassignedTask(
                task_id=task.id,
                address=task.address,
                reason="Базовый FIFO: ни один инженер не подошел по смене, окну или квалификации",
                priority=task.priority
            ))

    # Calculate summary metrics
    all_routes = list(routes.values())
    active_engineers = sum(1 for r in all_routes if len(r.stops) > 0)
    total_km = round(sum(r.total_distance_km for r in all_routes), 2)
    assigned_count = len(tasks) - len(unassigned)

    metrics = PlanMetrics(
        total_engineers_used=active_engineers,
        total_mileage_km=total_km,
        assigned_tasks_count=assigned_count,
        unassigned_tasks_count=len(unassigned)
    )

    return all_routes, metrics, unassigned
