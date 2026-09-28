#!/usr/bin/env python3
"""
Beeline Business FSM Dispatcher - Standalone Offline CLI Test Script

Runs the VRPTW schedule optimization and Explainable AI (XAI) engine
completely offline without internet access or running servers.

Usage:
  python test_cli.py
  python test_cli.py --preset vostok
  python test_cli.py --preset yugcenter
  python test_cli.py --preset yugovostok
  python test_cli.py --file path/to/dataset.json
  python test_cli.py --explain-task <task_id>
  python test_cli.py --explain-engineer <engineer_id>
  python test_cli.py --explain-all
  python test_cli.py --json
"""

import argparse
import json
import os
import sys
from typing import Any, Dict, List

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

try:
    from backend.Models.optimization import EngineerModel, TaskModel
    from backend.Services.explanation import generate_explanation
    from backend.Services.routing.baseline import solve_baseline
    from backend.Services.routing.dataset import enrich_preset_data
    from backend.Services.routing.optimizer import solve_vrptw
except ImportError as e:
    print(f"[ERROR] Failed to import algorithm modules: {e}")
    print("Ensure you run this script with the project virtual environment:")
    print("  ./venv/bin/python test_cli.py")
    sys.exit(1)


PRESET_ALIASES = {
    "yugocentr": "yugocentr",
    "yugcenter": "yugocentr",
    "yugovostok": "yugovostok",
    "yugo-vostok": "yugovostok",
    "vostok": "vostok",
}


def find_preset_file(preset_name: str) -> str:
    normalized = PRESET_ALIASES.get(preset_name.lower(), preset_name.lower())
    search_dirs = [
        os.path.join(CURRENT_DIR, "data"),
        os.path.join(CURRENT_DIR, "seed"),
        os.path.join(CURRENT_DIR, "backend", "seed"),
        os.path.join(CURRENT_DIR, "backend", "seed", "raw"),
    ]
    for d in search_dirs:
        candidate = os.path.join(d, f"{normalized}.json")
        if os.path.exists(candidate):
            return candidate
    raise FileNotFoundError(f"Preset '{preset_name}' (alias '{normalized}') not found in {search_dirs}")


def load_dataset(file_path: str) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def diagnose_unassigned_task(task: TaskModel, engineers: List[EngineerModel]) -> List[str]:
    """Diagnoses why a task could not be assigned."""
    tags = []
    tags.append(task.category)

    # Check skills
    has_skill = any(task.required_skill in e.skills and e.area_id == task.area_id and e.is_on_duty for e in engineers)
    if not has_skill:
        tags.append("skills_mismatch")

    # Check transport
    if task.required_transport:
        has_transport = any(e.transport_type == task.required_transport for e in engineers)
        if not has_transport:
            tags.append("transport_mismatch")

    # If qualified engineers exist but could not take it, it was a time window/shift limit
    if has_skill:
        tags.append("window_conflict")

    return tags


def run_cli():
    parser = argparse.ArgumentParser(
        description="Beeline Business FSM Dispatcher - Offline VRPTW & XAI Test CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--preset",
        type=str,
        default="vostok",
        help="Dataset preset: vostok, yugcenter, or yugovostok (default: vostok)",
    )
    parser.add_argument(
        "--file", type=str, default=None, help="Path to custom JSON dataset file with engineers and tasks"
    )
    parser.add_argument(
        "--explain-task", type=str, default=None, help="Generate offline AI explanation for a specific task ID"
    )
    parser.add_argument(
        "--explain-engineer", type=str, default=None, help="Generate offline AI explanation for a specific engineer ID"
    )
    parser.add_argument(
        "--explain-all", action="store_true", help="Print AI explanations for all unassigned tasks and idle engineers"
    )
    parser.add_argument("--json", action="store_true", help="Output full optimization result in JSON format to stdout")

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
    if not args.file:
        raw_data = enrich_preset_data(raw_data, PRESET_ALIASES.get(args.preset.lower(), args.preset.lower()))
    raw_engineers = raw_data.get("engineers", [])
    raw_tasks = raw_data.get("tasks", [])

    # Validate models
    engineers = [EngineerModel(**e) for e in raw_engineers]
    tasks = [TaskModel(**t) for t in raw_tasks]

    # 2. Run Baseline and VRPTW Solvers
    base_routes, base_metrics, base_unassigned = solve_baseline(engineers, tasks)
    opt_routes, opt_metrics, opt_unassigned = solve_vrptw(engineers, tasks)

    # 3. Calculate improvements
    base_ids = {stop.task_id for route in base_routes for stop in route.stops}
    opt_ids = {stop.task_id for route in opt_routes for stop in route.stops}
    coverage_equal = base_ids == opt_ids
    if coverage_equal:
        if base_metrics.total_mileage_km > 0:
            opt_metrics.mileage_reduction_pct = round(
                (base_metrics.total_mileage_km - opt_metrics.total_mileage_km) / base_metrics.total_mileage_km * 100, 1
            )
        if base_metrics.total_engineers_used > 0:
            opt_metrics.engineers_reduction_pct = round(
                (base_metrics.total_engineers_used - opt_metrics.total_engineers_used)
                / base_metrics.total_engineers_used
                * 100,
                1,
            )

    # Lookup helpers
    eng_by_id = {e.id: e for e in engineers}
    task_by_id = {t.id: t for t in tasks}
    route_by_eng = {r.engineer_id: r for r in opt_routes}

    # Find task assignment map
    task_assignment_map = {}
    for r in opt_routes:
        for s in r.stops:
            task_assignment_map[s.task_id] = (r.engineer_id, s)

    def dump_model(m):
        return m.model_dump() if hasattr(m, "model_dump") else m.dict()

    # 4. JSON output mode
    if args.json:
        result = {
            "source": source_name,
            "tasks_count": len(tasks),
            "engineers_count": len(engineers),
            "baseline_metrics": dump_model(base_metrics),
            "optimized_metrics": dump_model(opt_metrics),
            "routes": [dump_model(r) for r in opt_routes],
            "unassigned_tasks": [dump_model(u) for u in opt_unassigned],
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    # 5. Human-readable CLI Output
    sep = "=" * 74
    subsep = "-" * 74

    print(sep)
    print("  🐝 БИЛАЙН БИЗНЕС — ТЕСТОВЫЙ РЕЖИМ ОПТИМИЗАЦИИ РАСПИСАНИЙ (VRPTW CLI)")
    print(f"  Источник: {source_name} | Заявок: {len(tasks)} | Инженеров: {len(engineers)}")
    print(sep)

    print("\n📊 1. СРАВНЕНИЕ МЕТРИК: БАЗОВЫЙ ПЛАН (FIFO) VS ОПТИМИЗИРОВАННЫЙ (VRPTW)")
    print(subsep)
    print(f"  {'Метрика':<32} | {'Базовый (FIFO)':<18} | {'VRPTW Оптимизация':<18}")
    print(subsep)
    base_travel_min = sum(r.total_travel_min for r in base_routes)
    opt_travel_min = sum(r.total_travel_min for r in opt_routes)

    print(
        f"  {'Задействовано инженеров':<32} | {base_metrics.total_engineers_used:<18} | {opt_metrics.total_engineers_used:<18}"
    )
    print(
        f"  {'Суммарный пробег (км)':<32} | {base_metrics.total_mileage_km:<18.1f} | {opt_metrics.total_mileage_km:<18.1f}"
    )
    print(
        f"  {'Не назначено аварий':<32} | {base_metrics.unassigned_emergencies:<18} | {opt_metrics.unassigned_emergencies:<18}"
    )
    print(
        f"  {'Не назначено подключений':<32} | {base_metrics.unassigned_connections:<18} | {opt_metrics.unassigned_connections:<18}"
    )
    if not coverage_equal:
        print("  Проценты экономии не рассчитываются: планы обслужили разный набор заявок.")
    print(f"  {'Время в пути (мин)':<32} | {base_travel_min:<18} | {opt_travel_min:<18}")
    print(
        f"  {'Назначено заявок':<32} | {base_metrics.assigned_tasks_count:<18} | {opt_metrics.assigned_tasks_count:<18} ({round(opt_metrics.assigned_tasks_count / len(tasks) * 100, 1)}% от общего)"
    )
    print(
        f"  {'Не назначено заявок':<32} | {base_metrics.unassigned_tasks_count:<18} | {opt_metrics.unassigned_tasks_count:<18}"
    )
    print(subsep)

    # 6. Engineer Routing Summary
    print("\n👷 2. МАРШРУТНЫЕ ЛИСТЫ И СТАТУСЫ ИНЖЕНЕРОВ")
    print(subsep)
    print(f"  {'Инженер':<24} | {'Транспорт':<12} | {'Заявок':<8} | {'Пробег (км)':<12} | {'Статус/Тег':<14}")
    print(subsep)

    active_engineers = []
    idle_engineers = []

    for eng in engineers:
        route = route_by_eng.get(eng.id)
        stops_cnt = len(route.stops) if route else 0
        dist_km = route.total_distance_km if route else 0.0

        if stops_cnt > 0:
            active_engineers.append(eng)
            tag = "⚡ АКТИВЕН"
        else:
            idle_engineers.append(eng)
            tag = "💤 В РЕЗЕРВЕ"

        print(f"  {eng.name:<24} | {eng.transport_type:<12} | {stops_cnt:<8} | {dist_km:<12.1f} | {tag:<14}")

    print(subsep)
    print(f"  Итого активно бригад: {len(active_engineers)} | В оперативном резерве: {len(idle_engineers)}")

    # 7. Unassigned Tasks & Diagnostic Tags
    print(f"\n⚠️  3. ПРОБЛЕМНЫЕ / НЕ НАЗНАЧЕННЫЕ ЗАЯВКИ ({len(opt_unassigned)} шт.)")
    print(subsep)
    if opt_unassigned:
        print(f"  {'ID':<8} | {'Приоритет':<10} | {'Требуемый навык':<22} | {'Диагностика / Теги'}")
        print(subsep)
        for u in opt_unassigned:
            t = task_by_id.get(u.task_id)
            if t:
                tags = diagnose_unassigned_task(t, engineers)
                tags_str = ", ".join(tags)
                print(f"  #{u.task_id:<7} | {t.priority:<10} | {t.required_skill:<22} | [{tags_str}] {u.reason}")
    else:
        print("  🎉 Все заявки успешно распределены! Нет проблемных задач.")
    print(subsep)

    # 8. Explainable AI (XAI) Generation
    print("\n🤖 4. ГЕНЕРАЦИЯ ОБЪЯСНЕНИЙ ИИ (EXPLAINABLE AI)")
    print(subsep)

    # If specific task explanation requested
    if args.explain_task:
        tid = args.explain_task.replace("#", "")
        if tid in task_assignment_map:
            eng_id, stop = task_assignment_map[tid]
            eng = eng_by_id[eng_id]
            t = task_by_id[tid]
            context = {
                "type": "task",
                "engineer_name": eng.name,
                "address": t.address,
                "required_skill": t.required_skill,
                "transport_type": eng.transport_type,
                "arrival_time": stop.arrival_time,
                "window": f"{t.window_start} - {t.window_end}",
                "travel_km": stop.travel_km,
                "travel_min": stop.travel_min,
                "total_tasks_count": len(tasks),
                "total_engineers_count": len(engineers),
                "active_engineers_count": len(active_engineers),
            }
            exp = generate_explanation(tid, eng_id, context)
            print(f"[ОБЪЯСНЕНИЕ ДЛЯ ЗАЯВКИ #{tid}]\n")
            print(exp)
        elif tid in [u.task_id for u in opt_unassigned]:
            t = task_by_id.get(tid)
            print(f"[ОБЪЯСНЕНИЕ ДЛЯ НЕ НАЗНАЧЕННОЙ ЗАЯВКИ #{tid}]\n")
            print(f"Заявка #{tid} по адресу '{t.address if t else 'н/д'}' не может быть назначена:")
            tags = diagnose_unassigned_task(t, engineers) if t else []
            print(f"1. Выявленные ограничения: {', '.join(tags)}")
            print("2. Доступные инженеры сектора не имеют окна в смене либо профильного навыка.")
        else:
            print(f"[ПРЕДУПРЕЖДЕНИЕ] Заявка #{tid} не найдена в текущем наборе данных.")

    # If specific engineer explanation requested
    elif args.explain_engineer:
        eid = args.explain_engineer
        eng = eng_by_id.get(eid)
        if not eng:
            print(f"[ПРЕДУПРЕЖДЕНИЕ] Инженер {eid} не найден.")
        else:
            route = route_by_eng.get(eid)
            stops_cnt = len(route.stops) if route else 0
            if stops_cnt > 0:
                context = {
                    "type": "engineer_route",
                    "engineer_name": eng.name,
                    "transport_type": eng.transport_type,
                    "shift": f"{eng.shift_start} - {eng.shift_end}",
                    "stops_count": stops_cnt,
                    "total_travel_km": route.total_distance_km,
                    "total_travel_min": route.total_travel_min,
                    "first_start": route.stops[0].start_time,
                    "last_end": route.stops[-1].end_time,
                    "skills": eng.skills,
                }
                exp = generate_explanation(eid, eid, context)
            else:
                context = {
                    "type": "engineer_idle",
                    "is_idle": True,
                    "engineer_name": eng.name,
                    "transport_type": eng.transport_type,
                    "shift": f"{eng.shift_start} - {eng.shift_end}",
                    "skills": eng.skills,
                }
                exp = generate_explanation(f"eng_idle_{eid}", eid, context)
            print(f"[ОБЪЯСНЕНИЕ ДЛЯ ИНЖЕНЕРА {eng.name} ({eid})]\n")
            print(exp)

    # If explain-all or sample requested
    elif args.explain_all:
        print("[РЕЖИМ ВСЕХ ОБОСНОВАНИЙ]")
        if idle_engineers:
            print("\n--- Обоснования оперативного резерва ---")
            for eng in idle_engineers:
                context = {
                    "type": "engineer_idle",
                    "is_idle": True,
                    "engineer_name": eng.name,
                    "transport_type": eng.transport_type,
                    "shift": f"{eng.shift_start} - {eng.shift_end}",
                    "skills": eng.skills,
                }
                print(generate_explanation(f"eng_idle_{eng.id}", eng.id, context))
                print()
    else:
        # Provide sample XAI explanations automatically
        print(
            "  (Для генерации обоснования по конкретному объекту используйте: --explain-task <id> или --explain-engineer <id>)"
        )
        if active_engineers:
            sample_eng = active_engineers[0]
            sample_route = route_by_eng[sample_eng.id]
            if sample_route.stops:
                sample_stop = sample_route.stops[0]
                sample_task = task_by_id[sample_stop.task_id]
                ctx = {
                    "type": "task",
                    "engineer_name": sample_eng.name,
                    "address": sample_task.address,
                    "required_skill": sample_task.required_skill,
                    "transport_type": sample_eng.transport_type,
                    "arrival_time": sample_stop.arrival_time,
                    "window": f"{sample_task.window_start} - {sample_task.window_end}",
                    "travel_km": sample_stop.travel_km,
                    "travel_min": sample_stop.travel_min,
                    "total_tasks_count": len(tasks),
                    "total_engineers_count": len(engineers),
                    "active_engineers_count": len(active_engineers),
                }
                print("\n  [ПРИМЕР 1: Обоснование назначения заявки]")
                print("  " + "\n  ".join(generate_explanation(sample_stop.task_id, sample_eng.id, ctx).splitlines()))

        if idle_engineers:
            sample_idle = idle_engineers[0]
            ctx_idle = {
                "type": "engineer_idle",
                "is_idle": True,
                "engineer_name": sample_idle.name,
                "transport_type": sample_idle.transport_type,
                "shift": f"{sample_idle.shift_start} - {sample_idle.shift_end}",
                "skills": sample_idle.skills,
                "total_tasks_count": len(tasks),
                "total_engineers_count": len(engineers),
                "active_engineers_count": len(active_engineers),
            }
            print("\n  [ПРИМЕР 2: Обоснование оперативного резерва специалиста]")
            print(
                "  "
                + "\n  ".join(generate_explanation(f"eng_idle_{sample_idle.id}", sample_idle.id, ctx_idle).splitlines())
            )

    print("\n" + sep)
    print("  ✅ Тестовый запуск алгоритма успешно завершен (100% Offline)")
    print(sep)


if __name__ == "__main__":
    run_cli()
