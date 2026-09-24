import json
import uuid

from backend.Entities.metrics import PlanMetricsRecord
from backend.Entities.schedule import ScheduleRecord
from backend.Entities.task import Task
from backend.Models.schedule import StateResponse
from backend.Models.session import ChangeEventIn
from backend.Repository.engineer_repository import EngineerRepository
from backend.Repository.explanation_repository import ExplanationRepository
from backend.Repository.metrics_repository import MetricsRepository
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


class ScheduleService:
    def __init__(
        self,
        engineer_repo: EngineerRepository,
        task_repo: TaskRepository,
        schedule_repo: ScheduleRepository,
        explanation_repo: ExplanationRepository,
        metrics_repo: MetricsRepository,
        session_service: SessionService,
        algo_client: AlgorithmClient | None = None,
    ):
        self.engineer_repo = engineer_repo
        self.task_repo = task_repo
        self.schedule_repo = schedule_repo
        self.explanation_repo = explanation_repo
        self.metrics_repo = metrics_repo
        self.session_service = session_service
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
            unassigned_json=json.dumps(unassigned, ensure_ascii=False),
        )
        self.metrics_repo.upsert(metrics_rec)

        return self.session_service.build_state_response(dispatcher_id)

    async def replan(self, dispatcher_id: str, events: list[ChangeEventIn]) -> StateResponse:
        for ev in events:
            if ev.event_type == "ENGINEER_UNAVAILABLE" and ev.engineer_id:
                self.engineer_repo.set_status(dispatcher_id, ev.engineer_id, "unavailable")
            elif ev.event_type == "CANCEL_TASK" and ev.task_id:
                self.task_repo.set_status(dispatcher_id, ev.task_id, "cancelled")
            elif ev.event_type == "URGENT_TASK" and ev.task:
                task_id = ev.task.id or f"urgent_{uuid.uuid4().hex[:6]}"
                new_task = Task(
                    id=task_id,
                    dispatcher_id=dispatcher_id,
                    address=ev.task.address,
                    district=ev.task.district or "",
                    lat=ev.task.lat,
                    lon=ev.task.lon,
                    window_start=ev.task.window_start,
                    window_end=ev.task.window_end,
                    duration_min=ev.task.duration_min,
                    required_skill=ev.task.required_skill,
                    required_transport=ev.task.required_transport,
                    priority="Срочная",
                    status="active",
                )
                self.task_repo.create(new_task)

        state = self.session_service.build_state_response(dispatcher_id)
        current_schedule_payload = [r.model_dump() for r in state.schedule]
        engineers_payload = [e.model_dump() for e in state.engineers if e.status != "unavailable"]
        events_payload = [ev.model_dump() for ev in events]

        algo_res = await self.algo_client.call_replan(current_schedule_payload, engineers_payload, events_payload)

        self.schedule_repo.delete_all_by_dispatcher(dispatcher_id)

        self.schedule_repo.bulk_create(_schedule_records_from_routes(dispatcher_id, algo_res.get("updated_routes", [])))

        m = algo_res.get("metrics", {})
        unassigned = algo_res.get("unassigned_tasks", [])
        metrics_rec = self.metrics_repo.get_by_dispatcher(dispatcher_id)
        if metrics_rec:
            metrics_rec.optimized_engineers = m.get("total_engineers_used", 0)
            metrics_rec.optimized_mileage = m.get("total_mileage_km", 0.0)
            metrics_rec.assigned_count = m.get("assigned_tasks_count", 0)
            metrics_rec.unassigned_count = m.get("unassigned_tasks_count", 0)
            metrics_rec.unassigned_json = json.dumps(unassigned, ensure_ascii=False)
            self.metrics_repo.upsert(metrics_rec)

        self.task_repo.mark_status_for_dispatcher(dispatcher_id, from_status="new", to_status="active")
        self.engineer_repo.mark_status_for_dispatcher(dispatcher_id, from_status="new", to_status="active")

        return self.session_service.build_state_response(dispatcher_id)
