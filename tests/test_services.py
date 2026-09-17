import pytest

from backend.Models.engineer import EngineerCreate
from backend.Models.session import ChangeEventIn
from backend.Models.task import TaskCreate
from backend.Services.engineer_service import EngineerService
from backend.Services.schedule_service import ScheduleService
from backend.Services.session_service import SessionService
from backend.Services.task_service import TaskService


@pytest.mark.asyncio
async def test_session_service(services):
    session_svc: SessionService = services["session"]

    disp = session_svc.get_or_create_dispatcher("disp_srv_test")
    assert disp.id == "disp_srv_test"
    assert disp.active_preset == "vostok"

    state = session_svc.build_state_response("disp_srv_test")
    assert state.dispatcher_id == "disp_srv_test"
    assert len(state.engineers) > 0
    assert len(state.tasks) > 0

    # Alias check: 'yugcenter' should normalize to 'yugocentr'
    session_svc.load_preset("disp_srv_test", "yugcenter")
    state_yug = session_svc.build_state_response("disp_srv_test")
    assert state_yug.active_preset == "yugocentr"

    # Reset
    state_reset = session_svc.reset_session("disp_srv_test")
    assert len(state_reset.engineers) == 0
    assert len(state_reset.tasks) == 0
    assert len(state_reset.schedule) == 0


@pytest.mark.asyncio
async def test_engineer_service(services):
    session_svc: SessionService = services["session"]
    eng_svc: EngineerService = services["engineer"]

    disp = session_svc.get_or_create_dispatcher("disp_eng_srv")

    # Create engineer
    eng_dto = EngineerCreate(
        name="Новый Специалист",
        start_lat=55.75,
        start_lon=37.61,
        skills=["Оптика"],
    )
    created = eng_svc.create_engineer(disp.id, eng_dto)
    assert created.name == "Новый Специалист"
    assert created.status == "new"

    # Explanation for engineer
    exp = await eng_svc.get_explanation(disp.id, created.id)
    assert exp.assigned_engineer_id == created.id
    assert exp.cached is False

    # Second explanation call should be cached
    exp_cached = await eng_svc.get_explanation(disp.id, created.id)
    assert exp_cached.cached is True

    # Toggle status offline
    state_after_toggle = eng_svc.toggle_status(disp.id, created.id)
    eng_obj = next(e for e in state_after_toggle.engineers if e.id == created.id)
    assert eng_obj.status == "unavailable"

    # Delete engineer
    res = eng_svc.delete_engineer(disp.id, created.id)
    assert res["status"] == "ok"


@pytest.mark.asyncio
async def test_task_service(services):
    session_svc: SessionService = services["session"]
    task_svc: TaskService = services["task"]

    disp = session_svc.get_or_create_dispatcher("disp_task_srv")

    # Create task
    task_dto = TaskCreate(
        address="Москва, Красная пл., 1",
        lat=55.7539,
        lon=37.6208,
        priority="Срочная",
    )
    created = task_svc.create_task(disp.id, task_dto)
    assert created.address == "Москва, Красная пл., 1"
    assert created.status == "new"

    # Explanation for unassigned task
    exp = await task_svc.get_explanation(disp.id, created.id)
    assert exp.task_id == created.id
    assert exp.cached is False

    # Cached explanation
    exp_cached = await task_svc.get_explanation(disp.id, created.id)
    assert exp_cached.cached is True

    # Cancel task
    state_after_cancel = task_svc.cancel_task(disp.id, created.id)
    canc_task = next(t for t in state_after_cancel.tasks if t.id == created.id)
    assert canc_task.status == "cancelled"

    # Delete task
    del_res = task_svc.delete_task(disp.id, created.id)
    assert del_res["status"] == "ok"


@pytest.mark.asyncio
async def test_schedule_service(services):
    session_svc: SessionService = services["session"]
    sched_svc: ScheduleService = services["schedule"]

    disp = session_svc.get_or_create_dispatcher("disp_sched_srv")

    # Run optimization
    state = await sched_svc.run_optimization(disp.id)
    assert len(state.schedule) > 0
    assert state.metrics is not None
    assert state.metrics.optimized_engineers == 1

    # Replan
    replan_events = [
        ChangeEventIn(
            event_type="CANCEL_TASK",
            task_id="task_1",
        ),
        ChangeEventIn(
            event_type="URGENT_TASK",
            task=TaskCreate(
                address="Срочный вызов",
                lat=55.75,
                lon=37.61,
                priority="Срочная",
            ),
        ),
    ]
    replan_state = await sched_svc.replan(disp.id, replan_events)
    assert replan_state is not None
