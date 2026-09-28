from fastapi.testclient import TestClient


def test_health_check(client: TestClient):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

    r_v1 = client.get("/api/v1/health")
    assert r_v1.status_code == 200


def test_session_endpoints(client: TestClient):
    headers = {"X-Dispatcher-Id": "disp_ctrl_test"}

    # 1. Init session
    r = client.get("/api/v1/session/init", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["dispatcher_id"] == "disp_ctrl_test"
    assert len(data["engineers"]) > 0

    # 2. Get state
    r_state = client.get("/api/v1/state", headers=headers)
    assert r_state.status_code == 200
    assert r_state.json()["dispatcher_id"] == "disp_ctrl_test"

    # 3. Seed dataset
    r_seed = client.post("/api/v1/demo/seed", json={"preset": "yugcenter"}, headers=headers)
    assert r_seed.status_code == 200
    seed_data = r_seed.json()
    assert seed_data["active_preset"] == "yugocentr"

    # 4. Reset session
    r_reset = client.post("/api/v1/session/reset", headers=headers)
    assert r_reset.status_code == 200
    assert len(r_reset.json()["tasks"]) == 0


def test_engineer_endpoints(client: TestClient):
    headers = {"X-Dispatcher-Id": "disp_ctrl_eng"}

    # Ensure dispatcher exists
    client.get("/api/v1/session/init", headers=headers)

    # 1. Create engineer
    eng_payload = {
        "name": "Тестовый Инженер",
        "start_lat": 55.75,
        "start_lon": 37.61,
        "skills": ["Тест"],
        "is_on_duty": False,
    }
    r_create = client.post("/api/v1/engineers", json=eng_payload, headers=headers)
    assert r_create.status_code == 200
    eng_data = r_create.json()
    eng_id = eng_data["id"]
    assert eng_data["status"] == "new"
    assert eng_data["area_id"] == "vostok"
    assert eng_data["is_on_duty"] is False

    # 2. Explanation
    r_exp = client.get(f"/api/v1/engineers/{eng_id}/explanation", headers=headers)
    assert r_exp.status_code == 200
    assert r_exp.json()["assigned_engineer_id"] == eng_id

    # 3. Toggle status
    r_toggle = client.post(f"/api/v1/engineers/{eng_id}/toggle_status", headers=headers)
    assert r_toggle.status_code == 200
    state = r_toggle.json()
    toggled = next(e for e in state["engineers"] if e["id"] == eng_id)
    assert toggled["status"] == "unavailable"

    # 4. Delete engineer
    r_del = client.delete(f"/api/v1/engineers/{eng_id}", headers=headers)
    assert r_del.status_code == 200
    assert r_del.json()["status"] == "ok"


def test_task_endpoints(client: TestClient):
    headers = {"X-Dispatcher-Id": "disp_ctrl_task"}

    # Ensure dispatcher exists
    client.get("/api/v1/session/init", headers=headers)

    # 1. Create task
    task_payload = {
        "address": "ул. Пушкина, д. 10",
        "lat": 55.76,
        "lon": 37.60,
        "priority": "Срочная",
        "category": "emergency",
    }
    r_create = client.post("/api/v1/tasks", json=task_payload, headers=headers)
    assert r_create.status_code == 200
    task_data = r_create.json()
    task_id = task_data["id"]
    assert task_data["status"] == "new"
    assert task_data["category"] == "emergency"
    assert task_data["area_id"] == "vostok"
    assert task_data["created_at"] is not None

    # 2. Explanation
    r_exp = client.get(f"/api/v1/tasks/{task_id}/explanation", headers=headers)
    assert r_exp.status_code == 200
    assert r_exp.json()["task_id"] == task_id

    # 3. Cancel task
    r_cancel = client.post(f"/api/v1/tasks/{task_id}/cancel", headers=headers)
    assert r_cancel.status_code == 200
    state = r_cancel.json()
    cancelled = next(t for t in state["tasks"] if t["id"] == task_id)
    assert cancelled["status"] == "cancelled"

    # 4. Delete task
    r_del = client.delete(f"/api/v1/tasks/{task_id}", headers=headers)
    assert r_del.status_code == 200
    assert r_del.json()["status"] == "ok"


def test_invalid_task_window_is_rejected_for_creation_and_events(client: TestClient):
    headers = {"X-Dispatcher-Id": "disp_invalid_window"}
    before = len(client.get("/api/v1/session/init", headers=headers).json()["tasks"])
    task = {
        "id": "task_invalid_window",
        "address": "Москва",
        "lat": 55.75,
        "lon": 37.61,
        "window_start": "16:00",
        "window_end": "12:00",
    }

    assert client.post("/api/v1/tasks", json=task, headers=headers).status_code == 422
    assert (
        client.post(
            "/api/v1/schedule/replan",
            json={"events": [{"event_type": "URGENT_TASK", "task": task}]},
            headers=headers,
        ).status_code
        == 422
    )
    assert len(client.get("/api/v1/state", headers=headers).json()["tasks"]) == before

    task["window_end"] = "18:00"
    assert client.post("/api/v1/tasks", json=task, headers=headers).status_code == 200


def test_schedule_endpoints(client: TestClient):
    headers = {"X-Dispatcher-Id": "disp_ctrl_sched"}

    client.get("/api/v1/session/init", headers=headers)

    # 1. Optimize
    r_opt = client.post("/api/v1/schedule/optimize", headers=headers)
    assert r_opt.status_code == 200
    data = r_opt.json()
    assert len(data["schedule"]) > 0

    # 2. Replan
    replan_payload = {
        "events": [
            {
                "event_type": "URGENT_TASK",
                "task": {
                    "address": "Срочный адрес",
                    "lat": 55.77,
                    "lon": 37.62,
                    "priority": "Срочная",
                },
            }
        ]
    }
    r_replan = client.post("/api/v1/schedule/replan", json=replan_payload, headers=headers)
    assert r_replan.status_code == 200
