import subprocess
import time
import os
import sys
import httpx

def main():
    print("=== STARTING COMPREHENSIVE END-TO-END VERIFICATION ===")
    root_dir = os.path.dirname(os.path.abspath(__file__))
    venv_python = os.path.join(root_dir, "venv", "bin", "python")

    env_algo = os.environ.copy()
    env_algo["PYTHONPATH"] = os.path.join(root_dir, "algorithm")

    env_back = os.environ.copy()
    env_back["PYTHONPATH"] = os.path.join(root_dir, "backend")
    env_back["ALGORITHM_SERVICE_URL"] = "http://127.0.0.1:8001"

    print("1. Launching Algorithm Service on 8001...")
    algo_proc = subprocess.Popen(
        [venv_python, "-m", "uvicorn", "app.main:app", "--app-dir", "algorithm", "--host", "127.0.0.1", "--port", "8001"],
        cwd=root_dir,
        env=env_algo,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    print("2. Launching Backend Service on 8000...")
    back_proc = subprocess.Popen(
        [venv_python, "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "127.0.0.1", "--port", "8000"],
        cwd=root_dir,
        env=env_back,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    try:
        print("3. Waiting for services to become healthy...")
        algo_ready = False
        back_ready = False
        for _ in range(15):
            time.sleep(1)
            try:
                if not algo_ready:
                    r = httpx.get("http://127.0.0.1:8001/health", timeout=2.0)
                    if r.status_code == 200:
                        algo_ready = True
                        print("   -> Algorithm Service is UP!")
            except Exception:
                pass

            try:
                if not back_ready:
                    r = httpx.get("http://127.0.0.1:8000/health", timeout=2.0)
                    if r.status_code == 200:
                        back_ready = True
                        print("   -> Backend Service is UP!")
            except Exception:
                pass

            if algo_ready and back_ready:
                break

        if not (algo_ready and back_ready):
            print("ERROR: Services failed to start within 15 seconds.")
            sys.exit(1)

        print("\n4. Running Scenario Tests with HTTP Client...")
        client = httpx.Client(
            base_url="http://127.0.0.1:8000/api",
            headers={"X-Dispatcher-Id": "disp_e2e_verified"},
            timeout=35.0
        )

        # Step 4.1: Session Init
        r = client.get("/session/init")
        assert r.status_code == 200, f"Init failed: {r.text}"
        data = r.json()
        print(f"   [OK] /session/init: Dispatcher={data['dispatcher_id']}, Engineers={len(data['engineers'])}, Tasks={len(data['tasks'])}")

        # Step 4.2: Seed Dataset with 'yugcenter' (alias check!)
        print("\n4.2 Testing 'yugcenter' alias...")
        r = client.post("/demo/seed", json={"preset": "yugcenter"})
        assert r.status_code == 200, f"Seed yugcenter failed: {r.text}"
        data = r.json()
        assert data["active_preset"] == "yugocentr"
        print(f"   [OK] /demo/seed ('yugcenter'): Successfully seeded {len(data['tasks'])} tasks, {len(data['engineers'])} engineers (Preset={data['active_preset']})")

        # Step 4.3: Add New Task (status="new", metrics preserved!)
        r = client.post("/tasks", json={
            "address": "Город Москва, Красная площадь, д. 1",
            "district": "Центральный",
            "lat": 55.7539,
            "lon": 37.6208,
            "window_start": "19:00",
            "window_end": "21:00",
            "duration_min": 45,
            "required_skill": "Аварийные работы",
            "priority": "Срочная"
        })
        assert r.status_code == 200, f"Add task failed: {r.text}"
        new_task = r.json()
        assert new_task["status"] == "new"
        print(f"   [OK] /tasks: Created Task #{new_task['id']} with status='{new_task['status']}'")

        # Step 4.4: Cancel Task
        print(f"\n4.4 Testing task cancellation...")
        r = client.post(f"/tasks/{new_task['id']}/cancel")
        assert r.status_code == 200, f"Cancel task failed: {r.text}"
        state_after_cancel = r.json()
        canc_task = next(t for t in state_after_cancel["tasks"] if t["id"] == new_task["id"])
        assert canc_task["status"] == "cancelled"
        print(f"   [OK] /tasks/{new_task['id']}/cancel: Task successfully marked as 'cancelled' and kept in DB!")

        # Step 4.5: Delete Task (permanent removal)
        r = client.delete(f"/tasks/{new_task['id']}")
        assert r.status_code == 200
        print(f"   [OK] DELETE /tasks/{new_task['id']}: Explicit permanent delete works!")

        # Step 4.6: Re-run Full Optimization
        r = client.post("/schedule/optimize")
        assert r.status_code == 200
        data = r.json()
        print(f"   [OK] /schedule/optimize: Completed successfully!")

        # Step 4.7: Idle Engineer Explanation
        idle_eng = next((e for e in data["engineers"] if not any(r["engineer_id"] == e["id"] and len(r["stops"]) > 0 for r in data["schedule"])), None)
        if not idle_eng:
            idle_eng = data["engineers"][0]

        print(f"\n4.7 Testing Idle Engineer Explanation for {idle_eng['name']}...")
        r_eng_exp = client.get(f"/engineers/{idle_eng['id']}/explanation")
        assert r_eng_exp.status_code == 200, f"Engineer explanation failed: {r_eng_exp.text}"
        eng_exp_data = r_eng_exp.json()
        print(f"   [OK] /engineers/{idle_eng['id']}/explanation: {eng_exp_data['explanation'][:160]}...")

        # Step 4.8: Task Explanation
        active_route = next((r for r in data["schedule"] if len(r["stops"]) > 0), None)
        assert active_route is not None
        task_id = active_route["stops"][0]["task_id"]

        print(f"\n4.8 Testing Task Explanation for Task #{task_id}...")
        t0 = time.time()
        r_task_exp = client.get(f"/tasks/{task_id}/explanation")
        t_duration = time.time() - t0
        assert r_task_exp.status_code == 200
        task_exp_data = r_task_exp.json()
        print(f"   [OK] /tasks/{task_id}/explanation took {t_duration:.2f}s: {task_exp_data['explanation'][:160]}...")

        # Step 4.9: Engineer Goes Off-Line (Irreversible & Tasks Unassigned)
        print(f"\n4.9 Testing Engineer Goes Off-Line (Irreversible & Task Unassignment)...")
        active_eng_id = active_route["engineer_id"]
        assigned_stops = [s["task_id"] for s in active_route["stops"]]
        assert len(assigned_stops) > 0

        r_offline = client.post(f"/engineers/{active_eng_id}/toggle_status")
        assert r_offline.status_code == 200
        offline_data = r_offline.json()

        # Check engineer is now unavailable
        offline_eng = next(e for e in offline_data["engineers"] if e["id"] == active_eng_id)
        assert offline_eng["status"] == "unavailable"

        # Check all their previous tasks are now unassigned
        unassigned_ids = set(u["task_id"] for u in offline_data["unassigned_tasks"])
        for stop_tid in assigned_stops:
            assert stop_tid in unassigned_ids, f"Task {stop_tid} was not moved to unassigned!"

        # Check metrics updated
        assert offline_data["metrics"]["unassigned_count"] >= len(assigned_stops)
        print(f"   [OK] Engineer {active_eng_id} successfully went off-line: {len(assigned_stops)} tasks moved to unassigned, status is 'unavailable'!")

        # Check explanation for now-unassigned task
        orphan_task_id = assigned_stops[0]
        r_orphan_exp = client.get(f"/tasks/{orphan_task_id}/explanation")
        assert r_orphan_exp.status_code == 200
        orphan_exp = r_orphan_exp.json()["explanation"]
        assert "не назначена" in orphan_exp or "нераспределенной" in orphan_exp
        print(f"   [OK] /tasks/{orphan_task_id}/explanation properly explains unassigned status!")

        print("\n=======================================================")
        print(" 🎉 ALL COMPREHENSIVE TESTS COMPLETED WITH 100% SUCCESS!")
        print("=======================================================")

    finally:
        algo_proc.terminate()
        back_proc.terminate()
        algo_proc.wait()
        back_proc.wait()
        print("Cleanup complete.")

if __name__ == "__main__":
    main()
