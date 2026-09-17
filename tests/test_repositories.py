from backend.Entities.engineer import Engineer
from backend.Entities.explanation import ExplanationCache
from backend.Entities.metrics import PlanMetricsRecord
from backend.Entities.schedule import ScheduleRecord
from backend.Entities.task import Task
from backend.Repository.dispatcher_repository import DispatcherRepository
from backend.Repository.engineer_repository import EngineerRepository
from backend.Repository.explanation_repository import ExplanationRepository
from backend.Repository.metrics_repository import MetricsRepository
from backend.Repository.schedule_repository import ScheduleRepository
from backend.Repository.task_repository import TaskRepository


def test_dispatcher_repository(repos):
    disp_repo: DispatcherRepository = repos["dispatcher"]

    disp = disp_repo.create("disp_repo_1", "vostok")
    assert disp.id == "disp_repo_1"
    assert disp.active_preset == "vostok"

    fetched = disp_repo.get_by_id("disp_repo_1")
    assert fetched is not None
    assert fetched.id == "disp_repo_1"

    updated = disp_repo.update_preset("disp_repo_1", "yugocentr")
    assert updated.active_preset == "yugocentr"

    deleted = disp_repo.delete("disp_repo_1")
    assert deleted is True
    assert disp_repo.get_by_id("disp_repo_1") is None


def test_engineer_repository(repos):
    disp_repo: DispatcherRepository = repos["dispatcher"]
    eng_repo: EngineerRepository = repos["engineer"]

    disp_repo.create("disp_eng")
    eng1 = Engineer(id="e1", dispatcher_id="disp_eng", name="Инженер 1", start_lat=55.0, start_lon=37.0)
    eng2 = Engineer(id="e2", dispatcher_id="disp_eng", name="Инженер 2", start_lat=55.1, start_lon=37.1)

    eng_repo.create(eng1)
    eng_repo.create(eng2)

    all_engs = eng_repo.get_all_by_dispatcher("disp_eng")
    assert len(all_engs) == 2

    # Status update & active filter
    eng_repo.set_status("disp_eng", "e1", "unavailable")
    active = eng_repo.get_active_by_dispatcher("disp_eng")
    assert len(active) == 1
    assert active[0].id == "e2"

    # Mark status batch
    eng_repo.mark_status_for_dispatcher("disp_eng", from_status="active", to_status="new")
    assert eng_repo.get_by_id("disp_eng", "e2").status == "new"

    # Delete single
    eng_repo.delete("disp_eng", "e2")
    assert eng_repo.get_by_id("disp_eng", "e2") is None

    # Delete all
    eng_repo.delete_all_by_dispatcher("disp_eng")
    assert len(eng_repo.get_all_by_dispatcher("disp_eng")) == 0


def test_task_repository(repos):
    disp_repo: DispatcherRepository = repos["dispatcher"]
    task_repo: TaskRepository = repos["task"]

    disp_repo.create("disp_task")
    t1 = Task(id="t1", dispatcher_id="disp_task", address="Адрес 1", lat=55.0, lon=37.0)
    t2 = Task(id="t2", dispatcher_id="disp_task", address="Адрес 2", lat=55.1, lon=37.1)

    task_repo.create(t1)
    task_repo.create(t2)

    assert len(task_repo.get_all_by_dispatcher("disp_task")) == 2

    task_repo.set_status("disp_task", "t1", "cancelled")
    active = task_repo.get_active_by_dispatcher("disp_task")
    assert len(active) == 1
    assert active[0].id == "t2"

    task_repo.delete("disp_task", "t2")
    assert task_repo.get_by_id("disp_task", "t2") is None


def test_schedule_repository(repos):
    disp_repo: DispatcherRepository = repos["dispatcher"]
    sched_repo: ScheduleRepository = repos["schedule"]

    disp_repo.create("disp_sched")
    records = [
        ScheduleRecord(
            dispatcher_id="disp_sched",
            engineer_id="e1",
            engineer_name="И1",
            task_id="t1",
            task_address="А1",
            lat=55.0,
            lon=37.0,
            order=1,
            arrival_time="10:00",
            start_time="10:00",
            end_time="10:45",
        ),
        ScheduleRecord(
            dispatcher_id="disp_sched",
            engineer_id="e1",
            engineer_name="И1",
            task_id="t2",
            task_address="А2",
            lat=55.1,
            lon=37.1,
            order=2,
            arrival_time="11:00",
            start_time="11:00",
            end_time="11:45",
        ),
    ]
    sched_repo.bulk_create(records)

    all_sched = sched_repo.get_all_by_dispatcher("disp_sched")
    assert len(all_sched) == 2

    by_eng = sched_repo.get_by_engineer("disp_sched", "e1")
    assert len(by_eng) == 2
    assert by_eng[0].order == 1

    by_task = sched_repo.get_by_task("disp_sched", "t1")
    assert by_task is not None
    assert by_task.task_id == "t1"

    sched_repo.delete_by_task("disp_sched", "t1")
    assert sched_repo.get_by_task("disp_sched", "t1") is None

    sched_repo.delete_all_by_dispatcher("disp_sched")
    assert len(sched_repo.get_all_by_dispatcher("disp_sched")) == 0


def test_explanation_and_metrics_repositories(repos):
    exp_repo: ExplanationRepository = repos["explanation"]
    met_repo: MetricsRepository = repos["metrics"]

    cache = ExplanationCache(
        dispatcher_id="disp_x",
        task_id="task_x",
        assigned_engineer_id="eng_x",
        explanation_text="XAI текст",
    )
    exp_repo.save_cache(cache)

    fetched = exp_repo.get_cache("disp_x", "task_x")
    assert fetched is not None
    assert fetched.explanation_text == "XAI текст"

    # Metrics upsert insert
    m1 = PlanMetricsRecord(
        dispatcher_id="disp_x",
        baseline_engineers=3,
        optimized_engineers=2,
    )
    met_repo.upsert(m1)
    m_fetched = met_repo.get_by_dispatcher("disp_x")
    assert m_fetched.optimized_engineers == 2

    # Metrics upsert update
    m2 = PlanMetricsRecord(
        dispatcher_id="disp_x",
        baseline_engineers=3,
        optimized_engineers=1,
    )
    met_repo.upsert(m2)
    m_updated = met_repo.get_by_dispatcher("disp_x")
    assert m_updated.optimized_engineers == 1

    # Deletions
    exp_repo.delete_by_dispatcher("disp_x")
    assert exp_repo.get_cache("disp_x", "task_x") is None

    met_repo.delete_by_dispatcher("disp_x")
    assert met_repo.get_by_dispatcher("disp_x") is None
