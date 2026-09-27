import os
from collections.abc import Generator
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.config import sqlalchemy_url
from backend.Controllers.router import root_router, v1_router
from backend.Dependencies import get_algorithm_client
from backend.Entities.database import Base, get_db
from backend.Repository.dispatcher_repository import DispatcherRepository
from backend.Repository.engineer_repository import EngineerRepository
from backend.Repository.explanation_repository import ExplanationRepository
from backend.Repository.metrics_repository import MetricsRepository
from backend.Repository.replan_repository import ReplanRepository
from backend.Repository.schedule_repository import ScheduleRepository
from backend.Repository.task_repository import TaskRepository
from backend.Services.algorithm_client import AlgorithmClient
from backend.Services.engineer_service import EngineerService
from backend.Services.schedule_service import ScheduleService
from backend.Services.session_service import SessionService
from backend.Services.task_service import TaskService

# Automatically load .env from project root so tests get DATABASE_URL and related config
_ROOT_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _ROOT_DIR / ".env"
if _ENV_FILE.exists():
    try:
        from dotenv import load_dotenv

        load_dotenv(_ENV_FILE)
    except ImportError:
        with open(_ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip("'\""))


def _resolve_database_url() -> str:
    # 1. Environment variable (set explicitly or loaded from .env)
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        return db_url

    # 2. Read directly from .env file if present
    if _ENV_FILE.exists():
        with open(_ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() == "DATABASE_URL":
                        val = v.strip().strip("'\"")
                        if val:
                            return val

    # 3. Fallback PostgreSQL connection parameters
    postgres_user = os.environ.get("POSTGRES_USER", "postgres")
    postgres_pass = os.environ.get("POSTGRES_PASSWORD", "postgres")
    postgres_port = os.environ.get("POSTGRES_PORT", "5432")
    postgres_db = os.environ.get("POSTGRES_DB", "scheduler_db")
    return f"postgresql://{postgres_user}:{postgres_pass}@localhost:{postgres_port}/{postgres_db}"


@pytest.fixture(scope="function")
def test_db() -> Generator[Session, None, None]:
    db_url = _resolve_database_url()
    engine = create_engine(sqlalchemy_url(db_url), pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def mock_algo_client() -> AlgorithmClient:
    client = AlgorithmClient(base_url="http://mock-algo:8001")
    client.call_optimize = AsyncMock(
        return_value={
            "optimized_routes": [
                {
                    "engineer_id": "eng_1",
                    "engineer_name": "Иванов Иван",
                    "transport_type": "Автомобиль",
                    "stops": [
                        {
                            "task_id": "task_1",
                            "address": "ул. Тверская, 1",
                            "district": "ЦАО",
                            "lat": 55.7558,
                            "lon": 37.6176,
                            "order": 1,
                            "arrival_time": "10:00",
                            "start_time": "10:00",
                            "end_time": "10:45",
                            "travel_km": 3.5,
                            "travel_min": 15,
                            "required_skill": "Локальные работы",
                            "priority": "Обычная",
                        }
                    ],
                }
            ],
            "optimized_metrics": {
                "total_engineers_used": 1,
                "total_mileage_km": 3.5,
                "assigned_tasks_count": 1,
                "unassigned_tasks_count": 0,
                "mileage_reduction_pct": 25.0,
                "engineers_reduction_pct": 50.0,
            },
            "baseline_metrics": {
                "total_engineers_used": 2,
                "total_mileage_km": 5.0,
            },
            "unassigned_tasks": [],
        }
    )
    client.call_replan = AsyncMock(
        return_value={
            "updated_routes": [
                {
                    "engineer_id": "eng_1",
                    "engineer_name": "Иванов Иван",
                    "transport_type": "Автомобиль",
                    "stops": [],
                }
            ],
            "metrics": {
                "total_engineers_used": 1,
                "total_mileage_km": 0.0,
                "assigned_tasks_count": 0,
                "unassigned_tasks_count": 1,
            },
            "unassigned_tasks": [
                {
                    "task_id": "task_1",
                    "address": "ул. Тверская, 1",
                    "reason": "Отсутствие доступных инженеров",
                    "priority": "Обычная",
                }
            ],
        }
    )
    client.call_explain = AsyncMock(return_value={"explanation": "Тестовое обоснование решения VRPTW"})
    return client


@pytest.fixture
def repos(test_db: Session):
    return {
        "dispatcher": DispatcherRepository(test_db),
        "engineer": EngineerRepository(test_db),
        "task": TaskRepository(test_db),
        "schedule": ScheduleRepository(test_db),
        "explanation": ExplanationRepository(test_db),
        "metrics": MetricsRepository(test_db),
        "replan": ReplanRepository(test_db),
    }


@pytest.fixture
def services(repos, mock_algo_client):
    session_service = SessionService(
        dispatcher_repo=repos["dispatcher"],
        engineer_repo=repos["engineer"],
        task_repo=repos["task"],
        schedule_repo=repos["schedule"],
        explanation_repo=repos["explanation"],
        metrics_repo=repos["metrics"],
    )
    schedule_service = ScheduleService(
        engineer_repo=repos["engineer"],
        task_repo=repos["task"],
        schedule_repo=repos["schedule"],
        explanation_repo=repos["explanation"],
        metrics_repo=repos["metrics"],
        replan_repo=repos["replan"],
        session_service=session_service,
        algo_client=mock_algo_client,
    )
    engineer_service = EngineerService(
        engineer_repo=repos["engineer"],
        schedule_repo=repos["schedule"],
        explanation_repo=repos["explanation"],
        task_repo=repos["task"],
        session_service=session_service,
        algo_client=mock_algo_client,
        schedule_service=schedule_service,
    )
    task_service = TaskService(
        task_repo=repos["task"],
        schedule_repo=repos["schedule"],
        explanation_repo=repos["explanation"],
        engineer_repo=repos["engineer"],
        session_service=session_service,
        algo_client=mock_algo_client,
        schedule_service=schedule_service,
    )
    return {
        "session": session_service,
        "engineer": engineer_service,
        "task": task_service,
        "schedule": schedule_service,
    }


@pytest.fixture
def app(test_db: Session, mock_algo_client: AlgorithmClient) -> FastAPI:
    application = FastAPI(title="Test App")
    application.include_router(root_router)
    application.include_router(v1_router)

    def override_get_db():
        yield test_db

    application.dependency_overrides[get_db] = override_get_db
    application.dependency_overrides[get_algorithm_client] = lambda: mock_algo_client

    return application


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)
