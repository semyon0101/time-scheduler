from typing import Annotated

from fastapi import APIRouter, Depends

from backend.Dependencies import (
    get_current_dispatcher_id,
    get_schedule_service,
    get_session_service,
)
from backend.Models.schedule import StateResponse
from backend.Models.session import SeedRequest
from backend.Services.schedule_service import ScheduleService
from backend.Services.session_service import SessionService

router = APIRouter(tags=["Session"])


@router.get("/session/init", response_model=StateResponse)
async def session_init(
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    session_service: Annotated[SessionService, Depends(get_session_service)],
    schedule_service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> StateResponse:
    metrics = session_service.metrics_repo.get_by_dispatcher(disp_id)
    if not metrics:
        await schedule_service.run_optimization(disp_id)
    return session_service.build_state_response(disp_id)


@router.get("/state", response_model=StateResponse)
async def get_state(
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    session_service: Annotated[SessionService, Depends(get_session_service)],
) -> StateResponse:
    return session_service.build_state_response(disp_id)


@router.post("/demo/seed", response_model=StateResponse)
async def seed_dataset(
    body: SeedRequest,
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    session_service: Annotated[SessionService, Depends(get_session_service)],
    schedule_service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> StateResponse:
    session_service.load_preset(disp_id, body.preset)
    await schedule_service.run_optimization(disp_id)
    return session_service.build_state_response(disp_id)


@router.post("/session/reset", response_model=StateResponse)
async def reset_session(
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    session_service: Annotated[SessionService, Depends(get_session_service)],
) -> StateResponse:
    return session_service.reset_session(disp_id)
