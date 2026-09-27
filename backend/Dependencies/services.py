from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from backend.Entities.database import get_db
from backend.Repository.dispatcher_repository import DispatcherRepository
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
from backend.Services.engineer_service import EngineerService
from backend.Services.schedule_service import ScheduleService
from backend.Services.session_service import SessionService
from backend.Services.task_service import TaskService


def get_dispatcher_repo(db: Annotated[Session, Depends(get_db)]) -> DispatcherRepository:
    return DispatcherRepository(db)


def get_engineer_repo(db: Annotated[Session, Depends(get_db)]) -> EngineerRepository:
    return EngineerRepository(db)


def get_task_repo(db: Annotated[Session, Depends(get_db)]) -> TaskRepository:
    return TaskRepository(db)


def get_schedule_repo(db: Annotated[Session, Depends(get_db)]) -> ScheduleRepository:
    return ScheduleRepository(db)


def get_explanation_repo(db: Annotated[Session, Depends(get_db)]) -> ExplanationRepository:
    return ExplanationRepository(db)


def get_metrics_repo(db: Annotated[Session, Depends(get_db)]) -> MetricsRepository:
    return MetricsRepository(db)


def get_replan_repo(db: Annotated[Session, Depends(get_db)]) -> ReplanRepository:
    return ReplanRepository(db)


def get_algorithm_client() -> AlgorithmClient:
    return get_default_algorithm_client()


def get_session_service(
    dispatcher_repo: Annotated[DispatcherRepository, Depends(get_dispatcher_repo)],
    engineer_repo: Annotated[EngineerRepository, Depends(get_engineer_repo)],
    task_repo: Annotated[TaskRepository, Depends(get_task_repo)],
    schedule_repo: Annotated[ScheduleRepository, Depends(get_schedule_repo)],
    explanation_repo: Annotated[ExplanationRepository, Depends(get_explanation_repo)],
    metrics_repo: Annotated[MetricsRepository, Depends(get_metrics_repo)],
) -> SessionService:
    return SessionService(
        dispatcher_repo=dispatcher_repo,
        engineer_repo=engineer_repo,
        task_repo=task_repo,
        schedule_repo=schedule_repo,
        explanation_repo=explanation_repo,
        metrics_repo=metrics_repo,
    )


def get_schedule_service(
    engineer_repo: Annotated[EngineerRepository, Depends(get_engineer_repo)],
    task_repo: Annotated[TaskRepository, Depends(get_task_repo)],
    schedule_repo: Annotated[ScheduleRepository, Depends(get_schedule_repo)],
    explanation_repo: Annotated[ExplanationRepository, Depends(get_explanation_repo)],
    metrics_repo: Annotated[MetricsRepository, Depends(get_metrics_repo)],
    session_service: Annotated[SessionService, Depends(get_session_service)],
    algo_client: Annotated[AlgorithmClient, Depends(get_algorithm_client)],
    replan_repo: Annotated[ReplanRepository, Depends(get_replan_repo)],
) -> ScheduleService:
    return ScheduleService(
        engineer_repo=engineer_repo,
        task_repo=task_repo,
        schedule_repo=schedule_repo,
        explanation_repo=explanation_repo,
        metrics_repo=metrics_repo,
        session_service=session_service,
        algo_client=algo_client,
        replan_repo=replan_repo,
    )


def get_engineer_service(
    engineer_repo: Annotated[EngineerRepository, Depends(get_engineer_repo)],
    schedule_repo: Annotated[ScheduleRepository, Depends(get_schedule_repo)],
    explanation_repo: Annotated[ExplanationRepository, Depends(get_explanation_repo)],
    task_repo: Annotated[TaskRepository, Depends(get_task_repo)],
    session_service: Annotated[SessionService, Depends(get_session_service)],
    algo_client: Annotated[AlgorithmClient, Depends(get_algorithm_client)],
    schedule_service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> EngineerService:
    return EngineerService(
        engineer_repo=engineer_repo,
        schedule_repo=schedule_repo,
        explanation_repo=explanation_repo,
        task_repo=task_repo,
        session_service=session_service,
        algo_client=algo_client,
        schedule_service=schedule_service,
    )


def get_task_service(
    task_repo: Annotated[TaskRepository, Depends(get_task_repo)],
    schedule_repo: Annotated[ScheduleRepository, Depends(get_schedule_repo)],
    explanation_repo: Annotated[ExplanationRepository, Depends(get_explanation_repo)],
    engineer_repo: Annotated[EngineerRepository, Depends(get_engineer_repo)],
    session_service: Annotated[SessionService, Depends(get_session_service)],
    algo_client: Annotated[AlgorithmClient, Depends(get_algorithm_client)],
    schedule_service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> TaskService:
    return TaskService(
        task_repo=task_repo,
        schedule_repo=schedule_repo,
        explanation_repo=explanation_repo,
        engineer_repo=engineer_repo,
        session_service=session_service,
        algo_client=algo_client,
        schedule_service=schedule_service,
    )
