"""Service layer with lazy public exports for standalone algorithm use."""

from importlib import import_module

__all__ = [
    "AlgorithmClient",
    "EngineerService",
    "ScheduleService",
    "SessionService",
    "TaskService",
    "get_default_algorithm_client",
]

_MODULES = {
    "AlgorithmClient": "algorithm_client",
    "EngineerService": "engineer_service",
    "ScheduleService": "schedule_service",
    "SessionService": "session_service",
    "TaskService": "task_service",
    "get_default_algorithm_client": "algorithm_client",
}


def __getattr__(name: str):
    module_name = _MODULES.get(name)
    if module_name is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    value = getattr(import_module(f".{module_name}", __name__), name)
    globals()[name] = value
    return value
