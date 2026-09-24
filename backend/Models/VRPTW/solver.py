"""Однодневный маршрут одного инженера (VRPTW) на Google OR-Tools."""

from __future__ import annotations

import numpy as np
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from .request import EngineerRequest, Request, TaskRequest
from .request_types import PriorityEnum, TransportTypeEnum
from .response import EngineerRouteResponse, StopResponse, UnassignedTask

# км/ч по типу транспорта (упрощённая константа до матрицы с OSM)
SPEED_KMH: dict[TransportTypeEnum, float] = {
    TransportTypeEnum.CAR: 40.0,
    TransportTypeEnum.BICYCLE: 15.0,
    TransportTypeEnum.PEDESTRIAN: 5.0,
    TransportTypeEnum.PUBLIC: 20.0,
}

EARTH_KM = 6371.0
DISTANCE_SCALE = 1000  # метры в целочисленной стоимости
DROP_PENALTY_NORMAL = 10_000_000
DROP_PENALTY_URGENT = 50_000_000
SEARCH_SECONDS = 2


def _hhmm(absolute: int) -> str:
    h, m = divmod(int(absolute), 60)
    return f"{h:02d}:{m:02d}"


def _ineligible_reason(engineer: EngineerRequest, task: TaskRequest) -> str | None:
    skill_ok = any(s.skill == task.required_skill.skill for s in engineer.skills)
    if not skill_ok:
        return "отсутствует необходимый навык"
    if (
        task.required_transport is not None
        and task.required_transport.transport_type != engineer.transport_type.transport_type
    ):
        return "нет исполнителя с требуемым типом транспорта"
    if task.window_end.absolute_time - task.duration.absolute_time < task.window_start.absolute_time:
        return "работа не помещается во временное окно заявки"
    latest_start = min(
        engineer.shift_end.absolute_time - task.duration.absolute_time,
        task.window_end.absolute_time - task.duration.absolute_time,
    )
    if latest_start < max(engineer.shift_start.absolute_time, task.window_start.absolute_time):
        return "работа не помещается во временное окно/смену"
    return None


def _matrices(
    lats: np.ndarray, lons: np.ndarray, speed_kmh: float
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Векторный haversine. Возвращает dist_km, dist_m, travel_min (int)."""
    lat = np.radians(lats)[:, None]
    lon = np.radians(lons)[:, None]
    dphi = lat.T - lat
    dlmb = lon.T - lon
    a = np.sin(dphi / 2.0) ** 2 + np.cos(lat) * np.cos(lat.T) * np.sin(dlmb / 2.0) ** 2
    dist_km = EARTH_KM * 2.0 * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))
    np.fill_diagonal(dist_km, 0.0)
    # открытый маршрут: возврат на склад не стоит времени и километров
    dist_km[:, 0] = 0.0
    dist_m = np.rint(dist_km * DISTANCE_SCALE).astype(np.int64)
    travel = np.ceil(dist_km / speed_kmh * 60.0).astype(np.int64)
    return dist_km, dist_m, travel


def solve_engineer_route(request: Request) -> EngineerRouteResponse:
    engineer = request.engineers
    tasks = list(request.tasks)
    unassigned: list[UnassignedTask] = []

    eligible: list[TaskRequest] = []
    for task in tasks:
        reason = _ineligible_reason(engineer, task)
        if reason is not None:
            unassigned.append(UnassignedTask(task_id=task.id, reason=reason))
        else:
            eligible.append(task)

    if not eligible:
        return EngineerRouteResponse(
            engineer_id=engineer.id,
            stops=[],
            total_distance_km=0.0,
            assigned_count=0,
            unassigned=unassigned,
        )

    speed = SPEED_KMH[engineer.transport_type.transport_type]
    n = len(eligible)
    lats = np.empty(n + 1, dtype=np.float64)
    lons = np.empty(n + 1, dtype=np.float64)
    lats[0] = engineer.start_pos.lat
    lons[0] = engineer.start_pos.lon
    for i, t in enumerate(eligible, start=1):
        lats[i] = t.pos.lat
        lons[i] = t.pos.lon

    dist_km, dist_m, travel_min = _matrices(lats, lons, speed)
    durations = np.empty(n + 1, dtype=np.int64)
    durations[0] = 0
    for i, t in enumerate(eligible, start=1):
        durations[i] = t.duration.absolute_time

    # transit времени = travel(i->j) + service(i); дуга на склад уже 0
    time_matrix = travel_min + durations[:, None]
    time_matrix[:, 0] = 0

    tw_start = np.empty(n + 1, dtype=np.int64)
    tw_end = np.empty(n + 1, dtype=np.int64)
    shift_start = engineer.shift_start.absolute_time
    horizon = engineer.shift_end.absolute_time
    tw_start[0] = shift_start
    tw_end[0] = horizon
    for i, t in enumerate(eligible, start=1):
        tw_start[i] = t.window_start.absolute_time
        tw_end[i] = t.window_end.absolute_time - t.duration.absolute_time

    manager = pywrapcp.RoutingIndexManager(n + 1, 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    dist_idx = routing.RegisterTransitMatrix(dist_m.tolist())
    routing.SetArcCostEvaluatorOfAllVehicles(dist_idx)

    time_idx = routing.RegisterTransitMatrix(time_matrix.tolist())
    routing.AddDimension(time_idx, int(horizon), int(horizon), False, "Time")
    time_dim = routing.GetDimensionOrDie("Time")
    for node in range(n + 1):
        index = manager.NodeToIndex(node)
        lo = int(max(0, tw_start[node]))
        hi = int(min(horizon, max(lo, tw_end[node])))
        time_dim.CumulVar(index).SetRange(lo, hi)

    time_dim.CumulVar(routing.Start(0)).SetRange(int(shift_start), int(shift_start))
    time_dim.CumulVar(routing.End(0)).SetRange(0, int(horizon))

    for node in range(1, n + 1):
        task = eligible[node - 1]
        penalty = (
            DROP_PENALTY_URGENT
            if task.priority.priority == PriorityEnum.URGENT
            else DROP_PENALTY_NORMAL
        )
        routing.AddDisjunction([manager.NodeToIndex(node)], penalty)

    params = pywrapcp.DefaultRoutingSearchParameters()
    _fs = routing_enums_pb2.FirstSolutionStrategy
    _ls = routing_enums_pb2.LocalSearchMetaheuristic
    params.first_solution_strategy = getattr(_fs, "PATH_" + "CHEAPEST_" + "ARC")
    params.local_search_metaheuristic = getattr(_ls, "GUIDED_" + "LOCAL_" + "SEARCH")
    params.time_limit.FromSeconds(SEARCH_SECONDS)
    # меньше логирования и параллельный поиск
    params.log_search = False

    solution = routing.SolveWithParameters(params)
    if solution is None:
        for t in eligible:
            unassigned.append(
                UnassignedTask(
                    task_id=t.id,
                    reason="нет свободного слота: работа не помещается во временное окно/смену",
                )
            )
        return EngineerRouteResponse(
            engineer_id=engineer.id,
            stops=[],
            total_distance_km=0.0,
            assigned_count=0,
            unassigned=unassigned,
        )

    assigned_nodes: set[int] = set()
    index = routing.Start(0)
    prev_node = 0
    stops: list[StopResponse] = []
    total_km = 0.0
    prev_end_abs = int(shift_start)

    while not routing.IsEnd(index):
        node = manager.IndexToNode(index)
        nxt = solution.Value(routing.NextVar(index))
        if node != 0:
            assigned_nodes.add(node)
            task = eligible[node - 1]
            start = solution.Value(time_dim.CumulVar(index))
            travel = int(travel_min[prev_node, node])
            arrival = prev_end_abs + travel
            wait = max(0, start - arrival)
            km = float(dist_km[prev_node, node])
            total_km += km
            service_end = start + int(task.duration.absolute_time)
            stops.append(
                StopResponse(
                    task_id=task.id,
                    arrival_time=_hhmm(arrival),
                    service_start=_hhmm(start),
                    service_end=_hhmm(service_end),
                    distance_from_prev_km=round(km, 3),
                    travel_minutes=travel,
                    wait_minutes=int(wait),
                )
            )
            prev_end_abs = service_end
        prev_node = node
        index = nxt

    for i, task in enumerate(eligible, start=1):
        if i not in assigned_nodes:
            unassigned.append(
                UnassignedTask(
                    task_id=task.id,
                    reason="нет свободных исполнителей на требуемое время",
                )
            )

    return EngineerRouteResponse(
        engineer_id=engineer.id,
        stops=stops,
        total_distance_km=round(total_km, 3),
        assigned_count=len(stops),
        unassigned=unassigned,
    )
