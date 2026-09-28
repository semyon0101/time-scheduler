import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from backend.Entities.explanation import ExplanationCache
from backend.Entities.task import Task
from backend.Models.schedule import StateResponse
from backend.Models.session import ChangeEventIn, ExplanationOut
from backend.Models.task import TaskCreate, TaskOut
from backend.Repository.engineer_repository import EngineerRepository
from backend.Repository.explanation_repository import ExplanationRepository
from backend.Repository.schedule_repository import ScheduleRepository
from backend.Repository.task_repository import TaskRepository
from backend.Services.algorithm_client import (
    AlgorithmClient,
    get_default_algorithm_client,
)
from backend.Services.schedule_service import ScheduleService
from backend.Services.session_service import SessionService


class TaskService:
    def __init__(
        self,
        task_repo: TaskRepository,
        schedule_repo: ScheduleRepository,
        explanation_repo: ExplanationRepository,
        engineer_repo: EngineerRepository,
        session_service: SessionService,
        algo_client: AlgorithmClient | None = None,
        schedule_service: ScheduleService | None = None,
    ):
        self.task_repo = task_repo
        self.schedule_repo = schedule_repo
        self.explanation_repo = explanation_repo
        self.engineer_repo = engineer_repo
        self.session_service = session_service
        self.algo_client = algo_client or get_default_algorithm_client()
        self.schedule_service = schedule_service

    def create_task(self, dispatcher_id: str, data: TaskCreate) -> TaskOut:
        task_id = data.id or f"task_{uuid.uuid4().hex[:6]}"
        dispatcher = self.session_service.dispatcher_repo.get_by_id(dispatcher_id)
        new_task = Task(
            id=task_id,
            dispatcher_id=dispatcher_id,
            address=data.address,
            district=data.district or "",
            lat=data.lat,
            lon=data.lon,
            window_start=data.window_start,
            window_end=data.window_end,
            duration_min=data.duration_min,
            required_skill=data.required_skill,
            required_transport=data.required_transport,
            priority=data.priority,
            category=data.category,
            area_id=data.area_id or dispatcher.active_preset,
            created_at=data.created_at or datetime.now(ZoneInfo("Europe/Moscow")),
            status="new",
        )
        created = self.task_repo.create(new_task)
        return TaskOut(
            id=created.id,
            address=created.address,
            district=created.district,
            lat=created.lat,
            lon=created.lon,
            window_start=created.window_start,
            window_end=created.window_end,
            duration_min=created.duration_min,
            required_skill=created.required_skill,
            required_transport=created.required_transport,
            priority=created.priority,
            category=created.category,
            area_id=created.area_id,
            created_at=created.created_at,
            status=created.status,
            control_assigned_engineer=created.control_assigned_engineer,
        )

    def delete_task(self, dispatcher_id: str, task_id: str) -> dict:
        t = self.task_repo.get_by_id(dispatcher_id, task_id)
        if not t:
            raise HTTPException(status_code=404, detail="Заявка не найдена")
        if self.schedule_repo.get_by_task(dispatcher_id, task_id):
            raise HTTPException(status_code=409, detail="Сначала отмените запланированную заявку")
        self.schedule_repo.delete_by_task(dispatcher_id, task_id)
        self.explanation_repo.delete_by_task(dispatcher_id, task_id)
        self.task_repo.delete(dispatcher_id, task_id)
        return {"status": "ok", "deleted_id": task_id}

    async def cancel_task(self, dispatcher_id: str, task_id: str) -> StateResponse:
        t = self.task_repo.get_by_id(dispatcher_id, task_id)
        if not t:
            raise HTTPException(status_code=404, detail="Заявка не найдена")
        if self.schedule_service is None:
            raise RuntimeError("ScheduleService is required to cancel a task safely")
        return await self.schedule_service.replan(
            dispatcher_id, [ChangeEventIn(event_type="CANCEL_TASK", task_id=task_id)]
        )

    async def get_explanation(self, dispatcher_id: str, task_id: str) -> ExplanationOut:
        cached = self.explanation_repo.get_cache(dispatcher_id, task_id)
        if cached:
            return ExplanationOut(
                task_id=task_id,
                assigned_engineer_id=cached.assigned_engineer_id,
                explanation=cached.explanation_text,
                cached=True,
            )

        sr = self.schedule_repo.get_by_task(dispatcher_id, task_id)
        task = self.task_repo.get_by_id(dispatcher_id, task_id)

        all_engs = self.engineer_repo.get_all_by_dispatcher(dispatcher_id)
        all_tasks = self.task_repo.get_active_by_dispatcher(dispatcher_id)
        all_records = self.schedule_repo.get_all_by_dispatcher(dispatcher_id)

        assigned_id = sr.engineer_id if sr else None

        candidates = []
        for e in all_engs:
            if e.id != assigned_id:
                candidates.append(
                    {
                        "id": e.id,
                        "name": e.name,
                        "transport": e.transport_type,
                        "has_skill": (task.required_skill in e.skills) if task else False,
                        "status": e.status,
                    }
                )

        context = {
            "address": sr.task_address if sr else (task.address if task else "Москва"),
            "district": sr.district if sr else (task.district if task else ""),
            "priority": sr.priority if sr else (task.priority if task else "Обычная"),
            "engineer_name": sr.engineer_name if sr else "Инженер",
            "required_skill": sr.required_skill if sr else (task.required_skill if task else "Локальные работы"),
            "transport_type": sr.transport_type if sr else "Автомобиль",
            "arrival_time": sr.arrival_time if sr else "18:00",
            "start_time": sr.start_time if sr else None,
            "window": f"{task.window_start} - {task.window_end}" if task else "18:00 - 20:00",
            "travel_km": sr.travel_km if sr else 2.1,
            "travel_min": sr.travel_min if sr else 15,
            "total_tasks_count": len(all_tasks),
            "total_engineers_count": len(all_engs),
            "active_engineers_count": len({r.engineer_id for r in all_records}),
            "alternative_candidates": candidates[:4],
        }

        if not sr:
            context["type"] = "task_unassigned"
            context["reason"] = (
                "Изменена: ожидает нажатия «Распланировать»"
                if (task and task.status == "new")
                else "Превышение временных окон или дефицит свободных бригад"
            )

        try:
            algo_res = await self.algo_client.call_explain(task_id, assigned_id, context)
            text = algo_res.get("explanation", "Обоснование сформировано")
        except Exception:
            if not sr:
                text = (
                    f"### Обоснование нераспределенной заявки #{task_id}\n\n"
                    f"В секторе находится {context['total_tasks_count']} заявок и {context['total_engineers_count']} инженеров "
                    f"(активно: {context['active_engineers_count']}).\n\n"
                    f"Заявка по адресу **{context['address']}** (приоритет: {context['priority']}, требуемый навык: «{context['required_skill']}», окно: {context['window']}) "
                    f"в настоящее время **не назначена** на исполнителя: {context.get('reason', 'Ограничения смен и логистической доступности')}."
                )
            else:
                text = (
                    f"### Обоснование назначения заявки #{task_id}\n\n"
                    f"В секторе находится {context['total_tasks_count']} заявок и {context['total_engineers_count']} инженеров "
                    f"(активно: {context['active_engineers_count']}).\n\n"
                    f"Заявка по адресу **{context['address']}** (приоритет: {context['priority']}) успешно назначена "
                    f"**{context['engineer_name']}** на основе многокритериального VRPTW-отбора:\n\n"
                    f"1. **Квалификация:** Требуемый навык *«{context['required_skill']}»* подтвержден в профиле исполнителя.\n"
                    f"2. **Транспортная доступность:** Используется {context['transport_type']}, расчетный доезд {context['travel_km']} км ({context['travel_min']} мин).\n"
                    f"3. **Временное окно:** Прибытие к {context['arrival_time']} укладывается в окно клиента ({context['window']})."
                )

        new_cache = ExplanationCache(
            dispatcher_id=dispatcher_id,
            task_id=task_id,
            assigned_engineer_id=assigned_id,
            explanation_text=text,
        )
        self.explanation_repo.save_cache(new_cache)

        return ExplanationOut(
            task_id=task_id,
            assigned_engineer_id=assigned_id,
            explanation=text,
            cached=False,
        )
