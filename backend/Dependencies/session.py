from typing import Annotated

from fastapi import Depends, Header, Query

from backend.Dependencies.services import get_session_service
from backend.Services.session_service import SessionService


def get_current_dispatcher_id(
    session_service: Annotated[SessionService, Depends(get_session_service)],
    x_dispatcher_id: Annotated[str | None, Header(alias="X-Dispatcher-Id")] = None,
    session_id: Annotated[str | None, Query(alias="session_id")] = None,
    session: Annotated[str | None, Query(alias="session")] = None,
) -> str:
    """
    Extracts the dispatcher identity from the HTTP request (Header > Query session_id > Query session).
    Ensures that a Dispatcher record exists with an initialized dataset preset.
    """
    disp_id = None
    if isinstance(x_dispatcher_id, str) and x_dispatcher_id.strip():
        disp_id = x_dispatcher_id.strip()
    elif isinstance(session_id, str) and session_id.strip():
        disp_id = session_id.strip()
    elif isinstance(session, str) and session.strip():
        disp_id = session.strip()

    dispatcher = session_service.get_or_create_dispatcher(disp_id)
    return dispatcher.id
