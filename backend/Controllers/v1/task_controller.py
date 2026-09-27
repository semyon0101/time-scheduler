from typing import Annotated, Any

from fastapi import APIRouter, Depends

from backend.Dependencies import get_current_dispatcher_id, get_task_service
from backend.Models.schedule import StateResponse
from backend.Models.session import ExplanationOut
from backend.Models.task import TaskCreate, TaskOut
from backend.Services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post("", response_model=TaskOut)
async def create_task(
    body: TaskCreate,
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    service: Annotated[TaskService, Depends(get_task_service)],
) -> TaskOut:
    return service.create_task(disp_id, body)


@router.delete("/{task_id}", response_model=dict[str, Any])
async def delete_task(
    task_id: str,
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    service: Annotated[TaskService, Depends(get_task_service)],
) -> dict[str, Any]:
    return service.delete_task(disp_id, task_id)


@router.post("/{task_id}/cancel", response_model=StateResponse)
async def cancel_task(
    task_id: str,
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    service: Annotated[TaskService, Depends(get_task_service)],
) -> StateResponse:
    return await service.cancel_task(disp_id, task_id)


@router.get("/{task_id}/explanation", response_model=ExplanationOut)
async def get_task_explanation(
    task_id: str,
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    service: Annotated[TaskService, Depends(get_task_service)],
) -> ExplanationOut:
    return await service.get_explanation(disp_id, task_id)
