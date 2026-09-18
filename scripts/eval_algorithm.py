#!/usr/bin/env python3
"""
Beeline Business FSM Dispatcher - Standalone Algorithm Evaluation & Benchmarking CLI.

Runs schedule optimization algorithms (Built-in VRPTW, Baseline FIFO, or Custom User Solvers)
and Explainable AI (XAI) engine completely offline without internet or running background servers.

Usage:
  python scripts/eval_algorithm.py --preset vostok
  python scripts/eval_algorithm.py --preset yugcenter
  python scripts/eval_algorithm.py --preset yugovostok
  python scripts/eval_algorithm.py --file path/to/dataset.json
  python scripts/eval_algorithm.py --solver baseline
  python scripts/eval_algorithm.py --custom-solver my_solver.py:my_func --preset vostok
  python scripts/eval_algorithm.py --explain-task <task_id>
  python scripts/eval_algorithm.py --explain-engineer <engineer_id>
  python scripts/eval_algorithm.py --explain-all
  python scripts/eval_algorithm.py --json
"""

import os
import sys
import time
import json
import importlib
import importlib.util
import argparse
from typing import Dict, Any, List, Tuple, Callable

# Ensure project root is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(CURRENT_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

try:
    from backend.Services.algorithm import (
        EngineerModel,
        TaskModel,
        EngineerRoute,
        PlanMetrics,
        UnassignedTask,
        solve_baseline,
        solve_vrptw,
        generate_explanation,
    )
except ImportError as e:
    print(f"[ERROR] Failed to import algorithm modules: {e}")
    print("Ensure you run this script with the project virtual environment:")
    print("  ./venv/bin/python scripts/eval_algorithm.py")
    sys.exit(1)


PRESET_ALIASES = {
    "yugocentr": "yugcenter",
    "yugcenter": "yugcenter",
    "yugovostok": "yugovostok",
    "yugo-vostok": "yugovostok",
    "vostok": "vostok"
}


def find_preset_file(preset_name: str) -> str:
    """Locates a dataset preset file within standard project search directories."""
    normalized = PRESET_ALIASES.get(preset_name.lower(), preset_name.lower())
    search_dirs = [
        os.path.join(ROOT_DIR, "backend", "seed"),
        os.path.join(ROOT_DIR, "backend", "seed", "raw"),
        os.path.join(ROOT_DIR, "seed"),
    ]
    for d in search_dirs:
        candidate = os.path.join(d, f"{normalized}.json")
        if os.path.exists(candidate):
            return candidate
    raise FileNotFoundError(f"Preset '{preset_name}' (alias '{normalized}') not found in {search_dirs}")


def load_dataset(file_path: str) -> Dict[str, Any]:
    """Loads and parses a JSON dataset file."""
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_custom_solver(solver_spec: str) -> Callable:
    """
    Dynamically loads a custom solver function given a spec:
    - Module path: 'backend.Services.algorithm.solvers.optimizer:solve_vrptw'
    - File path: 'my_solver.py:solve_custom'
    Expected signature:
      solve(engineers: List[EngineerModel], tasks: List[TaskModel]) -> Tuple[List[EngineerRoute], PlanMetrics, List[UnassignedTask]]
    """
    if ":" not in solver_spec:
        raise ValueError(f"Invalid solver specification '{solver_spec}'. Expected format 'module_or_path:function_name'")

    target_path, func_name = solver_spec.rsplit(":", 1)

    if os.path.isfile(target_path):
        spec = importlib.util.spec_from_file_location("custom_solver_mod", os.path.abspath(target_path))
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load module from file: {target_path}")
        mod = importlib.util.module_from_spec(spec)
        sys.modules["custom_solver_mod"] = mod
        spec.loader.exec_module(mod)
    else:
        mod = importlib.import_module(target_path)

    if not hasattr(mod, func_name):
        raise AttributeError(f"Module '{target_path}' does not have function '{func_name}'")

    return getattr(mod, func_name)


def run_cli():
    """Main CLI execution routine."""
    parser = argparse.ArgumentParser(
        description="Beeline Business FSM Dispatcher - Offline VRPTW & XAI Evaluation CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--preset", type=str, default="vostok",
                        help="Dataset preset: vostok, yugcenter, or yugovostok (default: vostok)")
    parser.add_argument("--file", type=str, default=None,
                        help="Path to custom JSON dataset file with engineers and tasks")
    parser.add_argument("--solver", type=str, default="optimizer",
                        help="Solver to evaluate: 'optimizer' (default), 'baseline', or python path 'module:func'")
    parser.add_argument("--custom-solver", type=str, default=None,
                        help="Path to custom solver file and function, e.g. 'custom_algo.py:my_solve'")
    parser.add_argument("--explain-task", type=str, default=None,
                        help="Generate offline AI explanation for a specific task ID")
    parser.add_argument("--explain-engineer", type=str, default=None,
                        help="Generate offline AI explanation for a specific engineer ID")
    parser.add_argument("--explain-all", action="store_true",
                        help="Print AI explanations for all unassigned tasks and idle engineers")
    parser.add_argument("--json", action="store_true",
                        help="Output full optimization result in JSON format to stdout")

    args = parser.parse_args()

    # 1. Resolve dataset file
    if args.file:
        data_path = os.path.abspath(args.file)
        if not os.path.exists(data_path):
            print(f"[ERROR] Specified file does not exist: {data_path}")
            sys.exit(1)
        source_name = os.path.basename(data_path)
    else:
        try:
            data_path = find_preset_file(args.preset)
            source_name = f"Preset: {args.preset} ({os.path.basename(data_path)})"
        except FileNotFoundError as e:
            print(f"[ERROR] {e}")
            sys.exit(1)

    raw_data = load_dataset(data_path)
    raw_engineers = raw_data.get("engineers", [])
    raw_tasks = raw_data.get("tasks", [])

    # Validate domain models
    engineers = [EngineerModel(**e) for e in raw_engineers]
    tasks = [TaskModel(**t) for t in raw_tasks]

    # 2. Resolve Candidate Solver
    solver_name = "VRPTW Optimizer"
    solver_fn = solve_vrptw

    if args.custom_solver:
        try:
            solver_fn = load_custom_solver(args.custom_solver)
            solver_name = f"Custom Solver ({args.custom_solver})"
        except Exception as e:
            print(f"[ERROR] Failed to load custom solver: {e}")
            sys.exit(1)
    elif args.solver and args.solver != "optimizer":
        if args.solver == "baseline":
            solver_fn = solve_baseline
            solver_name = "Baseline FIFO"
        else:
            try:
                solver_fn = load_custom_solver(args.solver)
                solver_name = f"Solver ({args.solver})"
            except Exception as e:
                print(f"[ERROR] Failed to load solver '{args.solver}': {e}")
                sys.exit(1)

    # 3. Benchmark Baseline
    t0_base = time.perf_counter()
    base_routes, base_metrics, base_unassigned = solve_baseline(engineers, tasks)
    t_base_ms = (time.perf_counter() - t0_base) * 1000

    # 4. Benchmark Candidate Solver
    t0_opt = time.perf_counter()
    opt_routes, opt_metrics, opt_unassigned = solver_fn(engineers, tasks)
    t_opt_ms = (time.perf_counter() - t0_opt) * 1000

    # 5. Calculate Improvements
    mileage_saved_km = round(base_metrics.total_mileage_km - opt_metrics.total_mileage_km, 2)
    mileage_saved_pct = round((mileage_saved_km / base_metrics.total_mileage_km * 100), 1) if base_metrics.total_mileage_km > 0 else 0.0
    eng_saved_cnt = base_metrics.total_engineers_used - opt_metrics.total_engineers_used
    eng_saved_pct = round((eng_saved_cnt / base_metrics.total_engineers_used * 100), 1) if base_metrics.total_engineers_used > 0 else 0.0

    opt_metrics.mileage_reduction_pct = mileage_saved_pct
    opt_metrics.engineers_reduction_pct = eng_saved_pct

    def dump_model(m):
        return m.model_dump() if hasattr(m, "model_dump") else m.dict()

    # 6. JSON output mode
    if args.json:
        result = {
            "source": source_name,
            "solver_evaluated": solver_name,
            "tasks_count": len(tasks),
            "engineers_count": len(engineers),
            "benchmark": {
                "baseline_runtime_ms": round(t_base_ms, 2),
                "solver_runtime_ms": round(t_opt_ms, 2),
                "mileage_reduction_pct": mileage_saved_pct,
                "engineers_reduction_pct": eng_saved_pct
            },
            "baseline_metrics": dump_model(base_metrics),
            "solver_metrics": dump_model(opt_metrics),
            "routes": [dump_model(r) for r in opt_routes],
            "unassigned_tasks": [dump_model(u) for u in opt_unassigned]
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    # 7. Human-readable CLI Output
    sep = "=" * 76
    subsep = "-" * 76

    print(sep)
    print("  🐝 БИЛАЙН БИЗНЕС — СТЕНД ОЦЕНКИ И ТЕСТИРОВАНИЯ АЛГОРИТМОВ (VRPTW EVAL)")
    print(f"  Источник данных : {source_name}")
    print(f"  Тестируемый алг.: {solver_name}")
    print(f"  Масштаб сектора : Заявок: {len(tasks)} | Бригад: {len(engineers)}")
    print(sep)

    print("\n📊 1. СРАВНИТЕЛЬНЫЙ БЕНЧМАРК: БАЗОВЫЙ (FIFO) VS ТЕСТИРУЕМЫЙ АЛГОРИТМ")
    print(subsep)
    print(f"  {'Метрика':<32} | {'Базовый (FIFO)':<18} | {'Оценка (' + solver_name[:12] + ')':<18}")
    print(subsep)
    base_travel_min = sum(r.total_travel_min for r in base_routes)
    opt_travel_min = sum(r.total_travel_min for r in opt_routes)

    print(f"  {'Задействовано инженеров':<32} | {base_metrics.total_engineers_used:<18} | {opt_metrics.total_engineers_used:<18} (дельта: {eng_saved_cnt:+d} / {eng_saved_pct:+.1f}%)")
    print(f"  {'Суммарный пробег (км)':<32} | {base_metrics.total_mileage_km:<18.1f} | {opt_metrics.total_mileage_km:<18.1f} (дельта: -{mileage_saved_km:.1f} км / -{mileage_saved_pct}%)")
    print(f"  {'Время в пути (мин)':<32} | {base_travel_min:<18} | {opt_travel_min:<18}")
    print(f"  {'Распределено заявок':<32} | {base_metrics.assigned_tasks_count:<18} | {opt_metrics.assigned_tasks_count:<18}")
    print(f"  {'Нераспределено (проблемных)':<32} | {base_metrics.unassigned_tasks_count:<18} | {opt_metrics.unassigned_tasks_count:<18}")
    print(f"  {'Время расчета (runtime ms)':<32} | {t_base_ms:<18.2f} | {t_opt_ms:<18.2f}")
    print(subsep)

    # 8. Route distribution per engineer
    print(f"\n👷 2. МАРШРУТНЫЕ ЛИСТЫ ИСПОЛНИТЕЛЕЙ ({solver_name})")
    print(subsep)
    active_routes = [r for r in opt_routes if len(r.stops) > 0]
    idle_routes = [r for r in opt_routes if len(r.stops) == 0]

    for r in active_routes:
        print(f"  • {r.engineer_name:<26} ({r.transport_type:<20}) : {len(r.stops)} визитов | {r.total_distance_km:.1f} км | ~{r.total_travel_min} мин пути")
        stop_summaries = []
        for s in r.stops:
            badge = "⚡" if s.priority == "Срочная" else ""
            stop_summaries.append(f"#{s.order} [Заявка {s.task_id}{badge} @ {s.arrival_time}]")
        print(f"    Путь: {' -> '.join(stop_summaries)}")

    if idle_routes:
        print(f"\n  💤 Оперативный резерв (инженеры без выездов, экономия ресурса):")
        for r in idle_routes:
            print(f"    - {r.engineer_name} ({r.transport_type}, смена {r.shift_start}-{r.shift_end})")

    # 9. Problematic / Unassigned Tasks
    if opt_unassigned:
        print(f"\n⚠️  3. НЕРАСПРЕДЕЛЕННЫЕ (ПРОБЛЕМНЫЕ) ЗАЯВКИ ({len(opt_unassigned)} шт)")
        print(subsep)
        for u in opt_unassigned:
            urg_badge = "⚡ [СРОЧНАЯ] " if u.priority == "Срочная" else ""
            print(f"  • {urg_badge}Заявка #{u.task_id}: {u.address}")
            print(f"    Причина: {u.reason}")

    # 10. AI Explanations section
    task_by_id = {t.id: t for t in tasks}
    eng_by_id = {e.id: e for e in engineers}
    route_by_eng = {r.engineer_id: r for r in opt_routes}
    task_assignment_map = {}
    for r in opt_routes:
        for s in r.stops:
            task_assignment_map[s.task_id] = (r.engineer_id, s)

    if args.explain_task:
        tid = args.explain_task
        print(f"\n🤖 4. ИИ-ОБОСНОВАНИЕ ДЛЯ ЗАЯВКИ #{tid}")
        print(subsep)
        task_obj = task_by_id.get(tid)
        if not task_obj:
            print(f"  [ОШИБКА] Заявка #{tid} не найдена в датасете!")
        else:
            assignment = task_assignment_map.get(tid)
            if assignment:
                eng_id, stop = assignment
                eng = eng_by_id.get(eng_id)
                ctx = {
                    "type": "task",
                    "address": task_obj.address,
                    "priority": task_obj.priority,
                    "duration_min": task_obj.duration_min,
                    "window": f"{task_obj.window_start} - {task_obj.window_end}",
                    "required_skill": task_obj.required_skill,
                    "engineer_name": eng.name if eng else eng_id,
                    "arrival_time": stop.arrival_time,
                    "travel_km": stop.travel_km,
                    "travel_min": stop.travel_min,
                    "order": stop.order,
                    "total_tasks_count": len(tasks),
                    "total_engineers_count": len(engineers),
                    "active_engineers_count": len(active_routes)
                }
                print(generate_explanation(tid, eng_id, ctx))
            else:
                unass = next((u for u in opt_unassigned if u.task_id == tid), None)
                ctx = {
                    "type": "task_unassigned",
                    "address": task_obj.address,
                    "priority": task_obj.priority,
                    "duration_min": task_obj.duration_min,
                    "window": f"{task_obj.window_start} - {task_obj.window_end}",
                    "required_skill": task_obj.required_skill,
                    "reason": unass.reason if unass else "Превышение окон",
                    "total_tasks_count": len(tasks),
                    "total_engineers_count": len(engineers),
                    "active_engineers_count": len(active_routes)
                }
                print(generate_explanation(tid, None, ctx))

    if args.explain_engineer:
        eid = args.explain_engineer
        print(f"\n🤖 4. ИИ-ОБОСНОВАНИЕ ДЛЯ ИНЖЕНЕРА #{eid}")
        print(subsep)
        eng = eng_by_id.get(eid)
        if not eng:
            print(f"  [ОШИБКА] Инженер #{eid} не найден в датасете!")
        else:
            route = route_by_eng.get(eid)
            is_idle = not route or len(route.stops) == 0
            ctx = {
                "type": "engineer_idle" if is_idle else "engineer_route",
                "engineer_name": eng.name,
                "transport_type": eng.transport_type,
                "shift": f"{eng.shift_start} - {eng.shift_end}",
                "skills": eng.skills,
                "is_idle": is_idle,
                "stops_count": len(route.stops) if route else 0,
                "total_travel_km": route.total_distance_km if route else 0.0,
                "total_travel_min": route.total_travel_min if route else 0,
                "total_tasks_count": len(tasks),
                "total_engineers_count": len(engineers),
                "active_engineers_count": len(active_routes)
            }
            print(generate_explanation(eid, eid, ctx))

    if args.explain_all:
        print(f"\n🤖 4. ИИ-ОБОСНОВАНИЯ ДЛЯ ВСЕХ ПРОБЛЕМНЫХ И РЕЗЕРВНЫХ ОБЪЕКТОВ")
        print(subsep)
        for u in opt_unassigned:
            t = task_by_id.get(u.task_id)
            if t:
                ctx = {
                    "type": "task_unassigned",
                    "address": t.address,
                    "priority": t.priority,
                    "duration_min": t.duration_min,
                    "window": f"{t.window_start} - {t.window_end}",
                    "required_skill": t.required_skill,
                    "reason": u.reason,
                    "total_tasks_count": len(tasks),
                    "total_engineers_count": len(engineers),
                    "active_engineers_count": len(active_routes)
                }
                print(f"\n--- [Заявка #{u.task_id}] ---")
                print(generate_explanation(u.task_id, None, ctx))

        for r in idle_routes:
            eng = eng_by_id.get(r.engineer_id)
            if eng:
                ctx = {
                    "type": "engineer_idle",
                    "engineer_name": eng.name,
                    "transport_type": eng.transport_type,
                    "shift": f"{eng.shift_start} - {eng.shift_end}",
                    "skills": eng.skills,
                    "is_idle": True,
                    "total_tasks_count": len(tasks),
                    "total_engineers_count": len(engineers),
                    "active_engineers_count": len(active_routes)
                }
                print(f"\n--- [Инженер #{r.engineer_id}] ---")
                print(generate_explanation(r.engineer_id, r.engineer_id, ctx))

    print(f"\n{sep}")
    print("  ✅ Расчет и валидация успешно завершены.")
    print(sep)


if __name__ == "__main__":
    run_cli()
