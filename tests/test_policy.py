"""Business priorities shared by FIFO, OR-Tools and whole-plan improvement."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from backend.Models.optimization import EngineerModel, TaskModel
from backend.Services.routing.baseline import solve_baseline
from backend.Services.routing.optimizer import solve_vrptw

DAY = date(2026, 9, 28)
MOSCOW = ZoneInfo("Europe/Moscow")


def _engineer(engineer_id="eng", **kwargs):
    return EngineerModel(
        id=engineer_id,
        name=engineer_id,
        start_lat=55.75,
        start_lon=37.61,
        skills=["Локальные работы"],
        area_id=kwargs.pop("area_id", "vostok"),
        **kwargs,
    )


def _task(task_id, category="repair", **kwargs):
    return TaskModel(
        id=task_id,
        address=task_id,
        lat=55.75,
        lon=37.61,
        required_skill="Локальные работы",
        area_id=kwargs.pop("area_id", "vostok"),
        category=category,
        window_start=kwargs.pop("window_start", "09:00"),
        window_end=kwargs.pop("window_end", "10:00"),
        duration_min=kwargs.pop("duration_min", 60),
        **kwargs,
    )


def test_area_and_fixed_duty_are_hard_constraints_for_both_algorithms():
    off_duty = _engineer("off_duty", is_on_duty=False)
    other_area = _engineer("other_area", area_id="yugocentr")
    on_duty = _engineer("on_duty")
    task = _task("emergency", category="emergency")
    for solve in (solve_baseline, solve_vrptw):
        routes, metrics, _ = solve([off_duty, other_area, on_duty], [task], planning_date=DAY)
        assert [r.engineer_id for r in routes if r.stops] == ["on_duty"]
        assert metrics.unassigned_emergencies == 0


def test_no_one_crosses_area_even_to_cover_an_emergency():
    task = _task("emergency", category="emergency")
    for solve in (solve_baseline, solve_vrptw):
        routes, metrics, _ = solve([_engineer("other_area", area_id="yugocentr")], [task], planning_date=DAY)
        assert all(not route.stops for route in routes)
        assert metrics.unassigned_emergencies == 1


def test_emergency_outweighs_many_connections_despite_normal_priority():
    engineer = _engineer()
    ordinary = [_task(f"conn_{n}", category="connection", priority="Срочная") for n in range(5)]
    emergency = _task("emergency", category="emergency", priority="Обычная")

    routes, metrics, _ = solve_vrptw([engineer], ordinary + [emergency], planning_date=DAY)

    assert [stop.task_id for stop in routes[0].stops] == [emergency.id]
    assert metrics.unassigned_emergencies == 0
    assert metrics.unassigned_connections == len(ordinary)


def test_emergency_can_be_served_after_soft_reaction_limit():
    task = _task(
        "late",
        category="emergency",
        window_start="12:00",
        window_end="13:00",
        duration_min=30,
        created_at=datetime(2026, 9, 28, 9, 0, tzinfo=MOSCOW),
    )
    for solve in (solve_baseline, solve_vrptw):
        routes, metrics, _ = solve([_engineer()], [task], planning_date=DAY)
        assert routes[0].stops[0].start_time == "12:00"
        assert metrics.unassigned_emergencies == 0
        assert metrics.late_emergencies == 1
        assert metrics.emergency_excess_min == 60
        assert metrics.measured_emergencies == 1
        assert metrics.target_met_emergencies == 0


def test_missing_receipt_time_is_not_reported_as_zero_reaction():
    task = _task("unknown_receipt", category="emergency", window_start="12:00", window_end="13:00")
    routes, metrics, _ = solve_baseline([_engineer()], [task], planning_date=DAY)
    assert routes[0].stops
    assert metrics.measured_emergencies == 0
    assert metrics.late_emergencies == 0
    assert metrics.target_met_emergencies == 0


def test_task_cannot_start_before_receipt():
    task = _task(
        "received_at_ten",
        category="emergency",
        window_end="11:00",
        duration_min=30,
        created_at=datetime(2026, 9, 28, 10, 0, tzinfo=MOSCOW),
    )
    for solve in (solve_baseline, solve_vrptw):
        routes, metrics, _ = solve([_engineer()], [task], planning_date=DAY)
        assert routes[0].stops[0].start_time == "10:00"
        assert metrics.emergency_response_min == 0
        assert metrics.target_met_emergencies == 1


def test_older_emergency_is_not_starved_when_only_one_fits():
    newer = _task("a_newer", category="emergency", created_at=datetime(2026, 9, 28, 9, 10, tzinfo=MOSCOW))
    older = _task("z_older", category="emergency", created_at=datetime(2026, 9, 28, 9, 0, tzinfo=MOSCOW))

    routes, metrics, unassigned = solve_vrptw([_engineer()], [newer, older], planning_date=DAY)

    assert [stop.task_id for stop in routes[0].stops] == [older.id]
    assert [task.task_id for task in unassigned] == [newer.id]
    assert metrics.unassigned_emergencies == 1
