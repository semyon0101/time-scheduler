"""Прогон солвера на синтетических CSV из «Обезличивание»."""

import time
import unittest

from backend.Services.routing.dataset import SYNTHETIC_FILES, load_synthetic_request
from backend.Services.routing.solver import solve_engineer_route


class SyntheticCsvTests(unittest.TestCase):
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
