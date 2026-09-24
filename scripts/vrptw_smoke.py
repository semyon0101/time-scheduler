from backend.Models.VRPTW.request import EngineerRequest, Request, TaskRequest
from backend.Models.VRPTW.request_types import (
    EngineerStatus,
    EngineerStatusEnum,
    Position,
    Priority,
    PriorityEnum,
    Skill,
    SkillEnum,
    Time,
    TransportType,
    TransportTypeEnum,
)
from backend.Services.routing.solver import solve_engineer_route


def t(hhmm: str) -> Time:
    h, m = map(int, hhmm.split(":"))
    return Time(time=hhmm, hours=h, minutes=m, absolute_time=h * 60 + m)


def main() -> None:
    eng = EngineerRequest(
        id="e1",
        start_pos=Position(lat=55.75, lon=37.62),
        shift_start=t("09:00"),
        shift_end=t("18:00"),
        skills=[Skill(skill=SkillEnum.LOCKAL), Skill(skill=SkillEnum.CONNECT)],
        transport_type=TransportType(transport_type=TransportTypeEnum.CAR),
        status=EngineerStatus(status=EngineerStatusEnum.ACTIVE),
    )
    tasks = [
        TaskRequest(
            id="a",
            pos=Position(lat=55.76, lon=37.63),
            window_start=t("09:00"),
            window_end=t("12:00"),
            duration=t("00:40"),
            required_skill=Skill(skill=SkillEnum.LOCKAL),
            required_transport=None,
            priority=Priority(priority=PriorityEnum.NORMAL),
        ),
        TaskRequest(
            id="b",
            pos=Position(lat=55.77, lon=37.64),
            window_start=t("11:00"),
            window_end=t("16:00"),
            duration=t("00:30"),
            required_skill=Skill(skill=SkillEnum.CONNECT),
            required_transport=TransportType(transport_type=TransportTypeEnum.CAR),
            priority=Priority(priority=PriorityEnum.URGENT),
        ),
        TaskRequest(
            id="c_wrong_skill",
            pos=Position(lat=55.78, lon=37.65),
            window_start=t("10:00"),
            window_end=t("18:00"),
            duration=t("00:20"),
            required_skill=Skill(skill=SkillEnum.EMERGENCY),
            required_transport=None,
            priority=Priority(priority=PriorityEnum.NORMAL),
        ),
    ]
    res = solve_engineer_route(Request(engineers=eng, tasks=tasks))
    print(res.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
