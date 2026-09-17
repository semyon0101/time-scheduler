from typing import Annotated, Any

from fastapi import APIRouter, Depends

from backend.Dependencies import get_current_dispatcher_id, get_engineer_service
from backend.Models.engineer import EngineerCreate, EngineerOut
from backend.Models.schedule import StateResponse
from backend.Models.session import ExplanationOut
from backend.Services.engineer_service import EngineerService

router = APIRouter(prefix="/engineers", tags=["Engineers"])


@router.post("", response_model=EngineerOut)
async def create_engineer(
    body: EngineerCreate,
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    service: Annotated[EngineerService, Depends(get_engineer_service)],
) -> EngineerOut:
    return service.create_engineer(disp_id, body)


@router.delete("/{engineer_id}", response_model=dict[str, Any])
async def delete_engineer(
    engineer_id: str,
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    service: Annotated[EngineerService, Depends(get_engineer_service)],
) -> dict[str, Any]:
    return service.delete_engineer(disp_id, engineer_id)


@router.post("/{engineer_id}/toggle_status", response_model=StateResponse)
async def toggle_engineer_status(
    engineer_id: str,
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    service: Annotated[EngineerService, Depends(get_engineer_service)],
) -> StateResponse:
    return service.toggle_status(disp_id, engineer_id)


@router.get("/{engineer_id}/explanation", response_model=ExplanationOut)
async def get_engineer_explanation(
    engineer_id: str,
    disp_id: Annotated[str, Depends(get_current_dispatcher_id)],
    service: Annotated[EngineerService, Depends(get_engineer_service)],
) -> ExplanationOut:
    return await service.get_explanation(disp_id, engineer_id)
