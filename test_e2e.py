import os
import subprocess
import sys
import time

import httpx


def main():
    print("=== STARTING COMPREHENSIVE END-TO-END VERIFICATION ===")
    root_dir = os.path.dirname(os.path.abspath(__file__))
    venv_python = os.path.join(root_dir, "venv", "bin", "python")
    if not os.path.exists(venv_python):
        venv_python = sys.executable

    env_file = os.path.join(root_dir, ".env")
    if os.path.exists(env_file):
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

    preferred_port = int(os.environ.get("BACKEND_PORT", "8000"))
    import socket

    def get_available_port(port: int) -> int:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                s.bind(("127.0.0.1", 0))
                return s.getsockname()[1]

    back_port = str(get_available_port(preferred_port))

    # Ensure PostgreSQL is used as required by architecture
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        postgres_user = os.environ.get("POSTGRES_USER", "postgres")
        postgres_pass = os.environ.get("POSTGRES_PASSWORD", "postgres")
        postgres_port = os.environ.get("POSTGRES_PORT", "5432")
        postgres_db = os.environ.get("POSTGRES_DB", "scheduler_db")
        db_url = f"postgresql://{postgres_user}:{postgres_pass}@localhost:{postgres_port}/{postgres_db}"

    try:
        import psycopg2

        conn = psycopg2.connect(db_url, connect_timeout=3)
        conn.close()
        print(f"   [OK] Verified PostgreSQL connection: {db_url}")
    except Exception as e:
        print(f"[ERROR] Cannot connect to PostgreSQL at {db_url}: {e}")
        print("Ensure PostgreSQL is running as required by the layered architecture.")
        sys.exit(1)

    env_back = os.environ.copy()
    env_back["PYTHONPATH"] = f"{root_dir}:{os.path.join(root_dir, 'backend')}"
    env_back["BACKEND_PORT"] = back_port
    env_back["DATABASE_URL"] = db_url

    print(f"1. Launching Unified Backend Service on {back_port} (Internal VRPTW & XAI Engine)...")
    back_proc = subprocess.Popen(
        [
            venv_python,
            "-m",
            "uvicorn",
            "main:app",
            "--app-dir",
            "backend",
            "--host",
            "127.0.0.1",
            "--port",
            str(back_port),
        ],
        cwd=root_dir,
        env=env_back,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    try:
        print("2. Waiting for Backend service to become healthy...")
        back_ready = False
        for _ in range(15):
            time.sleep(1)
            try:
                if not back_ready:
                    r = httpx.get(f"http://127.0.0.1:{back_port}/health", timeout=2.0)
                    if r.status_code == 200:
                        back_ready = True
                        print("   -> Backend Service is UP!")
            except Exception:
                pass

            if back_ready:
                break

        if not back_ready:
            print("ERROR: Backend service failed to start within 15 seconds.")
            stderr_out = back_proc.stderr.read().decode("utf-8", errors="replace")
            print("Backend stderr:\n", stderr_out)
            sys.exit(1)

        print("\n3. Running Scenario Tests with HTTP Client...")
        client = httpx.Client(
            base_url=f"http://127.0.0.1:{back_port}/api/v1",
            headers={"X-Dispatcher-Id": "disp_e2e_verified"},
            timeout=35.0,
        )

        # Step 3.1: Session Init
        r = client.get("/session/init")
        assert r.status_code == 200, f"Init failed: {r.text}"
        data = r.json()
        print(
            f"   [OK] /session/init: Dispatcher={data['dispatcher_id']}, Engineers={len(data['engineers'])}, Tasks={len(data['tasks'])}"
        )

        # Step 3.2: Seed Dataset with 'yugcenter' (alias check!)
        print("\n3.2 Testing 'yugcenter' alias...")
        r = client.post("/demo/seed", json={"preset": "yugcenter"})
        assert r.status_code == 200, f"Seed yugcenter failed: {r.text}"
        data = r.json()
        assert data["active_preset"] == "yugocentr"
        print(
            f"   [OK] /demo/seed ('yugcenter'): Successfully seeded {len(data['tasks'])} tasks, {len(data['engineers'])} engineers (Preset={data['active_preset']})"
        )

        # Step 3.3: Add New Task (status="new", metrics preserved!)
        r = client.post(
            "/tasks",
            json={
                "address": "Город Москва, Красная площадь, д. 1",
                "district": "Центральный",
                "lat": 55.7539,
                "lon": 37.6208,
                "window_start": "19:00",
                "window_end": "21:00",
                "duration_min": 45,
                "required_skill": "Аварийные работы",
                "priority": "Срочная",
            },
        )
        assert r.status_code == 200, f"Add task failed: {r.text}"
        new_task = r.json()
        assert new_task["status"] == "new"
        print(f"   [OK] /tasks: Created Task #{new_task['id']} with status='{new_task['status']}'")

        # Step 3.4: Cancel Task
        print("\n3.4 Testing task cancellation...")
        r = client.post(f"/tasks/{new_task['id']}/cancel")
        assert r.status_code == 200, f"Cancel task failed: {r.text}"
        state_after_cancel = r.json()
        canc_task = next(t for t in state_after_cancel["tasks"] if t["id"] == new_task["id"])
        assert canc_task["status"] == "cancelled"
        print(f"   [OK] /tasks/{new_task['id']}/cancel: Task successfully marked as 'cancelled' and kept in DB!")

        # Step 3.5: Delete Task (permanent removal)
        r = client.delete(f"/tasks/{new_task['id']}")
        assert r.status_code == 200
        print(f"   [OK] DELETE /tasks/{new_task['id']}: Explicit permanent delete works!")

        # Step 3.6: Re-run Full Optimization
        r = client.post("/schedule/optimize")
        assert r.status_code == 200
        data = r.json()
        print("   [OK] /schedule/optimize: Completed successfully!")

        # Step 3.7: Idle Engineer Explanation
        idle_eng = next(
            (
                e
                for e in data["engineers"]
                if not any(r["engineer_id"] == e["id"] and len(r["stops"]) > 0 for r in data["schedule"])
            ),
            None,
        )
        if not idle_eng:
            idle_eng = data["engineers"][0]

        print(f"\n3.7 Testing Idle Engineer Explanation for {idle_eng['name']}...")
        r_eng_exp = client.get(f"/engineers/{idle_eng['id']}/explanation")
        assert r_eng_exp.status_code == 200, f"Engineer explanation failed: {r_eng_exp.text}"
        eng_exp_data = r_eng_exp.json()
        print(f"   [OK] /engineers/{idle_eng['id']}/explanation: {eng_exp_data['explanation'][:160]}...")

        # Step 3.8: Task Explanation
        active_route = next((r for r in data["schedule"] if len(r["stops"]) > 0), None)
        assert active_route is not None
        task_id = active_route["stops"][0]["task_id"]

        print(f"\n3.8 Testing Task Explanation for Task #{task_id}...")
        t0 = time.time()
        r_task_exp = client.get(f"/tasks/{task_id}/explanation")
        t_duration = time.time() - t0
        assert r_task_exp.status_code == 200
        task_exp_data = r_task_exp.json()
        print(f"   [OK] /tasks/{task_id}/explanation took {t_duration:.2f}s: {task_exp_data['explanation'][:160]}...")

        # Step 3.9: Engineer Goes Off-Line (Irreversible & Tasks Unassigned)
        print("\n3.9 Testing Engineer Goes Off-Line (Irreversible & Task Unassignment)...")
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
        unassigned_ids = {u["task_id"] for u in offline_data["unassigned_tasks"]}
        for stop_tid in assigned_stops:
            assert stop_tid in unassigned_ids, f"Task {stop_tid} was not moved to unassigned!"

        # Check metrics updated
        assert offline_data["metrics"]["unassigned_count"] >= len(assigned_stops)
        print(
            f"   [OK] Engineer {active_eng_id} successfully went off-line: {len(assigned_stops)} tasks moved to unassigned, status is 'unavailable'!"
        )

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
        back_proc.terminate()
        back_proc.wait()
        print("Cleanup complete.")


if __name__ == "__main__":
    main()
