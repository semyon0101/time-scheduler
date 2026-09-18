"""
Beeline Business FSM Dispatcher - End-to-End Workflow Test Suite

Validates the full operational dispatcher lifecycle:
- Session initialization & dataset seeding
- Dynamic task creation & cancellation
- Route optimization & rescheduling
- Multi-criteria XAI explanations
- Engineer off-line failover handling
"""

from fastapi.testclient import TestClient


def test_e2e_full_dispatcher_workflow(client: TestClient):
    headers = {"X-Dispatcher-Id": "disp_e2e_prod_suite"}

    # 1. Session Init
    r_init = client.get("/api/v1/session/init", headers=headers)
    assert r_init.status_code == 200, f"Init failed: {r_init.text}"
    init_data = r_init.json()
    assert init_data["dispatcher_id"] == "disp_e2e_prod_suite"
    assert len(init_data["engineers"]) > 0
    assert len(init_data["tasks"]) > 0

    # 2. Seed Dataset with 'yugcenter' (alias check!)
    r_seed = client.post("/api/v1/demo/seed", json={"preset": "yugcenter"}, headers=headers)
    assert r_seed.status_code == 200, f"Seed failed: {r_seed.text}"
    seed_data = r_seed.json()
    assert seed_data["active_preset"] in ("yugocentr", "yugcenter_syn")
    assert len(seed_data["engineers"]) > 0
    assert len(seed_data["tasks"]) > 0

    # 3. Add New Task (status="new")
    r_new_task = client.post(
        "/api/v1/tasks",
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
        headers=headers,
    )
    assert r_new_task.status_code == 200, f"Add task failed: {r_new_task.text}"
    new_task = r_new_task.json()
    assert new_task["status"] == "new"
    new_task_id = new_task["id"]

    # 4. Cancel Task
    r_cancel = client.post(f"/api/v1/tasks/{new_task_id}/cancel", headers=headers)
    assert r_cancel.status_code == 200, f"Cancel task failed: {r_cancel.text}"
    state_after_cancel = r_cancel.json()
    canc_task = next((t for t in state_after_cancel["tasks"] if t["id"] == new_task_id), None)
    assert canc_task is not None
    assert canc_task["status"] == "cancelled"

    # 5. Delete Task
    r_del = client.delete(f"/api/v1/tasks/{new_task_id}", headers=headers)
    assert r_del.status_code == 200

    # 6. Re-run Full Optimization
    r_opt = client.post("/api/v1/schedule/optimize", headers=headers)
    assert r_opt.status_code == 200
    opt_data = r_opt.json()
    assert len(opt_data["schedule"]) > 0

    # 7. Idle Engineer Explanation
    idle_eng = next(
        (
            e
            for e in opt_data["engineers"]
            if not any(r["engineer_id"] == e["id"] and len(r["stops"]) > 0 for r in opt_data["schedule"])
        ),
        None,
    )
    if not idle_eng:
        idle_eng = opt_data["engineers"][0]

    r_eng_exp = client.get(f"/api/v1/engineers/{idle_eng['id']}/explanation", headers=headers)
    assert r_eng_exp.status_code == 200
    assert len(r_eng_exp.json()["explanation"]) > 0

    # 8. Task Explanation
    active_route = next((r for r in opt_data["schedule"] if len(r["stops"]) > 0), None)
    assert active_route is not None
    task_id = active_route["stops"][0]["task_id"]

    r_task_exp = client.get(f"/api/v1/tasks/{task_id}/explanation", headers=headers)
    assert r_task_exp.status_code == 200
    assert len(r_task_exp.json()["explanation"]) > 0

    # 9. Engineer Goes Off-Line (Irreversible & Tasks Unassigned)
    active_eng_id = active_route["engineer_id"]
    assigned_stops = [s["task_id"] for s in active_route["stops"]]
    assert len(assigned_stops) > 0

    r_offline = client.post(f"/api/v1/engineers/{active_eng_id}/toggle_status", headers=headers)
    assert r_offline.status_code == 200
    offline_data = r_offline.json()

    # Step 1: engineer moves to pending_unavailable ("Изменения")
    offline_eng = next(e for e in offline_data["engineers"] if e["id"] == active_eng_id)
    assert offline_eng["status"] == "pending_unavailable"

    # Step 2: run optimization to finalize to unavailable ("Сход")
    r_opt = client.post("/api/v1/schedule/optimize", headers=headers)
    assert r_opt.status_code == 200
    final_data = r_opt.json()
    final_eng = next(e for e in final_data["engineers"] if e["id"] == active_eng_id)
    assert final_eng["status"] == "unavailable"

    # 10. Check explanation for now-unassigned task
    orphan_task_id = assigned_stops[0]
    r_orphan_exp = client.get(f"/api/v1/tasks/{orphan_task_id}/explanation", headers=headers)
    assert r_orphan_exp.status_code == 200
    orphan_exp = r_orphan_exp.json()["explanation"]
    assert len(orphan_exp) > 0
