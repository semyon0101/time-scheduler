import json
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from backend.Entities.metrics import PlanMetricsRecord
from backend.Entities.schedule import ScheduleRecord
from backend.Entities.task import Task
from backend.Models.optimization import QUALITY_METRIC_FIELDS, PlanMetrics, UnassignedTask
from backend.Models.schedule import StateResponse
from backend.Models.session import ChangeEventIn
from backend.Repository.engineer_repository import EngineerRepository
from backend.Repository.explanation_repository import ExplanationRepository
from backend.Repository.metrics_repository import MetricsRepository
from backend.Repository.replan_repository import ReplanRepository
from backend.Repository.schedule_repository import ScheduleRepository
from backend.Repository.task_repository import TaskRepository
from backend.Services.algorithm_client import (
    AlgorithmClient,
    get_default_algorithm_client,
)
from backend.Services.session_service import SessionService


def _schedule_records_from_routes(dispatcher_id: str, routes: list[dict]) -> list[ScheduleRecord]:
    return [
        ScheduleRecord(
            dispatcher_id=dispatcher_id,
            engineer_id=route["engineer_id"],
            engineer_name=route["engineer_name"],
            transport_type=route["transport_type"],
            task_id=stop["task_id"],
            task_address=stop["address"],
            district=stop.get("district", ""),
            lat=stop["lat"],
            lon=stop["lon"],
            order=stop["order"],
            arrival_time=stop["arrival_time"],
            start_time=stop["start_time"],
            end_time=stop["end_time"],
            travel_km=stop["travel_km"],
            travel_min=stop["travel_min"],
            required_skill=stop["required_skill"],
            priority=stop["priority"],
        )
        for route in routes
        for stop in route.get("stops", [])
    ]


def _current_event_timestamp() -> str:
    return datetime.now(ZoneInfo("Europe/Moscow")).isoformat(timespec="seconds")


def _event_created_at(timestamp: str) -> datetime:
    if len(timestamp) == 5 and timestamp[2] == ":":
        hours, minutes = map(int, timestamp.split(":"))
        return datetime.now(ZoneInfo("Europe/Moscow")).replace(hour=hours, minute=minutes, second=0, microsecond=0)
    moment = datetime.fromisoformat(timestamp)
    return moment if moment.tzinfo else moment.replace(tzinfo=ZoneInfo("Europe/Moscow"))


class ScheduleService:
    def __init__(
        self,
        engineer_repo: EngineerRepository,
        task_repo: TaskRepository,
        schedule_repo: ScheduleRepository,
        explanation_repo: ExplanationRepository,
        metrics_repo: MetricsRepository,
        session_service: SessionService,
        replan_repo: ReplanRepository,
        algo_client: AlgorithmClient | None = None,
    ):
        self.engineer_repo = engineer_repo
        self.task_repo = task_repo
        self.schedule_repo = schedule_repo
        self.explanation_repo = explanation_repo
        self.metrics_repo = metrics_repo
        self.session_service = session_service
        self.replan_repo = replan_repo
        self.algo_client = algo_client or get_default_algorithm_client()

    async def run_optimization(self, dispatcher_id: str) -> StateResponse:
        engineers = self.engineer_repo.get_active_by_dispatcher(dispatcher_id)
        tasks = self.task_repo.get_active_by_dispatcher(dispatcher_id)

        eng_payload = [
            {
                "id": e.id,
                "name": e.name,
                "start_lat": e.start_lat,
                "start_lon": e.start_lon,
                "shift_start": e.shift_start,
                "shift_end": e.shift_end,
                "skills": e.skills,
                "transport_type": e.transport_type,
                "status": e.status,
                "area_id": e.area_id,
                "is_on_duty": e.is_on_duty,
            }
            for e in engineers
        ]

        task_payload = [
            {
                "id": t.id,
                "address": t.address,
                "district": t.district,
                "lat": t.lat,
                "lon": t.lon,
                "window_start": t.window_start,
                "window_end": t.window_end,
                "duration_min": t.duration_min,
                "required_skill": t.required_skill,
                "required_transport": t.required_transport,
                "priority": t.priority,
                "category": t.category,
                "area_id": t.area_id,
                "created_at": t.created_at,
            }
            for t in tasks
        ]

        algo_res = await self.algo_client.call_optimize(eng_payload, task_payload)

        self.schedule_repo.delete_all_by_dispatcher(dispatcher_id)
        self.explanation_repo.delete_by_dispatcher(dispatcher_id)

        self.task_repo.mark_status_for_dispatcher(dispatcher_id, from_status="new", to_status="active")
        self.engineer_repo.mark_status_for_dispatcher(dispatcher_id, from_status="new", to_status="active")

        self.schedule_repo.bulk_create(
            _schedule_records_from_routes(dispatcher_id, algo_res.get("optimized_routes", []))
        )

        opt_m = algo_res.get("optimized_metrics", {})
        base_m = algo_res.get("baseline_metrics", {})
        unassigned = algo_res.get("unassigned_tasks", [])

        metrics_rec = PlanMetricsRecord(
            dispatcher_id=dispatcher_id,
            baseline_engineers=base_m.get("total_engineers_used", 0),
            baseline_mileage=base_m.get("total_mileage_km", 0.0),
            optimized_engineers=opt_m.get("total_engineers_used", 0),
            optimized_mileage=opt_m.get("total_mileage_km", 0.0),
            assigned_count=opt_m.get("assigned_tasks_count", 0),
            unassigned_count=opt_m.get("unassigned_tasks_count", 0),
            mileage_reduction_pct=opt_m.get("mileage_reduction_pct"),
            engineers_reduction_pct=opt_m.get("engineers_reduction_pct"),
            **{field: opt_m.get(field, 0) for field in QUALITY_METRIC_FIELDS},
            unassigned_json=json.dumps(unassigned, ensure_ascii=False),
        )
        self.metrics_repo.upsert(metrics_rec)

        return self.session_service.build_state_response(dispatcher_id)

    async def replan(self, dispatcher_id: str, events: list[ChangeEventIn]) -> StateResponse:
        if not events:
            return self.session_service.build_state_response(dispatcher_id)
        # The existing schedule and task records must be read before any status changes.
        state = self.session_service.build_state_response(dispatcher_id)
        current_schedule_payload = [r.model_dump() for r in state.schedule]
        engineers_payload = [e.model_dump() for e in state.engineers]
        tasks_payload = [t.model_dump() for t in state.tasks if t.status != "cancelled"]
        batch_time = _current_event_timestamp()
        events_payload = []
        for event in events:
            payload = event.model_dump()
            payload["timestamp"] = payload["timestamp"] or batch_time
            if event.event_type in {"URGENT_TASK", "REGULAR_TASK"} and payload["task"]:
                payload["task"]["id"] = payload["task"]["id"] or f"task_{uuid.uuid4().hex[:8]}"
                payload["task"]["area_id"] = payload["task"]["area_id"] or state.active_preset
                payload["task"]["created_at"] = payload["task"]["created_at"] or _event_created_at(payload["timestamp"])
                if event.event_type == "URGENT_TASK":
                    payload["task"]["priority"] = "Срочная"
                    payload["task"]["category"] = "emergency"
            events_payload.append(payload)

        try:
            algo_res = await self.algo_client.call_replan(
                current_schedule_payload, engineers_payload, events_payload, tasks_payload
            )
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

        records = _schedule_records_from_routes(dispatcher_id, algo_res["updated_routes"])
        assigned_ids = {record.task_id for record in records}
        cancelled_ids = {event["task_id"] for event in events_payload if event["event_type"] == "CANCEL_TASK"}
        unavailable_ids = {
            event["engineer_id"] for event in events_payload if event["event_type"] == "ENGINEER_UNAVAILABLE"
        }
        new_tasks = []
        for event in events_payload:
            data = event["task"] if event["event_type"] in {"URGENT_TASK", "REGULAR_TASK"} else None
            if data:
                new_tasks.append(
                    Task(
                        id=data["id"],
                        dispatcher_id=dispatcher_id,
                        address=data["address"],
                        district=data.get("district") or "",
                        lat=data["lat"],
                        lon=data["lon"],
                        window_start=data["window_start"],
                        window_end=data["window_end"],
                        duration_min=data["duration_min"],
                        required_skill=data["required_skill"],
                        required_transport=data.get("required_transport"),
                        priority=data["priority"],
                        category=data["category"],
                        area_id=data.get("area_id") or state.active_preset,
                        created_at=data.get("created_at") or _event_created_at(event["timestamp"]),
                        status="active" if data["id"] in assigned_ids else "new",
                    )
                )
        unassigned = [
            UnassignedTask(**item) for item in algo_res["unassigned_tasks"] if item["task_id"] not in cancelled_ids
        ]
        published_stops = {route["engineer_id"]: route["stops"] for route in current_schedule_payload}
        updated_stops = {route["engineer_id"]: route.get("stops", []) for route in algo_res["updated_routes"]}
        replace_schedule = any(
            updated_stops.get(engineer_id, []) != published_stops.get(engineer_id, [])
            for engineer_id in published_stops.keys() | updated_stops.keys()
        )
        # The stored FIFO reference describes the original inputs, not this event batch.
        metrics = PlanMetrics(**algo_res["metrics"])
        metrics.mileage_reduction_pct = None
        metrics.engineers_reduction_pct = None
        self.replan_repo.save(
            dispatcher_id,
            new_tasks=new_tasks,
            cancelled_ids=cancelled_ids,
            unavailable_ids=unavailable_ids,
            schedule_records=records,
            replace_schedule=replace_schedule,
            metrics=metrics,
            unassigned=unassigned,
        )

        return self.session_service.build_state_response(dispatcher_id)
