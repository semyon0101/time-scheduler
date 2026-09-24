from backend.Models.optimization import (
    EngineerModel,
    EngineerRoute,
    PlanMetrics,
    ScheduleStop,
    TaskModel,
    UnassignedTask,
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
from backend.Services.routing.feasibility import diagnose_unassigned_reason
from backend.Services.routing.solver import solve_engineer_route


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
