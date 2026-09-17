from fastapi import APIRouter

from backend.Controllers.v1 import (
    engineer_router,
    health_router,
    schedule_router,
    session_router,
    task_router,
)
from backend.Controllers.v1 import (
    router as v1_endpoints,
)

# Root router for top-level endpoints (e.g. /health)
root_router = APIRouter()
root_router.include_router(health_router)

# Versioned router at /api/v1
v1_router = APIRouter(prefix="/api/v1")
v1_router.include_router(v1_endpoints)

__all__ = [
    "engineer_router",
    "health_router",
    "root_router",
    "schedule_router",
    "session_router",
    "task_router",
    "v1_router",
]
