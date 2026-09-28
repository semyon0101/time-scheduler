import pytest
from pydantic import ValidationError

from backend.config import sqlalchemy_url
from backend.Models.engineer import EngineerCreate, EngineerOut
from backend.Models.optimization import TaskModel
from backend.Models.schedule import MetricsOut, StateResponse
from backend.Models.session import ChangeEventIn, ReplanRequestIn
from backend.Models.settings import Settings
from backend.Models.task import TaskCreate, TaskOut


def test_settings_defaults():
    s = Settings()
    assert s.port == 8000
    assert s.host == "0.0.0.0"
    assert len(s.cors_origins) > 0


def test_postgresql_driver_is_explicit():
    assert (
        sqlalchemy_url("postgresql://postgres:secret@localhost:5432/scheduler_db").drivername == "postgresql+psycopg2"
    )
    assert sqlalchemy_url("sqlite:///:memory:").drivername == "sqlite"


def test_engineer_models():
    create_dto = EngineerCreate(
        name="Алексей",
        start_lat=55.75,
        start_lon=37.61,
        skills=["Оптика", "Монтаж"],
    )
    assert create_dto.shift_start == "09:00"
    assert create_dto.shift_end == "22:00"
    assert create_dto.transport_type == "Автомобиль"

    out_dto = EngineerOut(
        id="eng_test",
        name=create_dto.name,
        start_lat=create_dto.start_lat,
        start_lon=create_dto.start_lon,
        shift_start=create_dto.shift_start,
        shift_end=create_dto.shift_end,
        skills=create_dto.skills,
        transport_type=create_dto.transport_type,
        status="active",
    )
    assert out_dto.id == "eng_test"


def test_task_models():
    task_in = TaskCreate(
        address="г. Москва, ул. Арбат, 1",
        lat=55.75,
        lon=37.59,
        priority="Срочная",
    )
    assert task_in.duration_min == 45
    assert task_in.required_skill == "Локальные работы"

    task_out = TaskOut(
        id="task_123",
        address=task_in.address,
        lat=task_in.lat,
        lon=task_in.lon,
        window_start=task_in.window_start,
        window_end=task_in.window_end,
        duration_min=task_in.duration_min,
        required_skill=task_in.required_skill,
        priority=task_in.priority,
        status="new",
    )
    assert task_out.status == "new"


@pytest.mark.parametrize("model", [TaskCreate, TaskModel])
@pytest.mark.parametrize("start,end", [("16:00", "12:00"), ("16:00", "16:00"), ("25:00", "26:00")])
def test_task_models_reject_invalid_windows(model, start, end):
    with pytest.raises(ValidationError):
        model(id="invalid", address="Москва", lat=55.75, lon=37.61, window_start=start, window_end=end)


def test_state_response_structure():
    resp = StateResponse(
        dispatcher_id="disp_1",
        active_preset="vostok",
        engineers=[],
        tasks=[],
        schedule=[],
        metrics=MetricsOut(
            baseline_engineers=2,
            baseline_mileage=20.0,
            optimized_engineers=1,
            optimized_mileage=12.0,
            assigned_count=5,
            unassigned_count=0,
        ),
    )
    assert resp.dispatcher_id == "disp_1"
    assert resp.metrics.optimized_engineers == 1


def test_replan_request():
    event = ChangeEventIn(
        event_type="ENGINEER_UNAVAILABLE",
        engineer_id="eng_99",
    )
    req = ReplanRequestIn(events=[event])
    assert len(req.events) == 1
    assert req.events[0].engineer_id == "eng_99"
