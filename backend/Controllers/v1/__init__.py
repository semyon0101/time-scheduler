from fastapi import APIRouter

from backend.Controllers.v1.engineer_controller import router as engineer_router
from backend.Controllers.v1.health_controller import router as health_router
from backend.Controllers.v1.schedule_controller import router as schedule_router
from backend.Controllers.v1.session_controller import router as session_router
from backend.Controllers.v1.task_controller import router as task_router

router = APIRouter()
router.include_router(health_router)
router.include_router(session_router)
router.include_router(engineer_router)
router.include_router(task_router)
router.include_router(schedule_router)

__all__ = [
    "engineer_router",
    "health_router",
    "router",
    "schedule_router",
    "session_router",
    "task_router",
]
