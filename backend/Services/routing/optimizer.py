"""Build one day route per engineer and improve the whole assignment lexicographically."""

from dataclasses import dataclass
from datetime import date, datetime

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
from backend.Services.routing.feasibility import diagnose_unassigned_reason, evaluate_route_feasibility
from backend.Services.routing.policy import MOSCOW, assess_plan, eligible_for
from backend.Services.routing.solver import solve_engineer_route

MAX_NEIGHBORS = 4000
MAX_IMPROVEMENTS = 8
MAX_SIMPLE_NEIGHBORS = 800
MAX_CHAIN_NEIGHBORS = 1200
MAX_CHAIN_EJECTIONS = 3
CHAIN_BEAM_WIDTH = 8
CHAIN_BRANCH_WIDTH = 200
CHAIN_DEPTH_BUDGET = 300
CHAIN_EVICTIONS_PER_ROUTE = 4


@dataclass
class _EjectionState:
    changes: dict[str, EngineerRoute]
    pending: TaskModel
    protected_ids: frozenset[str]
    ejections: int
    rank: tuple


def _vrptw_time(clock: str) -> Time:
    hours, minutes = map(int, clock.split(":"))
    return Time(time=clock, hours=hours, minutes=minutes, absolute_time=hours * 60 + minutes)


def _new_route(
    engineer: EngineerModel, stops: list[ScheduleStop], distance: float, work: int, travel: int
) -> EngineerRoute:
    return EngineerRoute(
        engineer_id=engineer.id,
        engineer_name=engineer.name,
        transport_type=engineer.transport_type,
        skills=engineer.skills,
        start_lat=engineer.start_lat,
        start_lon=engineer.start_lon,
        shift_start=engineer.shift_start,
        shift_end=engineer.shift_end,
        stops=stops,
        total_distance_km=distance,
        total_work_min=work,
        total_travel_min=travel,
    )


def _improve_assignments(
    routes: list[EngineerRoute],
    engineers: list[EngineerModel],
    tasks: list[TaskModel],
    planning_date: date,
) -> list[EngineerRoute]:
    """Bounded insertion, displacement and inter-engineer relocation with strict whole-plan acceptance."""
    engineers_by_id = {engineer.id: engineer for engineer in engineers}
    tasks_by_id = {task.id: task for task in tasks}
    route_pos = {route.engineer_id: index for index, route in enumerate(routes)}
    budget = MAX_NEIGHBORS
    simple_budget = MAX_SIMPLE_NEIGHBORS
    chain_budget = MAX_CHAIN_NEIGHBORS
    route_cache: dict[tuple[str, tuple[str, ...]], EngineerRoute | None] = {}

    def rebuilt(engineer_id: str, sequence: list[TaskModel]) -> EngineerRoute | None:
        cache_key = (engineer_id, tuple(task.id for task in sequence))
        if cache_key in route_cache:
            return route_cache[cache_key]
        eng = engineers_by_id[engineer_id]
        if any(not eligible_for(eng, task) for task in sequence):
            route_cache[cache_key] = None
        else:
            feasible, stops, distance, work, travel = evaluate_route_feasibility(
                eng, sequence, planning_date=planning_date
            )
            route_cache[cache_key] = _new_route(eng, stops, distance, work, travel) if feasible else None
        return route_cache[cache_key]

    def consider(changes: dict[str, EngineerRoute], best_key: tuple, best_plan: list[EngineerRoute]):
        candidate = list(routes)
        for engineer_id, route in changes.items():
            candidate[route_pos[engineer_id]] = route
        _, key = assess_plan(candidate, tasks, planning_date=planning_date)
        return (key, candidate) if key < best_key else (best_key, best_plan)

    def search_ejection_chain(
        task: TaskModel, best_key: tuple, best_plan: list[EngineerRoute]
    ) -> tuple[tuple, list[EngineerRoute]]:
        nonlocal budget, chain_budget
        frontier = [_EjectionState({}, task, frozenset({task.id}), 0, ())]
        seen: set[tuple] = set()
        for _ in range(MAX_CHAIN_EJECTIONS + 1):
            if not frontier or budget <= 0 or chain_budget <= 0:
                break
            depth_budget = min(CHAIN_DEPTH_BUDGET, chain_budget, budget)
            staged: list[_EjectionState] = []
            for state in frontier:
                if depth_budget <= 0:
                    break
                inspected = 0
                for engineer_id in sequences:
                    if inspected >= CHAIN_BRANCH_WIDTH or depth_budget <= 0:
                        break
                    if not eligible_for(engineers_by_id[engineer_id], state.pending):
                        continue
                    current = state.changes.get(engineer_id, routes[route_pos[engineer_id]])
                    sequence = [tasks_by_id[stop.task_id] for stop in current.stops]
                    removable = sorted(
                        (item for item in sequence if item.id not in state.protected_ids),
                        key=lambda item: (
                            -{"emergency": 0, "connection": 1}.get(item.category, 2),
                            item.window_end,
                            item.id,
                        ),
                    )[:CHAIN_EVICTIONS_PER_ROUTE]
                    options = (
                        [None]
                        if state.ejections >= MAX_CHAIN_EJECTIONS
                        else [*removable, None]
                        if state.ejections == 0
                        else [None, *removable]
                    )
                    for evicted in options:
                        if inspected >= CHAIN_BRANCH_WIDTH or depth_budget <= 0:
                            break
                        remaining = [item for item in sequence if item is not evicted]
                        for position in range(len(remaining) + 1):
                            if inspected >= CHAIN_BRANCH_WIDTH or depth_budget <= 0:
                                break
                            inspected += 1
                            depth_budget -= 1
                            budget -= 1
                            chain_budget -= 1
                            candidate_route = rebuilt(
                                engineer_id, remaining[:position] + [state.pending] + remaining[position:]
                            )
                            if candidate_route is None:
                                continue
                            changes = {**state.changes, engineer_id: candidate_route}
                            if evicted is None:
                                best_key, best_plan = consider(changes, best_key, best_plan)
                                continue
                            fingerprint = (
                                evicted.id,
                                tuple(
                                    (key, tuple(stop.task_id for stop in route.stops))
                                    for key, route in sorted(changes.items())
                                ),
                            )
                            if fingerprint in seen:
                                continue
                            seen.add(fingerprint)
                            incomplete = list(routes)
                            for changed_id, route in changes.items():
                                incomplete[route_pos[changed_id]] = route
                            _, rank = assess_plan(incomplete, tasks, planning_date=planning_date)
                            staged.append(
                                _EjectionState(
                                    changes, evicted, state.protected_ids | {evicted.id}, state.ejections + 1, rank
                                )
                            )
            frontier = sorted(staged, key=lambda state: state.rank)[:CHAIN_BEAM_WIDTH]
        return best_key, best_plan

    for _ in range(MAX_IMPROVEMENTS):
        assigned = {stop.task_id for route in routes for stop in route.stops}
        unassigned = sorted(
            (task for task in tasks if task.id not in assigned),
            key=lambda task: (
                {"emergency": 0, "connection": 1}.get(task.category, 2),
                task.created_at.isoformat() if task.created_at else "",
                task.id,
            ),
        )
        _, current_key = assess_plan(routes, tasks, planning_date=planning_date)
        best_key, best_plan = current_key, routes
        sequences = {route.engineer_id: [tasks_by_id[stop.task_id] for stop in route.stops] for route in routes}

        # Repair uncovered jobs, optionally displacing a less important visit.
        for task in unassigned:
            for engineer_id, sequence in sequences.items():
                eng = engineers_by_id[engineer_id]
                if not eligible_for(eng, task):
                    continue
                for displaced in [None, *sequence]:
                    if displaced and displaced.category == task.category and task.category != "emergency":
                        continue
                    remaining = [item for item in sequence if item is not displaced]
                    for position in range(len(remaining) + 1):
                        if budget <= 0 or simple_budget <= 0:
                            break
                        budget -= 1
                        simple_budget -= 1
                        new_route = rebuilt(engineer_id, remaining[:position] + [task] + remaining[position:])
                        if new_route is not None:
                            best_key, best_plan = consider({engineer_id: new_route}, best_key, best_plan)
                    if budget <= 0 or simple_budget <= 0:
                        break
                if budget <= 0 or simple_budget <= 0:
                    break
            if budget <= 0 or simple_budget <= 0:
                break

        # Accept a chain only after its last displaced visit has found a feasible slot.
        for task in unassigned:
            if budget <= 0 or chain_budget <= 0:
                break
            if any(eligible_for(engineer, task) for engineer in engineers):
                best_key, best_plan = search_ejection_chain(task, best_key, best_plan)

        # On equal coverage, move visits between engineers to improve reaction or travel.
        if budget > 0:
            for source_id, source in sequences.items():
                for task in source:
                    shorter = rebuilt(source_id, [item for item in source if item is not task])
                    if shorter is None:
                        continue
                    for target_id, target in sequences.items():
                        if target_id == source_id or not eligible_for(engineers_by_id[target_id], task):
                            continue
                        for position in range(len(target) + 1):
                            if budget <= 0:
                                break
                            budget -= 1
                            longer = rebuilt(target_id, target[:position] + [task] + target[position:])
                            if longer is not None:
                                best_key, best_plan = consider(
                                    {source_id: shorter, target_id: longer}, best_key, best_plan
                                )
                        if budget <= 0:
                            break
                    if budget <= 0:
                        break
                if budget <= 0:
                    break

        # Paired exchange handles the case where neither single relocation fits.
        if budget > 0:
            for source_id, source in sequences.items():
                for target_id, target in sequences.items():
                    if source_id >= target_id:
                        continue
                    for left_pos, left in enumerate(source):
                        if not eligible_for(engineers_by_id[target_id], left):
                            continue
                        for right_pos, right in enumerate(target):
                            if budget <= 0:
                                break
                            budget -= 1
                            if not eligible_for(engineers_by_id[source_id], right):
                                continue
                            changed_source = rebuilt(source_id, source[:left_pos] + [right] + source[left_pos + 1 :])
                            changed_target = rebuilt(target_id, target[:right_pos] + [left] + target[right_pos + 1 :])
                            if changed_source and changed_target:
                                best_key, best_plan = consider(
                                    {source_id: changed_source, target_id: changed_target}, best_key, best_plan
                                )
                        if budget <= 0:
                            break
                    if budget <= 0:
                        break
                if budget <= 0:
                    break

        if best_key >= current_key:
            break
        routes = best_plan
        if budget <= 0:
            break
    return routes


def solve_vrptw(
    engineers: list[EngineerModel],
    tasks: list[TaskModel],
    *,
    planning_date: date | None = None,
) -> tuple[list[EngineerRoute], PlanMetrics, list[UnassignedTask]]:
    """Always call the single-engineer OR-Tools solver for each engineer on the remaining pool."""
    planning_date = planning_date or datetime.now(MOSCOW).date()
    remaining = {task.id: task for task in tasks}
    routes: dict[str, EngineerRoute] = {}

    for engineer in sorted(engineers, key=lambda eng: len(eng.skills)):
        request = Request(
            planning_date=planning_date,
            engineers=EngineerRequest(
                id=engineer.id,
                start_pos=Position(lat=engineer.start_lat, lon=engineer.start_lon),
                shift_start=_vrptw_time(engineer.shift_start),
                shift_end=_vrptw_time(engineer.shift_end),
                skills=[Skill(skill=skill) for skill in engineer.skills],
                transport_type=TransportType(transport_type=engineer.transport_type),
                status=EngineerStatus(
                    status=(
                        EngineerStatusEnum.UNAVAILABLE
                        if engineer.status == "unavailable"
                        else EngineerStatusEnum.ACTIVE
                    )
                ),
                area_id=engineer.area_id,
                is_on_duty=engineer.is_on_duty,
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
                    category=task.category,
                    area_id=task.area_id,
                    created_at=task.created_at,
                )
                for task in remaining.values()
            ],
        )
        result = solve_engineer_route(request)
        stops: list[ScheduleStop] = []
        work = 0
        for order, stop in enumerate(result.stops, start=1):
            task = remaining.pop(stop.task_id)
            work += task.duration_min
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
        routes[engineer.id] = _new_route(
            engineer, stops, result.total_distance_km, work, sum(stop.travel_min for stop in stops)
        )

    result_routes = [routes[engineer.id] for engineer in engineers]
    result_routes = _improve_assignments(result_routes, engineers, tasks, planning_date)
    metrics, _ = assess_plan(result_routes, tasks, planning_date=planning_date)
    assigned = {stop.task_id for route in result_routes for stop in route.stops}
    unassigned = [
        UnassignedTask(
            task_id=task.id,
            address=task.address,
            reason=diagnose_unassigned_reason(task, engineers),
            priority=task.priority,
        )
        for task in tasks
        if task.id not in assigned
    ]
    return result_routes, metrics, unassigned
