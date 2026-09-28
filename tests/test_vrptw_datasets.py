"""Прогон солвера на синтетических CSV из «Обезличивание»."""

import json
import time
import unittest
from pathlib import Path

from backend.Services.routing.dataset import PRESET_CSV, SYNTHETIC_FILES, enrich_preset_data, load_synthetic_request
from backend.Services.routing.solver import solve_engineer_route


class SyntheticCsvTests(unittest.TestCase):
    def test_preset_categories_come_from_csv_and_areas_are_explicit(self) -> None:
        root = Path(__file__).resolve().parents[1]
        for preset in PRESET_CSV:
            with self.subTest(preset=preset):
                data = enrich_preset_data(json.loads((root / "data" / f"{preset}.json").read_text()), preset)
                numeric_tasks = [task for task in data["tasks"] if task["id"].isdigit()]
                self.assertTrue(all(task["category"] != "other" for task in numeric_tasks))
                self.assertTrue(all(task["area_id"] == preset for task in data["tasks"]))
                self.assertTrue(all(engineer["is_on_duty"] for engineer in data["engineers"]))
                self.assertTrue(all(task.get("created_at") is None for task in data["tasks"]))

    def test_each_region_builds_route(self) -> None:
        for name in SYNTHETIC_FILES:
            with self.subTest(file=name):
                request = load_synthetic_request(name)
                self.assertGreaterEqual(len(request.tasks), 50)
                started = time.perf_counter()
                result = solve_engineer_route(request)
                elapsed = time.perf_counter() - started
                self.assertEqual(result.engineer_id, name)
                self.assertGreater(result.assigned_count, 0)
                self.assertGreater(result.total_distance_km, 0)
                self.assertEqual(
                    result.assigned_count + len(result.unassigned),
                    len(request.tasks),
                )
                ids = [s.task_id for s in result.stops]
                self.assertEqual(len(ids), len(set(ids)))
                print(
                    f"{name}: tasks={len(request.tasks)} "
                    f"assigned={result.assigned_count} "
                    f"km={result.total_distance_km} "
                    f"sec={elapsed:.2f}"
                )


if __name__ == "__main__":
    unittest.main(verbosity=2)
