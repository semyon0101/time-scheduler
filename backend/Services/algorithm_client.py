from typing import Any, Optional

from backend.Models.optimization import (
    ChangeEvent,
    EngineerModel,
    EngineerRoute,
    TaskModel,
    UnassignedTask,
)
from backend.Services.explanation import generate_explanation
from backend.Services.routing.baseline import solve_baseline
from backend.Services.routing.feasibility import diagnose_unassigned_reason
from backend.Services.routing.optimizer import solve_vrptw
from backend.Services.routing.policy import assess_plan
from backend.Services.routing.replanner import apply_batch_replanning


class AlgorithmClient:
    """
    In-process algorithm engine executing VRPTW optimization and XAI
    directly within the backend without requiring a separate microservice.
    """

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url

    async def call_optimize(self, engineers: list[dict[str, Any]], tasks: list[dict[str, Any]]) -> dict[str, Any]:
        eng_models = [EngineerModel(**e) for e in engineers]
        task_models = [TaskModel(**t) for t in tasks]

        base_routes, base_metrics, _ = solve_baseline(eng_models, task_models)
        opt_routes, opt_metrics, opt_unassigned = solve_vrptw(eng_models, task_models)

        _, base_key = assess_plan(base_routes, task_models)
        _, opt_key = assess_plan(opt_routes, task_models)
        if base_key < opt_key:
            opt_routes, opt_metrics = base_routes, base_metrics.model_copy(deep=True)
            assigned_by_baseline = {stop.task_id for route in base_routes for stop in route.stops}
            opt_unassigned = [
                UnassignedTask(
                    task_id=task.id,
                    address=task.address,
                    reason=diagnose_unassigned_reason(task, eng_models),
                    priority=task.priority,
                )
                for task in task_models
                if task.id not in assigned_by_baseline
            ]
            opt_key = base_key

        # Distance and staff comparisons are meaningful only for equal coverage by category.
        coverage_equal = {stop.task_id for route in base_routes for stop in route.stops} == {
            stop.task_id for route in opt_routes for stop in route.stops
        }
        if coverage_equal and base_metrics.total_mileage_km > 0:
            delta = base_metrics.total_mileage_km - opt_metrics.total_mileage_km
            opt_metrics.mileage_reduction_pct = round((delta / base_metrics.total_mileage_km) * 100, 1)

        if coverage_equal and base_metrics.total_engineers_used > 0:
            delta = base_metrics.total_engineers_used - opt_metrics.total_engineers_used
            opt_metrics.engineers_reduction_pct = round((delta / base_metrics.total_engineers_used) * 100, 1)

        return {
            "baseline_metrics": base_metrics.model_dump(),
            "baseline_routes": [r.model_dump() for r in base_routes],
            "optimized_metrics": opt_metrics.model_dump(),
            "optimized_routes": [r.model_dump() for r in opt_routes],
            "unassigned_tasks": [u.model_dump() for u in opt_unassigned],
        }

    async def call_replan(
        self,
        current_schedule: list[dict[str, Any]],
        engineers: list[dict[str, Any]],
        events: list[dict[str, Any]],
        tasks: list[dict[str, Any]],
    ) -> dict[str, Any]:
        sched_models = [EngineerRoute(**s) for s in current_schedule]
        eng_models = [EngineerModel(**e) for e in engineers]
        event_models = [ChangeEvent(**ev) for ev in events]
        task_models = [TaskModel(**t) for t in tasks]

        updated_routes, metrics, unassigned, diff = apply_batch_replanning(
            sched_models, eng_models, event_models, task_models
        )
        return {
            "updated_routes": [r.model_dump() for r in updated_routes],
            "unassigned_tasks": [u.model_dump() for u in unassigned],
            "metrics": metrics.model_dump(),
            "diff": diff,
        }

    async def call_explain(self, task_id: str, assigned_engineer_id: str, context: dict[str, Any]) -> dict[str, Any]:
        text = generate_explanation(task_id, assigned_engineer_id, context)
        return {
            "task_id": task_id,
            "assigned_engineer_id": assigned_engineer_id,
            "explanation": text,
        }


_default_client = None


def get_default_algorithm_client() -> AlgorithmClient:
    global _default_client
    if _default_client is None:
        _default_client = AlgorithmClient()
    return _default_client
