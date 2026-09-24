import json

import pytest

from backend.Entities.engineer import Engineer
from backend.Entities.task import Task
from backend.Models.optimization import EngineerModel, TaskModel
from backend.Services.algorithm_client import AlgorithmClient
from backend.Services.routing import optimizer
from backend.Services.routing.baseline import solve_baseline
from test_cli import find_preset_file


@pytest.mark.asyncio
async def test_optimization_calls_solver_for_each_engineer_and_assigns_once(monkeypatch):
    calls = []
    original = optimizer.solve_engineer_route

    def traced_solve(request):
        calls.append((request.engineers.id, {task.id for task in request.tasks}))
        return original(request)

    monkeypatch.setattr(optimizer, "solve_engineer_route", traced_solve)
    engineers = [
        {
            "id": engineer_id,
            "name": engineer_id,
            "start_lat": 55.75,
            "start_lon": 37.62,
            "skills": [skill],
            "shift_start": "09:00",
            "shift_end": "18:00",
        }
        for engineer_id, skill in [("local", "Локальные работы"), ("optics", "Оптика")]
    ]
    tasks = [
        {
            "id": task_id,
            "address": task_id,
            "lat": 55.76,
            "lon": 37.63,
            "window_start": "09:30",
            "window_end": "11:00",
            "duration_min": 30,
            "required_skill": skill,
        }
        for task_id, skill in [("a", "Локальные работы"), ("b", "Оптика"), ("missing", "Аварийные работы")]
    ]

    result = await AlgorithmClient().call_optimize(engineers, tasks)

    assert calls == [
        ("local", {"a", "b", "missing"}),
        ("optics", {"b", "missing"}),
    ]
    routes = result["optimized_routes"]
    assert [route["engineer_id"] for route in routes] == ["local", "optics"]
    assert [[stop["task_id"] for stop in route["stops"]] for route in routes] == [["a"], ["b"]]
    baseline_stops = {
        stop["task_id"]: stop
        for route in result["baseline_routes"]
        for stop in route["stops"]
    }
    for route in routes:
        stop = route["stops"][0]
        assert stop["order"] == 1
        assert stop["arrival_time"] < stop["start_time"] == "09:30"
        assert stop["end_time"] == "10:00"
        assert stop["travel_min"] > 0
        assert stop["travel_km"] > 0
        assert route["total_distance_km"] == stop["travel_km"]
        assert stop["travel_min"] == baseline_stops[stop["task_id"]]["travel_min"]
        assert abs(stop["travel_km"] - baseline_stops[stop["task_id"]]["travel_km"]) < 0.001
    assert [task["task_id"] for task in result["unassigned_tasks"]] == ["missing"]
    assert result["optimized_metrics"]["assigned_tasks_count"] == 2
    assert result["optimized_metrics"]["unassigned_tasks_count"] == 1


def test_task_rejected_by_first_engineer_is_available_to_next():
    engineers = [
        EngineerModel(
            id=engineer_id,
            name=engineer_id,
            start_lat=55.75,
            start_lon=37.62,
            shift_end=shift_end,
            skills=["Локальные работы"],
        )
        for engineer_id, shift_end in [("early", "10:00"), ("late", "18:00")]
    ]
    task = TaskModel(
        id="late_task",
        address="Москва",
        lat=55.75,
        lon=37.62,
        window_start="11:00",
        window_end="12:00",
        duration_min=30,
    )

    routes, metrics, unassigned = optimizer.solve_vrptw(engineers, [task])

    assert [len(route.stops) for route in routes] == [0, 1]
    assert routes[1].stops[0].task_id == task.id
    assert metrics.assigned_tasks_count == 1
    assert unassigned == []


def test_fifo_respects_end_of_time_window():
    engineer = EngineerModel(id="local", name="local", start_lat=55.75, start_lon=37.62, skills=["Локальные работы"])
    task = TaskModel(
        id="too_long",
        address="Москва",
        lat=55.75,
        lon=37.62,
        window_start="09:00",
        window_end="09:20",
        duration_min=30,
    )

    routes, metrics, unassigned = solve_baseline([engineer], [task])

    assert routes[0].stops == []
    assert metrics.unassigned_tasks_count == 1
    assert unassigned[0].task_id == task.id


def test_preset_alias_uses_single_dataset():
    assert find_preset_file("yugcenter") == find_preset_file("yugocentr")
    assert find_preset_file("yugcenter").endswith("yugocentr.json")


@pytest.mark.asyncio
async def test_real_solver_persists_routes_through_schedule_service(services, repos):
    session = services["session"]
    dispatcher_id = session.get_or_create_dispatcher("disp_real_vrptw").id
    session.reset_session(dispatcher_id)
    for engineer_id, skill in [("local", "Локальные работы"), ("optics", "Оптика")]:
        repos["engineer"].create(
            Engineer(
                id=engineer_id,
                dispatcher_id=dispatcher_id,
                name=engineer_id,
                start_lat=55.75,
                start_lon=37.62,
                shift_start="09:00",
                shift_end="18:00",
                skills_json=json.dumps([skill], ensure_ascii=False),
                transport_type="Автомобиль",
                status="active",
            )
        )
        repos["task"].create(
            Task(
                id=f"task_{engineer_id}",
                dispatcher_id=dispatcher_id,
                address=engineer_id,
                district="ЦАО",
                lat=55.76,
                lon=37.63,
                window_start="09:30",
                window_end="11:00",
                duration_min=30,
                required_skill=skill,
                priority="Обычная",
                status="active",
            )
        )

    services["schedule"].algo_client = AlgorithmClient()
    state = await services["schedule"].run_optimization(dispatcher_id)

    assert {stop.task_id for route in state.schedule for stop in route.stops} == {"task_local", "task_optics"}
    assert all(stop.start_time == "09:30" and stop.end_time == "10:00" for route in state.schedule for stop in route.stops)
    assert state.metrics.assigned_count == 2
    assert state.metrics.unassigned_count == 0
    assert len(repos["schedule"].get_all_by_dispatcher(dispatcher_id)) == 2
