from sqlalchemy import inspect, text

from backend.Entities.database import create_tables


def test_existing_postgres_tables_are_extended_without_losing_rows(test_db):
    engine = test_db.get_bind()
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO dispatchers (id, active_preset) VALUES ('legacy', 'vostok')"))
        connection.execute(
            text(
                "INSERT INTO engineers (id, dispatcher_id, name, start_lat, start_lon, skills_json) "
                "VALUES ('legacy_eng', 'legacy', 'Legacy', 55.75, 37.61, '[]')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO tasks (id, dispatcher_id, address, lat, lon) "
                "VALUES ('legacy_task', 'legacy', 'Moscow', 55.75, 37.61)"
            )
        )
        connection.execute(text("ALTER TABLE engineers DROP COLUMN area_id"))
        connection.execute(text("ALTER TABLE engineers DROP COLUMN is_on_duty"))
        connection.execute(text("ALTER TABLE tasks DROP COLUMN area_id"))
        connection.execute(text("ALTER TABLE tasks DROP COLUMN category"))
        connection.execute(text("ALTER TABLE tasks DROP COLUMN created_at"))
        connection.execute(text("ALTER TABLE plan_metrics DROP COLUMN late_emergencies"))

    create_tables(bind_engine=engine)
    create_tables(bind_engine=engine)

    with engine.connect() as connection:
        assert connection.execute(text("SELECT area_id, is_on_duty FROM engineers WHERE id='legacy_eng'")).one() == (
            "vostok",
            True,
        )
        assert connection.execute(
            text("SELECT area_id, category, created_at FROM tasks WHERE id='legacy_task'")
        ).one() == ("vostok", "other", None)
        assert "late_emergencies" in {col["name"] for col in inspect(engine).get_columns("plan_metrics")}
