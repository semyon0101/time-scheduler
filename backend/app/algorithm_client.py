import os
import httpx
from typing import Dict, Any, List

ALGORITHM_SERVICE_URL = os.getenv("ALGORITHM_SERVICE_URL", "http://localhost:8001")

async def call_optimize(engineers: List[Dict[str, Any]], tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
    url = f"{ALGORITHM_SERVICE_URL}/api/v1/optimize"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json={"engineers": engineers, "tasks": tasks})
        resp.raise_for_status()
        return resp.json()

async def call_replan(
    current_schedule: List[Dict[str, Any]],
    engineers: List[Dict[str, Any]],
    events: List[Dict[str, Any]]
) -> Dict[str, Any]:
    url = f"{ALGORITHM_SERVICE_URL}/api/v1/replan"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json={
            "current_schedule": current_schedule,
            "engineers": engineers,
            "events": events
        })
        resp.raise_for_status()
        return resp.json()

async def call_explain(task_id: str, assigned_engineer_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{ALGORITHM_SERVICE_URL}/api/v1/explain"
    # Long timeout because LLM sleep(3) takes at least 3 seconds
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(url, json={
            "task_id": task_id,
            "assigned_engineer_id": assigned_engineer_id,
            "context": context
        })
        resp.raise_for_status()
        return resp.json()
