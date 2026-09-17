from sqlalchemy.orm import Session

from backend.Entities.dispatcher import Dispatcher
from backend.Entities.engineer import Engineer
from backend.Entities.explanation import ExplanationCache
from backend.Entities.metrics import PlanMetricsRecord
from backend.Entities.schedule import ScheduleRecord
from backend.Entities.task import Task


def test_dispatcher_entity(test_db: Session):
    disp = Dispatcher(id="disp_test", active_preset="vostok")
    test_db.add(disp)
    test_db.commit()

    saved = test_db.query(Dispatcher).filter_by(id="disp_test").first()
    assert saved is not None
    assert saved.active_preset == "vostok"
    assert saved.created_at is not None


def test_engineer_skills_property(test_db: Session):
    disp = Dispatcher(id="disp_eng_test")
    test_db.add(disp)
    test_db.commit()

    eng = Engineer(
        id="eng_01",
        dispatcher_id="disp_eng_test",
        name="Сидоров Петр",
        start_lat=55.75,
        start_lon=37.61,
        transport_type="Автомобиль",
    )
    eng.skills = ["Сварка", "Аварийные работы"]
    test_db.add(eng)
    test_db.commit()

    saved = test_db.query(Engineer).filter_by(id="eng_01").first()
    assert saved is not None
    assert saved.skills == ["Сварка", "Аварийные работы"]
    assert "Сварка" in saved.skills_json

    # Test invalid json fallback
    saved.skills_json = "invalid_json"
    assert saved.skills == []


def test_task_entity(test_db: Session):
    disp = Dispatcher(id="disp_task_test")
    test_db.add(disp)
    test_db.commit()

    task = Task(
        id="task_01",
        dispatcher_id="disp_task_test",
        address="Ленинский проспект, 10",
        lat=55.70,
        lon=37.58,
        priority="Срочная",
        duration_min=60,
    )
    test_db.add(task)
    test_db.commit()

    saved = test_db.query(Task).filter_by(id="task_01").first()
    assert saved is not None
    assert saved.address == "Ленинский проспект, 10"
    assert saved.status == "active"
    assert saved.priority == "Срочная"


def test_schedule_and_cascade(test_db: Session):
    disp = Dispatcher(id="disp_cascade_test")
    test_db.add(disp)
    test_db.commit()

    eng = Engineer(id="eng_c", dispatcher_id=disp.id, name="Тест", start_lat=55.0, start_lon=37.0)
    task = Task(id="task_c", dispatcher_id=disp.id, address="Адрес", lat=55.0, lon=37.0)
    test_db.add_all([eng, task])
    test_db.commit()

    sr = ScheduleRecord(
        dispatcher_id=disp.id,
        engineer_id=eng.id,
        engineer_name=eng.name,
        task_id=task.id,
        task_address=task.address,
        lat=55.0,
        lon=37.0,
        order=1,
        arrival_time="10:00",
        start_time="10:00",
        end_time="10:45",
    )
    test_db.add(sr)
    test_db.commit()

    assert test_db.query(ScheduleRecord).count() == 1

    # Cascade delete dispatcher should delete engineer, task, and schedule
    test_db.delete(disp)
    test_db.commit()

    assert test_db.query(Engineer).filter_by(dispatcher_id="disp_cascade_test").count() == 0
    assert test_db.query(Task).filter_by(dispatcher_id="disp_cascade_test").count() == 0
    assert test_db.query(ScheduleRecord).filter_by(dispatcher_id="disp_cascade_test").count() == 0


def test_metrics_and_explanation_entities(test_db: Session):
    cache = ExplanationCache(
        dispatcher_id="disp_1",
        task_id="task_1",
        assigned_engineer_id="eng_1",
        explanation_text="Тестовое объяснение",
    )
    metrics = PlanMetricsRecord(
        dispatcher_id="disp_1",
        baseline_engineers=5,
        optimized_engineers=3,
        baseline_mileage=120.5,
        optimized_mileage=85.0,
        assigned_count=10,
        unassigned_count=0,
    )
    test_db.add_all([cache, metrics])
    test_db.commit()

    assert test_db.query(ExplanationCache).count() == 1
    assert test_db.query(PlanMetricsRecord).count() == 1
