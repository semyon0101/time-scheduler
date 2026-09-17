from typing import Annotated

from fastapi import APIRouter, Depends

from backend.Dependencies import get_current_dispatcher_id, get_schedule_service
from backend.Models.schedule import StateResponse
from backend.Models.session import ReplanRequestIn
from backend.Services.schedule_service import ScheduleService

router = APIRouter(prefix="/schedule", tags=["Schedule"])


@router.post("/optimize", response_model=StateResponse)
async def optimize_schedule(
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> StateResponse:
    return await service.run_optimization(disp_id)


@router.post("/replan", response_model=StateResponse)
async def replan_schedule(
    body: ReplanRequestIn,
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    service: Annotated[ScheduleService, Depends(get_schedule_service)],
) -> StateResponse:
    return await service.replan(disp_id, body.events)
