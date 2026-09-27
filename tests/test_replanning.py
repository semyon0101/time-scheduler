"""Acceptance cases for regular insertion and replanning after an emergency."""

import pytest
from fastapi import HTTPException

from backend.Entities.engineer import Engineer
from backend.Entities.schedule import ScheduleRecord
from backend.Entities.task import Task
from backend.Models.optimization import ChangeEvent, EngineerModel, EngineerRoute, ScheduleStop, TaskModel
from backend.Models.session import ChangeEventIn
from backend.Models.task import TaskCreate
from backend.Services.algorithm_client import AlgorithmClient
from backend.Services.routing.replanner import apply_batch_replanning


def _engineer(engineer_id: str = "one") -> EngineerModel:
    return EngineerModel(
        id=engineer_id, name=engineer_id, start_lat=55.75, start_lon=37.62, skills=["Локальные работы"]
    )


def _task(task_id: str, start: str, end: str, duration: int) -> TaskModel:
    return TaskModel(
        id=task_id,
        address=task_id,
        lat=55.75,
        lon=37.62,
        window_start=start,
        window_end=end,
        duration_min=duration,
    )


def _stop(task: TaskModel, start: str, end: str, order: int) -> ScheduleStop:
    return ScheduleStop(
        task_id=task.id,
        address=task.address,
        lat=task.lat,
        lon=task.lon,
        order=order,
        arrival_time=start,
        start_time=start,
        end_time=end,
        travel_km=0,
        travel_min=0,
        required_skill=task.required_skill,
        priority=task.priority,
    )


def _route(engineer: EngineerModel, stops: list[ScheduleStop]) -> EngineerRoute:
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
    )


def test_regular_insertion_preserves_published_starts_and_real_durations():
    eng = _engineer()
    early = _task("early", "09:30", "10:20", 50)
    late = _task("late", "12:00", "12:40", 40)
    gap = _task("gap", "10:45", "11:15", 30)
    published = _route(eng, [_stop(early, "09:30", "10:20", 1), _stop(late, "12:00", "12:40", 2)])

    routes, metrics, unassigned, _ = apply_batch_replanning(
        [published], [eng], [ChangeEvent(event_type="REGULAR_TASK", timestamp="09:05", task=gap)], [early, late]
    )

    assert [(s.task_id, s.start_time, s.end_time) for s in routes[0].stops] == [
        ("early", "09:30", "10:20"),
        ("gap", "10:45", "11:15"),
        ("late", "12:00", "12:40"),
    ]
    assert routes[0].total_work_min == 120
    assert metrics.assigned_tasks_count == 3
    assert unassigned == []
    assert [stop.task_id for stop in published.stops] == ["early", "late"]


def test_regular_task_stays_unassigned_without_moving_existing_visits():
    eng = _engineer()
    early = _task("early", "09:30", "10:20", 50)
    late = _task("late", "10:20", "11:00", 40)
    impossible = _task("impossible", "09:45", "10:15", 30)
    published = _route(eng, [_stop(early, "09:30", "10:20", 1), _stop(late, "10:20", "11:00", 2)])

    routes, _, unassigned, _ = apply_batch_replanning(
        [published], [eng], [ChangeEvent(event_type="REGULAR_TASK", timestamp="09:05", task=impossible)], [early, late]
    )

    assert [(s.task_id, s.start_time) for s in routes[0].stops] == [("early", "09:30"), ("late", "10:20")]
    assert [t.task_id for t in unassigned] == ["impossible"]


def test_regular_task_can_be_inserted_by_existing_task_id():
    eng = _engineer()
    task = _task("previously_created", "11:00", "11:30", 30)
    routes, _, unassigned, _ = apply_batch_replanning(
        [], [eng], [ChangeEvent(event_type="REGULAR_TASK", timestamp="09:05", task_id=task.id)], [task]
    )
    assert [stop.task_id for stop in routes[0].stops] == [task.id]
    assert unassigned == []


def test_emergency_does_not_interrupt_started_work_and_can_reassign_future():
    one, two = _engineer(), _engineer("two")
    started = _task("started", "09:30", "10:20", 50)
    future = _task("future", "10:20", "11:00", 40)
    urgent = _task("urgent", "10:20", "10:50", 30)
    published = _route(one, [_stop(started, "09:30", "10:20", 1), _stop(future, "10:20", "11:00", 2)])

    routes, metrics, unassigned, _ = apply_batch_replanning(
        [published, _route(two, [])],
        [one, two],
        [ChangeEvent(event_type="URGENT_TASK", timestamp="09:40", task=urgent)],
        [started, future],
    )

    assert routes[0].stops[0] == published.stops[0]
    assert routes[0].stops[0].end_time == "10:20"
    urgent_stop = next(s for route in routes for s in route.stops if s.task_id == "urgent")
    assert urgent_stop.start_time >= "10:20"
    assert metrics.assigned_tasks_count == 3
    assert not unassigned


def test_emergency_does_not_extend_original_task_window():
    eng = _engineer()
    started = _task("started", "09:30", "10:20", 50)
    future = _task("future", "10:20", "11:00", 40)
    urgent = _task("urgent", "10:20", "10:50", 30)
    published = _route(eng, [_stop(started, "09:30", "10:20", 1), _stop(future, "10:20", "11:00", 2)])

    routes, _, unassigned, _ = apply_batch_replanning(
        [published], [eng], [ChangeEvent(event_type="URGENT_TASK", timestamp="09:40", task=urgent)], [started, future]
    )

    assert [(s.task_id, s.start_time) for s in routes[0].stops] == [("started", "09:30"), ("urgent", "10:20")]
    assert [task.task_id for task in unassigned] == ["future"]


def test_offline_engineer_keeps_started_work_and_releases_only_future():
    one, two = _engineer(), _engineer("two")
    started = _task("started", "09:30", "10:20", 50)
    future = _task("future", "12:00", "12:40", 40)
    published = _route(one, [_stop(started, "09:30", "10:20", 1), _stop(future, "12:00", "12:40", 2)])

    routes, _, unassigned, _ = apply_batch_replanning(
        [published],
        [one, two],
        [ChangeEvent(event_type="ENGINEER_UNAVAILABLE", timestamp="09:40", engineer_id="one")],
        [started, future],
    )

    assert routes[0].stops == [published.stops[0]]
    assert [s.task_id for s in routes[1].stops] == ["future"]
    assert unassigned == []


def test_reassignment_respects_original_transport_requirement():
    car = _engineer("car")
    pedestrian = _engineer("pedestrian").model_copy(update={"transport_type": "Пешеход"})
    task = _task("car_only", "12:00", "13:00", 40).model_copy(update={"required_transport": "Автомобиль"})
    published = _route(car, [_stop(task, "12:00", "12:40", 1)])

    routes, _, unassigned, _ = apply_batch_replanning(
        [published],
        [car, pedestrian],
        [ChangeEvent(event_type="ENGINEER_UNAVAILABLE", timestamp="09:05", engineer_id="car")],
        [task],
    )

    assert all(not route.stops for route in routes)
    assert [item.task_id for item in unassigned] == ["car_only"]


def test_cannot_cancel_started_visit():
    eng = _engineer()
    started = _task("started", "09:30", "10:20", 50)
    published = _route(eng, [_stop(started, "09:30", "10:20", 1)])
    with pytest.raises(ValueError, match="Нельзя отменить"):
        apply_batch_replanning(
            [published],
            [eng],
            [ChangeEvent(event_type="CANCEL_TASK", timestamp="09:40", task_id="started")],
            [started],
        )
    assert [s.task_id for s in published.stops] == ["started"]


@pytest.mark.asyncio
async def test_schedule_service_uses_original_tasks_and_rejects_started_cancellation(services, repos, monkeypatch):
    session = services["session"]
    dispatcher_id = session.get_or_create_dispatcher("disp_replan_acceptance").id
    session.reset_session(dispatcher_id)
    eng = _engineer()
    repos["engineer"].create(
        Engineer(
            id=eng.id,
            dispatcher_id=dispatcher_id,
            name=eng.name,
            start_lat=eng.start_lat,
            start_lon=eng.start_lon,
            skills_json='["Локальные работы"]',
            status="active",
        )
    )
    original = _task("original", "09:30", "10:20", 50)
    repos["task"].create(
        Task(
            id=original.id,
            dispatcher_id=dispatcher_id,
            address=original.address,
            lat=original.lat,
            lon=original.lon,
            window_start=original.window_start,
            window_end=original.window_end,
            duration_min=original.duration_min,
            required_skill=original.required_skill,
            status="active",
        )
    )
    repos["schedule"].bulk_create(
        [
            ScheduleRecord(
                dispatcher_id=dispatcher_id,
                engineer_id=eng.id,
                engineer_name=eng.name,
                task_id=original.id,
                task_address=original.address,
                lat=original.lat,
                lon=original.lon,
                order=1,
                arrival_time="09:30",
                start_time="09:30",
                end_time="10:20",
                travel_km=0,
                travel_min=0,
                required_skill=original.required_skill,
            )
        ]
    )
    services["schedule"].algo_client = AlgorithmClient()
    state = await services["schedule"].replan(
        dispatcher_id,
        [
            ChangeEventIn(
                event_type="REGULAR_TASK",
                timestamp="09:05",
                task=TaskCreate(
                    id="gap",
                    address="gap",
                    lat=55.75,
                    lon=37.62,
                    window_start="10:45",
                    window_end="11:15",
                    duration_min=30,
                ),
            )
        ],
    )
    assert [(s.task_id, s.start_time, s.end_time) for s in state.schedule[0].stops] == [
        ("original", "09:30", "10:20"),
        ("gap", "10:45", "11:15"),
    ]
    assert state.schedule[0].total_work_min == 80

    previous_record_ids = [record.id for record in repos["schedule"].get_all_by_dispatcher(dispatcher_id)]
    failed_insertion = await services["schedule"].replan(
        dispatcher_id,
        [
            ChangeEventIn(
                event_type="REGULAR_TASK",
                timestamp="09:05",
                task=TaskCreate(
                    id="no_slot",
                    address="no_slot",
                    lat=55.75,
                    lon=37.62,
                    window_start="09:40",
                    window_end="10:00",
                    duration_min=30,
                ),
            )
        ],
    )
    assert [record.id for record in repos["schedule"].get_all_by_dispatcher(dispatcher_id)] == previous_record_ids
    assert [(s.task_id, s.start_time) for s in failed_insertion.schedule[0].stops] == [
        ("original", "09:30"),
        ("gap", "10:45"),
    ]
    assert repos["task"].get_by_id(dispatcher_id, "no_slot").status == "new"
    assert "no_slot" in {task.task_id for task in failed_insertion.unassigned_tasks}

    with pytest.raises(HTTPException) as exc:
        await services["schedule"].replan(
            dispatcher_id, [ChangeEventIn(event_type="CANCEL_TASK", timestamp="09:40", task_id="original")]
        )
    assert exc.value.status_code == 409
    assert repos["task"].get_by_id(dispatcher_id, "original").status == "active"
    assert [r.task_id for r in repos["schedule"].get_all_by_dispatcher(dispatcher_id)] == ["original", "gap"]

    monkeypatch.setattr(
        "backend.Services.schedule_service._current_event_timestamp", lambda: "2026-09-27T09:40:00+03:00"
    )
    with pytest.raises(HTTPException) as exc:
        await services["task"].cancel_task(dispatcher_id, "original")
    assert exc.value.status_code == 409
    with pytest.raises(HTTPException) as exc:
        services["task"].delete_task(dispatcher_id, "original")
    assert exc.value.status_code == 409

    offline = await services["engineer"].toggle_status(dispatcher_id, eng.id)
    assert next(e for e in offline.engineers if e.id == eng.id).status == "unavailable"
    assert [stop.task_id for stop in offline.schedule[0].stops] == ["original"]
    assert {task.task_id for task in offline.unassigned_tasks} == {"gap", "no_slot"}
    with pytest.raises(HTTPException) as exc:
        services["engineer"].delete_engineer(dispatcher_id, eng.id)
    assert exc.value.status_code == 409
