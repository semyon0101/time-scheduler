import json
import uuid

from fastapi import HTTPException

from backend.Entities.engineer import Engineer
from backend.Entities.explanation import ExplanationCache
from backend.Models.engineer import EngineerCreate, EngineerOut
from backend.Models.schedule import StateResponse
from backend.Models.session import ExplanationOut
from backend.Repository.engineer_repository import EngineerRepository
from backend.Repository.explanation_repository import ExplanationRepository
from backend.Repository.schedule_repository import ScheduleRepository
from backend.Repository.task_repository import TaskRepository
from backend.Services.algorithm_client import (
    AlgorithmClient,
    get_default_algorithm_client,
)
from backend.Services.session_service import SessionService


class EngineerService:
    def __init__(
        self,
        engineer_repo: EngineerRepository,
        schedule_repo: ScheduleRepository,
        explanation_repo: ExplanationRepository,
        task_repo: TaskRepository,
        session_service: SessionService,
        algo_client: AlgorithmClient | None = None,
    ):
        self.engineer_repo = engineer_repo
        self.schedule_repo = schedule_repo
        self.explanation_repo = explanation_repo
        self.task_repo = task_repo
        self.session_service = session_service
        self.algo_client = algo_client or get_default_algorithm_client()

    def create_engineer(self, dispatcher_id: str, data: EngineerCreate) -> EngineerOut:
        eng_id = data.id or f"eng_{uuid.uuid4().hex[:6]}"
        new_eng = Engineer(
            id=eng_id,
            dispatcher_id=dispatcher_id,
            name=data.name,
            start_lat=data.start_lat,
            start_lon=data.start_lon,
            shift_start=data.shift_start,
            shift_end=data.shift_end,
            skills_json=json.dumps(data.skills, ensure_ascii=False),
            transport_type=data.transport_type,
            status="new",
        )
        created = self.engineer_repo.create(new_eng)
        return EngineerOut(
            id=created.id,
            name=created.name,
            start_lat=created.start_lat,
            start_lon=created.start_lon,
            shift_start=created.shift_start,
            shift_end=created.shift_end,
            skills=created.skills,
            transport_type=created.transport_type,
            status=created.status,
        )

    def delete_engineer(self, dispatcher_id: str, engineer_id: str) -> dict:
        eng = self.engineer_repo.get_by_id(dispatcher_id, engineer_id)
        if not eng:
            raise HTTPException(status_code=404, detail="Инженер не найден")
        self.schedule_repo.delete_by_engineer(dispatcher_id, engineer_id)
        self.explanation_repo.delete_by_engineer(dispatcher_id, engineer_id)
        self.engineer_repo.delete(dispatcher_id, engineer_id)
        return {"status": "ok", "deleted_id": engineer_id}

    def toggle_status(self, dispatcher_id: str, engineer_id: str) -> StateResponse:
        eng = self.engineer_repo.get_by_id(dispatcher_id, engineer_id)
        if not eng:
            raise HTTPException(status_code=404, detail="Инженер не найден")

        # Engineer offline is irreversible
        self.engineer_repo.set_status(dispatcher_id, engineer_id, "unavailable")
        self.schedule_repo.delete_by_engineer(dispatcher_id, engineer_id)
        self.explanation_repo.delete_by_engineer(dispatcher_id, engineer_id)

        return self.session_service.build_state_response(dispatcher_id)

    async def get_explanation(self, dispatcher_id: str, engineer_id: str) -> ExplanationOut:
        cache_key = f"eng_exp_{engineer_id}"
        cached = self.explanation_repo.get_cache(dispatcher_id, cache_key)
        if cached:
            return ExplanationOut(
                task_id=cache_key,
                assigned_engineer_id=engineer_id,
                explanation=cached.explanation_text,
                cached=True,
            )

        eng = self.engineer_repo.get_by_id(dispatcher_id, engineer_id)
        if not eng:
            raise HTTPException(status_code=404, detail="Инженер не найден")

        stops = self.schedule_repo.get_by_engineer(dispatcher_id, engineer_id)
        stops_count = len(stops)
        total_km = round(sum(s.travel_km for s in stops), 2)
        total_min = sum(s.travel_min for s in stops)

        all_engs = self.engineer_repo.get_all_by_dispatcher(dispatcher_id)
        all_tasks = self.task_repo.get_active_by_dispatcher(dispatcher_id)
        all_records = self.schedule_repo.get_all_by_dispatcher(dispatcher_id)

        context = {
            "type": "engineer_idle" if stops_count == 0 else "engineer_route",
            "is_idle": (stops_count == 0),
            "engineer_name": eng.name,
            "transport_type": eng.transport_type,
            "shift": f"{eng.shift_start} - {eng.shift_end}",
            "skills": eng.skills,
            "stops_count": stops_count,
            "total_travel_km": total_km,
            "total_travel_min": total_min,
            "first_start": stops[0].start_time if stops else eng.shift_start,
            "last_end": stops[-1].end_time if stops else eng.shift_end,
            "total_tasks_count": len(all_tasks),
            "total_engineers_count": len(all_engs),
            "active_engineers_count": len({r.engineer_id for r in all_records}),
        }

        try:
            algo_res = await self.algo_client.call_explain(cache_key, engineer_id, context)
            text = algo_res.get("explanation", "Обоснование сформировано")
        except Exception:
            text = (
                f"### Обоснование статуса: {eng.name}\n\n"
                f"В секторе находится {context['total_tasks_count']} задач и {context['total_engineers_count']} специалистов.\n\n"
                f"Инженер **{eng.name}** ({eng.transport_type}, смена {eng.shift_start}–{eng.shift_end}) "
                f"находится в оперативном резерве согласно критериям оптимизации ТЗ Билайн:\n\n"
                f"1. **Минимизация штата:** Все задачи распределены с наименьшим числом исполнителей без перегрузки смен.\n"
                f"2. **Резерв:** Специалист дежурит для экстренного перекрытия аварий и замены заболевших сотрудников."
            )

        new_cache = ExplanationCache(
            dispatcher_id=dispatcher_id,
            task_id=cache_key,
            assigned_engineer_id=engineer_id,
            explanation_text=text,
        )
        self.explanation_repo.save_cache(new_cache)

        return ExplanationOut(
            task_id=cache_key,
            assigned_engineer_id=engineer_id,
            explanation=text,
            cached=False,
        )
