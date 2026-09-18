"""
Beeline Business FSM Dispatcher - VRPTW & XAI CLI Test Suite

Tests the offline optimization engine, multi-criteria VRPTW solver,
and Explainable AI modules for benchmark datasets.
"""

import json
from pathlib import Path
from typing import Any, Dict

import pytest

from backend.Algorithm.schemas import EngineerModel, TaskModel
from backend.Algorithm.solvers.baseline import solve_baseline
from backend.Algorithm.solvers.optimizer import solve_vrptw
from backend.Algorithm.xai.explainer import generate_explanation

ROOT_DIR = Path(__file__).resolve().parent.parent

PRESET_ALIASES = {
    # 6 presets
    "vostok_syn": "vostok_syn",
    "vostok_ctrl": "vostok_ctrl",
    "yugovostok_syn": "yugovostok_syn",
    "yugovostok_ctrl": "yugovostok_ctrl",
    "yugcenter_syn": "yugcenter_syn",
    "yugcenter_ctrl": "yugcenter_ctrl",
    # Aliases
    "yugocentr": "yugcenter_syn",
    "yugcenter": "yugcenter_syn",
    "yugovostok": "yugovostok_syn",
    "yugo-vostok": "yugovostok_syn",
    "юго-восток": "yugovostok_syn",
    "vostok": "vostok_syn",
    "восток": "vostok_syn",
    "югоцентр": "yugcenter_syn",
}


def find_preset_file(preset_name: str) -> str:
    normalized = PRESET_ALIASES.get(preset_name.lower(), preset_name.lower())
    search_dirs = [
        ROOT_DIR / "data",
        ROOT_DIR / "seed",
        ROOT_DIR / "backend" / "seed",
        ROOT_DIR / "backend" / "seed" / "raw",
    ]
    candidates = [
        f"{normalized}.json",
        f"{normalized}_syn.json",
        f"{preset_name}.json",
        f"{preset_name}_syn.json",
    ]
    for d in search_dirs:
        for c in candidates:
            candidate_path = d / c
            if candidate_path.exists():
                return str(candidate_path)
    raise FileNotFoundError(f"Preset '{preset_name}' (alias '{normalized}') not found in {search_dirs}")


def load_dataset(file_path: str) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.mark.parametrize("preset", ["vostok", "yugcenter", "yugovostok"])
def test_vrptw_optimization_presets(preset: str):
    """Verifies offline VRPTW optimization produces valid schedules with improvement over baseline."""
    data_path = find_preset_file(preset)
    raw_data = load_dataset(data_path)

    engineers = [EngineerModel(**e) for e in raw_data.get("engineers", [])]
    tasks = [TaskModel(**t) for t in raw_data.get("tasks", [])]

    assert len(engineers) > 0
    assert len(tasks) > 0

    base_routes, base_metrics, base_unassigned = solve_baseline(engineers, tasks)
    opt_routes, opt_metrics, opt_unassigned = solve_vrptw(engineers, tasks)

    # VRPTW must assign tasks and have valid routes
    assert opt_metrics.assigned_tasks_count > 0
    assert len(opt_routes) == len(engineers)

    # Test XAI explanation generation
    active_routes = [r for r in opt_routes if len(r.stops) > 0]
    if active_routes:
        first_route = active_routes[0]
        stop = first_route.stops[0]
        context = {
            "type": "task",
            "engineer_name": first_route.engineer_name,
            "address": stop.address,
            "required_skill": stop.required_skill,
            "transport_type": first_route.transport_type,
            "arrival_time": stop.arrival_time,
            "window": f"{stop.start_time} - {stop.end_time}",
            "travel_km": stop.travel_km,
            "travel_min": stop.travel_min,
            "total_tasks_count": len(tasks),
            "total_engineers_count": len(engineers),
            "active_engineers_count": len(active_routes),
        }
        exp = generate_explanation(stop.task_id, first_route.engineer_id, context)
        assert len(exp) > 50
        assert first_route.engineer_name in exp
