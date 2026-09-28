import json
import os
import uuid

from fastapi import HTTPException

from backend.Entities.dispatcher import Dispatcher
from backend.Entities.engineer import Engineer
from backend.Entities.task import Task
from backend.Models.engineer import EngineerOut
from backend.Models.optimization import QUALITY_METRIC_FIELDS
from backend.Models.schedule import (
    EngineerRouteOut,
    MetricsOut,
    ScheduleStopOut,
    StateResponse,
    UnassignedTaskOut,
)
from backend.Models.task import TaskOut
from backend.Repository.dispatcher_repository import DispatcherRepository
from backend.Repository.engineer_repository import EngineerRepository
from backend.Repository.explanation_repository import ExplanationRepository
from backend.Repository.metrics_repository import MetricsRepository
from backend.Repository.schedule_repository import ScheduleRepository
from backend.Repository.task_repository import TaskRepository
from backend.Services.routing.dataset import enrich_preset_data

PRESET_ALIASES = {
    "yugcenter": "yugocentr",
    "yugocentr": "yugocentr",
    "yug-center": "yugocentr",
    "югоцентр": "yugocentr",
    "yugovostok": "yugovostok",
    "yugo-vostok": "yugovostok",
    "юго-восток": "yugovostok",
    "vostok": "vostok",
    "восток": "vostok",
}


class SessionService:
    def __init__(
        self,
        dispatcher_repo: DispatcherRepository,
        engineer_repo: EngineerRepository,
        task_repo: TaskRepository,
        schedule_repo: ScheduleRepository,
        explanation_repo: ExplanationRepository,
        metrics_repo: MetricsRepository,
    ):
        self.dispatcher_repo = dispatcher_repo
        self.engineer_repo = engineer_repo
        self.task_repo = task_repo
        self.schedule_repo = schedule_repo
        self.explanation_repo = explanation_repo
        self.metrics_repo = metrics_repo

    def get_or_create_dispatcher(self, disp_id: str | None = None) -> Dispatcher:
        if not disp_id or not disp_id.strip():
            disp_id = f"disp_{uuid.uuid4().hex[:8]}"
        else:
            disp_id = disp_id.strip()

        dispatcher = self.dispatcher_repo.get_by_id(disp_id)
        if not dispatcher:
            dispatcher = self.dispatcher_repo.create(disp_id, active_preset="vostok")
            self.load_preset(dispatcher.id, "vostok")

        return dispatcher

    def load_preset(self, dispatcher_id: str, preset: str):
        normalized_preset = PRESET_ALIASES.get(preset.lower(), preset)

        self.schedule_repo.delete_all_by_dispatcher(dispatcher_id)
        self.explanation_repo.delete_by_dispatcher(dispatcher_id)
        self.metrics_repo.delete_by_dispatcher(dispatcher_id)
        self.task_repo.delete_all_by_dispatcher(dispatcher_id)
        self.engineer_repo.delete_all_by_dispatcher(dispatcher_id)

        current_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
        candidate_paths = [
            os.path.join(root_dir, "data", f"{normalized_preset}.json"),
            os.path.join(root_dir, "data", f"{preset}.json"),
            os.path.join(root_dir, "backend", "seed", f"{normalized_preset}.json"),
            os.path.join(root_dir, "seed", f"{normalized_preset}.json"),
            os.path.join(current_dir, "..", "seed", f"{normalized_preset}.json"),
            os.path.join(os.getcwd(), "data", f"{normalized_preset}.json"),
            os.path.join(os.getcwd(), "backend", "seed", f"{normalized_preset}.json"),
            os.path.join(os.getcwd(), "seed", f"{normalized_preset}.json"),
            os.path.abspath(f"data/{normalized_preset}.json"),
            os.path.abspath(f"seed/{normalized_preset}.json"),
            os.path.abspath(f"backend/seed/{normalized_preset}.json"),
        ]

        seed_file = None
        for cp in candidate_paths:
            if os.path.exists(cp):
                seed_file = cp
                break

        if not seed_file:
            raise HTTPException(
                status_code=404,
                detail=f"Seed preset '{preset}' not found in paths: {candidate_paths}",
            )

        with open(seed_file, "r", encoding="utf-8") as f:
            data = enrich_preset_data(json.load(f), normalized_preset)

        for e in data.get("engineers", []):
            eng = Engineer(
                id=e["id"],
                dispatcher_id=dispatcher_id,
                name=e["name"],
                start_lat=e["start_lat"],
                start_lon=e["start_lon"],
                shift_start=e.get("shift_start", "09:00"),
                shift_end=e.get("shift_end", "22:00"),
                skills_json=json.dumps(e.get("skills", []), ensure_ascii=False),
                transport_type=e.get("transport_type", "Автомобиль"),
                area_id=e["area_id"],
                is_on_duty=e["is_on_duty"],
                status="active",
            )
            self.engineer_repo.create(eng)

        for t in data.get("tasks", []):
            task = Task(
                id=t["id"],
                dispatcher_id=dispatcher_id,
                address=t["address"],
                district=t.get("district", ""),
                lat=t["lat"],
                lon=t["lon"],
                window_start=t.get("window_start", "09:00"),
                window_end=t.get("window_end", "22:00"),
                duration_min=t.get("duration_min", 45),
                required_skill=t.get("required_skill", "Локальные работы"),
                required_transport=t.get("required_transport"),
                priority=t.get("priority", "Обычная"),
                category=t["category"],
                area_id=t["area_id"],
                created_at=t.get("created_at"),
                status="active",
                control_assigned_engineer=t.get("control_assigned_engineer"),
            )
            self.task_repo.create(task)

        self.dispatcher_repo.update_preset(dispatcher_id, normalized_preset)

    def build_state_response(self, dispatcher_id: str) -> StateResponse:
        disp = self.dispatcher_repo.get_by_id(dispatcher_id)
        engineers = self.engineer_repo.get_all_by_dispatcher(dispatcher_id)
        tasks = self.task_repo.get_all_by_dispatcher(dispatcher_id)
        schedule_records = self.schedule_repo.get_all_by_dispatcher(dispatcher_id)
        task_durations = {task.id: task.duration_min for task in tasks}
        metrics_rec = self.metrics_repo.get_by_dispatcher(dispatcher_id)

        routes_dict = {}
        for eng in engineers:
            routes_dict[eng.id] = {
                "engineer_id": eng.id,
                "engineer_name": eng.name,
                "transport_type": eng.transport_type,
                "skills": eng.skills,
                "start_lat": eng.start_lat,
                "start_lon": eng.start_lon,
                "shift_start": eng.shift_start,
                "shift_end": eng.shift_end,
                "stops": [],
                "total_distance_km": 0.0,
                "total_work_min": 0,
                "total_travel_min": 0,
            }

        for sr in schedule_records:
            if sr.engineer_id in routes_dict:
                routes_dict[sr.engineer_id]["stops"].append(
                    ScheduleStopOut(
                        task_id=sr.task_id,
                        address=sr.task_address,
                        district=sr.district,
                        lat=sr.lat,
                        lon=sr.lon,
                        order=sr.order,
                        arrival_time=sr.arrival_time,
                        start_time=sr.start_time,
                        end_time=sr.end_time,
                        travel_km=sr.travel_km,
                        travel_min=sr.travel_min,
                        required_skill=sr.required_skill,
                        priority=sr.priority,
                    )
                )
                routes_dict[sr.engineer_id]["total_distance_km"] = round(
                    routes_dict[sr.engineer_id]["total_distance_km"] + sr.travel_km, 2
                )
                routes_dict[sr.engineer_id]["total_travel_min"] += sr.travel_min
                routes_dict[sr.engineer_id]["total_work_min"] += task_durations.get(sr.task_id, 0)

        routes_out = [EngineerRouteOut(**r) for r in routes_dict.values()]

        metrics_out = None
        unassigned_tasks = []
        if metrics_rec:
            metrics_out = MetricsOut(
                baseline_engineers=metrics_rec.baseline_engineers,
                baseline_mileage=metrics_rec.baseline_mileage,
                optimized_engineers=metrics_rec.optimized_engineers,
                optimized_mileage=metrics_rec.optimized_mileage,
                assigned_count=metrics_rec.assigned_count,
                unassigned_count=metrics_rec.unassigned_count,
                mileage_reduction_pct=metrics_rec.mileage_reduction_pct,
                engineers_reduction_pct=metrics_rec.engineers_reduction_pct,
                **{field: getattr(metrics_rec, field) for field in QUALITY_METRIC_FIELDS},
            )
            try:
                unassigned_data = json.loads(metrics_rec.unassigned_json)
                unassigned_tasks = [UnassignedTaskOut(**u) for u in unassigned_data]
            except Exception:
                unassigned_tasks = []

        scheduled_task_ids = {sr.task_id for sr in schedule_records}
        unassigned_ids = {u.task_id for u in unassigned_tasks}
        for t in tasks:
            if t.status == "cancelled":
                continue
            if t.id not in scheduled_task_ids and t.id not in unassigned_ids:
                unassigned_tasks.append(
                    UnassignedTaskOut(
                        task_id=t.id,
                        address=t.address,
                        reason="Изменена: ожидает нажатия «Распланировать»",
                        priority=t.priority,
                    )
                )

        if metrics_out:
            metrics_out.assigned_count = len(scheduled_task_ids)
            metrics_out.unassigned_count = len(unassigned_tasks)
            active_scheduled_engs = {sr.engineer_id for sr in schedule_records}
            metrics_out.optimized_engineers = len(active_scheduled_engs)

        return StateResponse(
            dispatcher_id=dispatcher_id,
            active_preset=disp.active_preset if disp else "vostok",
            engineers=[
                EngineerOut(
                    id=e.id,
                    name=e.name,
                    start_lat=e.start_lat,
                    start_lon=e.start_lon,
                    shift_start=e.shift_start,
                    shift_end=e.shift_end,
                    skills=e.skills,
                    transport_type=e.transport_type,
                    status=e.status or "active",
                    area_id=e.area_id,
                    is_on_duty=e.is_on_duty,
                )
                for e in engineers
            ],
            tasks=[
                TaskOut(
                    id=t.id,
                    address=t.address,
                    district=t.district,
                    lat=t.lat,
                    lon=t.lon,
                    window_start=t.window_start,
                    window_end=t.window_end,
                    duration_min=t.duration_min,
                    required_skill=t.required_skill,
                    required_transport=t.required_transport,
                    priority=t.priority,
                    status=t.status or "active",
                    category=t.category,
                    area_id=t.area_id,
                    created_at=t.created_at,
                    control_assigned_engineer=t.control_assigned_engineer,
                )
                for t in tasks
            ],
            schedule=routes_out,
            metrics=metrics_out,
            unassigned_tasks=unassigned_tasks,
        )

    def reset_session(self, dispatcher_id: str) -> StateResponse:
        self.schedule_repo.delete_all_by_dispatcher(dispatcher_id)
        self.explanation_repo.delete_by_dispatcher(dispatcher_id)
        self.metrics_repo.delete_by_dispatcher(dispatcher_id)
        self.task_repo.delete_all_by_dispatcher(dispatcher_id)
        self.engineer_repo.delete_all_by_dispatcher(dispatcher_id)
        return self.build_state_response(dispatcher_id)
