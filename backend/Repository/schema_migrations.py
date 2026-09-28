"""Idempotent additions for databases created before the planning policy fields existed."""

from sqlalchemy import text
from sqlalchemy.engine import Engine

from backend.Models.optimization import QUALITY_METRIC_FIELDS


def migrate_planning_fields(engine: Engine) -> None:
    if engine.dialect.name != "postgresql":
        return
    with engine.begin() as connection:
        for statement in (
            "ALTER TABLE engineers ADD COLUMN IF NOT EXISTS area_id VARCHAR",
            "ALTER TABLE engineers ADD COLUMN IF NOT EXISTS is_on_duty BOOLEAN DEFAULT true",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS area_id VARCHAR",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category VARCHAR DEFAULT 'other'",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE",
            *(
                f"ALTER TABLE plan_metrics ADD COLUMN IF NOT EXISTS {column} INTEGER NOT NULL DEFAULT 0"
                for column in QUALITY_METRIC_FIELDS
            ),
        ):
            connection.execute(text(statement))
        for table in ("engineers", "tasks"):
            connection.execute(
                text(
                    f"UPDATE {table} AS item SET area_id = COALESCE("
                    "(SELECT active_preset FROM dispatchers WHERE id = item.dispatcher_id), 'default') "
                    "WHERE item.area_id IS NULL"
                )
            )
            connection.execute(text(f"ALTER TABLE {table} ALTER COLUMN area_id SET DEFAULT 'default'"))
            connection.execute(text(f"ALTER TABLE {table} ALTER COLUMN area_id SET NOT NULL"))
        connection.execute(text("UPDATE engineers SET is_on_duty = true WHERE is_on_duty IS NULL"))
        connection.execute(text("ALTER TABLE engineers ALTER COLUMN is_on_duty SET NOT NULL"))
        connection.execute(text("UPDATE tasks SET category = 'other' WHERE category IS NULL"))
        connection.execute(text("ALTER TABLE tasks ALTER COLUMN category SET NOT NULL"))
