import os
import json
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Dispatcher, Engineer, Task, ScheduleRecord, ExplanationCache, PlanMetricsRecord
from app.schemas import (
    EngineerCreate, EngineerOut, TaskCreate, TaskOut,
    StateResponse, SeedRequest, ReplanRequestIn, ExplanationOut,
    EngineerRouteOut, ScheduleStopOut, MetricsOut, UnassignedTaskOut
)
from app.algorithm_client import call_optimize, call_replan, call_explain

router = APIRouter(prefix="/api")

PRESET_ALIASES = {
    "yugcenter": "yugocentr",
    "yugocentr": "yugocentr",
    "yug-center": "yugocentr",
    "югоцентр": "yugocentr",
    "yugovostok": "yugovostok",
    "yugo-vostok": "yugovostok",
    "юго-восток": "yugovostok",
    "vostok": "vostok",
    "восток": "vostok"
}

def get_or_create_dispatcher(
    x_dispatcher_id: Optional[str] = Header(default=None),
    session_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
) -> Dispatcher:
    disp_id = None
    if isinstance(x_dispatcher_id, str) and x_dispatcher_id.strip():
        disp_id = x_dispatcher_id.strip()
    elif isinstance(session_id, str) and session_id.strip():
        disp_id = session_id.strip()

    if not disp_id:
        disp_id = f"disp_{uuid.uuid4().hex[:8]}"

    dispatcher = db.query(Dispatcher).filter(Dispatcher.id == disp_id).first()
    if not dispatcher:
        dispatcher = Dispatcher(id=disp_id, active_preset="vostok")
        db.add(dispatcher)
        db.commit()
        db.refresh(dispatcher)
        load_preset_to_db(dispatcher.id, "vostok", db)

    return dispatcher

def load_preset_to_db(dispatcher_id: str, preset: str, db: Session):
    normalized_preset = PRESET_ALIASES.get(preset.lower(), preset)

    db.query(ScheduleRecord).filter(ScheduleRecord.dispatcher_id == dispatcher_id).delete()
    db.query(ExplanationCache).filter(ExplanationCache.dispatcher_id == dispatcher_id).delete()
    db.query(PlanMetricsRecord).filter(PlanMetricsRecord.dispatcher_id == dispatcher_id).delete()
    db.query(Task).filter(Task.dispatcher_id == dispatcher_id).delete()
    db.query(Engineer).filter(Engineer.dispatcher_id == dispatcher_id).delete()

    current_dir = os.path.dirname(os.path.abspath(__file__))
    candidate_paths = [
        os.path.abspath(os.path.join(current_dir, "..", "seed", f"{normalized_preset}.json")),
        os.path.abspath(os.path.join(current_dir, "seed", f"{normalized_preset}.json")),
        os.path.abspath(os.path.join(os.getcwd(), "backend", "seed", f"{normalized_preset}.json")),
        os.path.abspath(os.path.join(os.getcwd(), "seed", f"{normalized_preset}.json")),
        os.path.abspath(f"seed/{normalized_preset}.json"),
        os.path.abspath(f"backend/seed/{normalized_preset}.json"),
        os.path.abspath(os.path.join(current_dir, "..", "seed", f"{preset}.json")),
        os.path.abspath(os.path.join(current_dir, "seed", f"{preset}.json"))
    ]

    seed_file = None
    for cp in candidate_paths:
        if os.path.exists(cp):
            seed_file = cp
            break

    if not seed_file:
        raise HTTPException(status_code=404, detail=f"Seed preset '{preset}' not found in paths: {candidate_paths}")

    with open(seed_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    for e in data.get("engineers", []):
        eng = Engineer(
            id=e["id"],
            dispatcher_id=dispatcher_id,
            name=e["name"],
            start_lat=e["start_lat"],
            start_lon=e["start_lon"],
            shift_start=e.get("shift_start", "09:00"),
            shift_end=e.get("shift_end", "22:00"),
            skills_json=json.dumps(e.get("skills", []), ensure_ascii=False),
            transport_type=e.get("transport_type", "Автомобиль"),
            status="active"
        )
        db.add(eng)

    for t in data.get("tasks", []):
        task = Task(
            id=t["id"],
            dispatcher_id=dispatcher_id,
            address=t["address"],
            district=t.get("district", ""),
            lat=t["lat"],
            lon=t["lon"],
            window_start=t.get("window_start", "09:00"),
            window_end=t.get("window_end", "22:00"),
            duration_min=t.get("duration_min", 45),
            required_skill=t.get("required_skill", "Локальные работы"),
            required_transport=t.get("required_transport"),
            priority=t.get("priority", "Обычная"),
            status="active",
            control_assigned_engineer=t.get("control_assigned_engineer")
        )
        db.add(task)

    disp = db.query(Dispatcher).filter(Dispatcher.id == dispatcher_id).first()
    if disp:
        disp.active_preset = normalized_preset

    db.commit()

def build_state_response(dispatcher_id: str, db: Session) -> StateResponse:
    disp = db.query(Dispatcher).filter(Dispatcher.id == dispatcher_id).first()
    engineers = db.query(Engineer).filter(Engineer.dispatcher_id == dispatcher_id).all()
    tasks = db.query(Task).filter(Task.dispatcher_id == dispatcher_id).all()
    schedule_records = (
        db.query(ScheduleRecord)
        .filter(ScheduleRecord.dispatcher_id == dispatcher_id)
        .order_by(ScheduleRecord.engineer_id, ScheduleRecord.order)
        .all()
    )
    metrics_rec = db.query(PlanMetricsRecord).filter(PlanMetricsRecord.dispatcher_id == dispatcher_id).first()

    routes_dict = {}
    for eng in engineers:
        routes_dict[eng.id] = {
            "engineer_id": eng.id,
            "engineer_name": eng.name,
            "transport_type": eng.transport_type,
            "skills": eng.skills,
            "start_lat": eng.start_lat,
            "start_lon": eng.start_lon,
            "shift_start": eng.shift_start,
            "shift_end": eng.shift_end,
            "stops": [],
            "total_distance_km": 0.0,
            "total_work_min": 0,
            "total_travel_min": 0
        }

    for sr in schedule_records:
        if sr.engineer_id in routes_dict:
            routes_dict[sr.engineer_id]["stops"].append(
                ScheduleStopOut(
                    task_id=sr.task_id,
                    address=sr.task_address,
                    district=sr.district,
                    lat=sr.lat,
                    lon=sr.lon,
                    order=sr.order,
                    arrival_time=sr.arrival_time,
                    start_time=sr.start_time,
                    end_time=sr.end_time,
                    travel_km=sr.travel_km,
                    travel_min=sr.travel_min,
                    required_skill=sr.required_skill,
                    priority=sr.priority
                )
            )
            routes_dict[sr.engineer_id]["total_distance_km"] = round(
                routes_dict[sr.engineer_id]["total_distance_km"] + sr.travel_km, 2
            )
            routes_dict[sr.engineer_id]["total_travel_min"] += sr.travel_min
            routes_dict[sr.engineer_id]["total_work_min"] += 45

    routes_out = [EngineerRouteOut(**r) for r in routes_dict.values()]

    metrics_out = None
    unassigned_tasks = []
    if metrics_rec:
        metrics_out = MetricsOut(
            baseline_engineers=metrics_rec.baseline_engineers,
            baseline_mileage=metrics_rec.baseline_mileage,
            optimized_engineers=metrics_rec.optimized_engineers,
            optimized_mileage=metrics_rec.optimized_mileage,
            assigned_count=metrics_rec.assigned_count,
            unassigned_count=metrics_rec.unassigned_count,
            mileage_reduction_pct=metrics_rec.mileage_reduction_pct,
            engineers_reduction_pct=metrics_rec.engineers_reduction_pct
        )
        try:
            unassigned_data = json.loads(metrics_rec.unassigned_json)
            unassigned_tasks = [UnassignedTaskOut(**u) for u in unassigned_data]
        except Exception:
            unassigned_tasks = []

    # Also include newly added tasks that are not yet in schedule and not in unassigned
    scheduled_task_ids = set(sr.task_id for sr in schedule_records)
    unassigned_ids = set(u.task_id for u in unassigned_tasks)
    for t in tasks:
        if t.status == "cancelled":
            continue
        if t.id not in scheduled_task_ids and t.id not in unassigned_ids:
            unassigned_tasks.append(UnassignedTaskOut(
                task_id=t.id,
                address=t.address,
                reason="Изменена: ожидает нажатия «Распланировать»",
                priority=t.priority
            ))

    if metrics_out:
        metrics_out.assigned_count = len(scheduled_task_ids)
        metrics_out.unassigned_count = len(unassigned_tasks)
        active_scheduled_engs = set(sr.engineer_id for sr in schedule_records)
        metrics_out.optimized_engineers = len(active_scheduled_engs)

    return StateResponse(
        dispatcher_id=dispatcher_id,
        active_preset=disp.active_preset if disp else "vostok",
        engineers=[
            EngineerOut(
                id=e.id,
                name=e.name,
                start_lat=e.start_lat,
                start_lon=e.start_lon,
                shift_start=e.shift_start,
                shift_end=e.shift_end,
                skills=e.skills,
                transport_type=e.transport_type,
                status=e.status or "active"
            )
            for e in engineers
        ],
        tasks=[
            TaskOut(
                id=t.id,
                address=t.address,
                district=t.district,
                lat=t.lat,
                lon=t.lon,
                window_start=t.window_start,
                window_end=t.window_end,
                duration_min=t.duration_min,
                required_skill=t.required_skill,
                required_transport=t.required_transport,
                priority=t.priority,
                status=t.status or "active",
                control_assigned_engineer=t.control_assigned_engineer
            )
            for t in tasks
        ],
        schedule=routes_out,
        metrics=metrics_out,
        unassigned_tasks=unassigned_tasks
    )

@router.get("/session/init", response_model=StateResponse)
async def session_init(disp: Dispatcher = Depends(get_or_create_dispatcher), db: Session = Depends(get_db)):
    metrics = db.query(PlanMetricsRecord).filter(PlanMetricsRecord.dispatcher_id == disp.id).first()
    if not metrics:
        await run_optimization_for_dispatcher(disp.id, db)
    return build_state_response(disp.id, db)

@router.post("/demo/seed", response_model=StateResponse)
async def seed_dataset(
    req: SeedRequest,
    disp: Dispatcher = Depends(get_or_create_dispatcher),
    db: Session = Depends(get_db)
):
    load_preset_to_db(disp.id, req.preset, db)
    await run_optimization_for_dispatcher(disp.id, db)
    return build_state_response(disp.id, db)

@router.get("/state", response_model=StateResponse)
def get_state(disp: Dispatcher = Depends(get_or_create_dispatcher), db: Session = Depends(get_db)):
    return build_state_response(disp.id, db)

@router.post("/engineers", response_model=EngineerOut)
def create_engineer(
    eng: EngineerCreate,
    disp: Dispatcher = Depends(get_or_create_dispatcher),
    db: Session = Depends(get_db)
):
    eng_id = eng.id or f"eng_{uuid.uuid4().hex[:6]}"
    new_eng = Engineer(
        id=eng_id,
        dispatcher_id=disp.id,
        name=eng.name,
        start_lat=eng.start_lat,
        start_lon=eng.start_lon,
        shift_start=eng.shift_start,
        shift_end=eng.shift_end,
        skills_json=json.dumps(eng.skills, ensure_ascii=False),
        transport_type=eng.transport_type,
        status="new"
    )
    db.add(new_eng)
    db.commit()
    db.refresh(new_eng)
    return EngineerOut(
        id=new_eng.id,
        name=new_eng.name,
        start_lat=new_eng.start_lat,
        start_lon=new_eng.start_lon,
        shift_start=new_eng.shift_start,
        shift_end=new_eng.shift_end,
        skills=new_eng.skills,
        transport_type=new_eng.transport_type,
        status=new_eng.status
    )

@router.delete("/engineers/{engineer_id}")
def delete_engineer(
    engineer_id: str,
    disp: Dispatcher = Depends(get_or_create_dispatcher),
    db: Session = Depends(get_db)
):
    eng = db.query(Engineer).filter(Engineer.dispatcher_id == disp.id, Engineer.id == engineer_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Инженер не найден")
    db.query(ScheduleRecord).filter(ScheduleRecord.dispatcher_id == disp.id, ScheduleRecord.engineer_id == engineer_id).delete()
    db.delete(eng)
    db.commit()
    return {"status": "ok", "deleted_id": engineer_id}

@router.post("/engineers/{engineer_id}/toggle_status", response_model=StateResponse)
def toggle_engineer_status(
    engineer_id: str,
    disp: Dispatcher = Depends(get_or_create_dispatcher),
    db: Session = Depends(get_db)
):
    eng = db.query(Engineer).filter(Engineer.dispatcher_id == disp.id, Engineer.id == engineer_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Инженер не найден")

    # Point 2: Engineer off-line is IRREVERSIBLE, all their tasks become unassigned
    eng.status = "unavailable"

    # Delete all schedule records for this engineer so their tasks become unassigned
    db.query(ScheduleRecord).filter(
        ScheduleRecord.dispatcher_id == disp.id,
        ScheduleRecord.engineer_id == engineer_id
    ).delete()

    # Invalidate cached explanations for this engineer
    db.query(ExplanationCache).filter(
        ExplanationCache.dispatcher_id == disp.id,
        ExplanationCache.assigned_engineer_id == engineer_id
    ).delete()

    db.commit()
    return build_state_response(disp.id, db)

@router.post("/tasks", response_model=TaskOut)
def create_task(
    task: TaskCreate,
    disp: Dispatcher = Depends(get_or_create_dispatcher),
    db: Session = Depends(get_db)
):
    task_id = task.id or f"task_{uuid.uuid4().hex[:6]}"
    new_task = Task(
        id=task_id,
        dispatcher_id=disp.id,
        address=task.address,
        district=task.district or "",
        lat=task.lat,
        lon=task.lon,
        window_start=task.window_start,
        window_end=task.window_end,
        duration_min=task.duration_min,
        required_skill=task.required_skill,
        required_transport=task.required_transport,
        priority=task.priority,
        status="new"
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return TaskOut(
        id=new_task.id,
        address=new_task.address,
        district=new_task.district,
        lat=new_task.lat,
        lon=new_task.lon,
        window_start=new_task.window_start,
        window_end=new_task.window_end,
        duration_min=new_task.duration_min,
        required_skill=new_task.required_skill,
        required_transport=new_task.required_transport,
        priority=new_task.priority,
        status=new_task.status
    )

@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: str,
    disp: Dispatcher = Depends(get_or_create_dispatcher),
    db: Session = Depends(get_db)
):
    t = db.query(Task).filter(Task.dispatcher_id == disp.id, Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    db.query(ScheduleRecord).filter(ScheduleRecord.dispatcher_id == disp.id, ScheduleRecord.task_id == task_id).delete()
    db.query(ExplanationCache).filter(ExplanationCache.dispatcher_id == disp.id, ExplanationCache.task_id == task_id).delete()
    db.delete(t)
    db.commit()
    return {"status": "ok", "deleted_id": task_id}

@router.post("/tasks/{task_id}/cancel")
def cancel_task(
    task_id: str,
    disp: Dispatcher = Depends(get_or_create_dispatcher),
    db: Session = Depends(get_db)
):
    t = db.query(Task).filter(Task.dispatcher_id == disp.id, Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    t.status = "cancelled"
    db.query(ScheduleRecord).filter(ScheduleRecord.dispatcher_id == disp.id, ScheduleRecord.task_id == task_id).delete()
    db.commit()
    return build_state_response(disp.id, db)

async def run_optimization_for_dispatcher(dispatcher_id: str, db: Session):
    engineers = db.query(Engineer).filter(Engineer.dispatcher_id == dispatcher_id, Engineer.status != "unavailable").all()
    tasks = db.query(Task).filter(Task.dispatcher_id == dispatcher_id, Task.status != "cancelled").all()

    eng_payload = [
        {
            "id": e.id,
            "name": e.name,
            "start_lat": e.start_lat,
            "start_lon": e.start_lon,
            "shift_start": e.shift_start,
            "shift_end": e.shift_end,
            "skills": e.skills,
            "transport_type": e.transport_type
        }
        for e in engineers
    ]

    task_payload = [
        {
            "id": t.id,
            "address": t.address,
            "district": t.district,
            "lat": t.lat,
            "lon": t.lon,
            "window_start": t.window_start,
            "window_end": t.window_end,
            "duration_min": t.duration_min,
            "required_skill": t.required_skill,
            "required_transport": t.required_transport,
            "priority": t.priority
        }
        for t in tasks
    ]

    algo_res = await call_optimize(eng_payload, task_payload)

    db.query(ScheduleRecord).filter(ScheduleRecord.dispatcher_id == dispatcher_id).delete()
    db.query(ExplanationCache).filter(ExplanationCache.dispatcher_id == dispatcher_id).delete()

    # Mark new tasks and engineers as active since they are now incorporated into the schedule
    for t in db.query(Task).filter(Task.dispatcher_id == dispatcher_id, Task.status == "new").all():
        t.status = "active"
    for e in db.query(Engineer).filter(Engineer.dispatcher_id == dispatcher_id, Engineer.status == "new").all():
        e.status = "active"

    for route in algo_res.get("optimized_routes", []):
        eng_id = route["engineer_id"]
        eng_name = route["engineer_name"]
        trans = route["transport_type"]
        for stop in route.get("stops", []):
            sr = ScheduleRecord(
                dispatcher_id=dispatcher_id,
                engineer_id=eng_id,
                engineer_name=eng_name,
                transport_type=trans,
                task_id=stop["task_id"],
                task_address=stop["address"],
                district=stop.get("district", ""),
                lat=stop["lat"],
                lon=stop["lon"],
                order=stop["order"],
                arrival_time=stop["arrival_time"],
                start_time=stop["start_time"],
                end_time=stop["end_time"],
                travel_km=stop["travel_km"],
                travel_min=stop["travel_min"],
                required_skill=stop["required_skill"],
                priority=stop["priority"]
            )
            db.add(sr)

    opt_m = algo_res.get("optimized_metrics", {})
    base_m = algo_res.get("baseline_metrics", {})
    unassigned = algo_res.get("unassigned_tasks", [])

    metrics_rec = db.query(PlanMetricsRecord).filter(PlanMetricsRecord.dispatcher_id == dispatcher_id).first()
    if not metrics_rec:
        metrics_rec = PlanMetricsRecord(dispatcher_id=dispatcher_id)
        db.add(metrics_rec)

    metrics_rec.baseline_engineers = base_m.get("total_engineers_used", 0)
    metrics_rec.baseline_mileage = base_m.get("total_mileage_km", 0.0)
    metrics_rec.optimized_engineers = opt_m.get("total_engineers_used", 0)
    metrics_rec.optimized_mileage = opt_m.get("total_mileage_km", 0.0)
    metrics_rec.assigned_count = opt_m.get("assigned_tasks_count", 0)
    metrics_rec.unassigned_count = opt_m.get("unassigned_tasks_count", 0)
    metrics_rec.mileage_reduction_pct = opt_m.get("mileage_reduction_pct")
    metrics_rec.engineers_reduction_pct = opt_m.get("engineers_reduction_pct")
    metrics_rec.unassigned_json = json.dumps(unassigned, ensure_ascii=False)

    db.commit()

@router.post("/schedule/optimize", response_model=StateResponse)
async def optimize_schedule(
    disp: Dispatcher = Depends(get_or_create_dispatcher),
    db: Session = Depends(get_db)
):
    await run_optimization_for_dispatcher(disp.id, db)
    return build_state_response(disp.id, db)

@router.post("/schedule/replan", response_model=StateResponse)
async def replan_schedule(
    req: ReplanRequestIn,
    disp: Dispatcher = Depends(get_or_create_dispatcher),
    db: Session = Depends(get_db)
):
    # Process status updates in DB without deleting
    for ev in req.events:
        if ev.event_type == "ENGINEER_UNAVAILABLE" and ev.engineer_id:
            eng = db.query(Engineer).filter(Engineer.dispatcher_id == disp.id, Engineer.id == ev.engineer_id).first()
            if eng:
                eng.status = "unavailable"
        elif ev.event_type == "CANCEL_TASK" and ev.task_id:
            t = db.query(Task).filter(Task.dispatcher_id == disp.id, Task.id == ev.task_id).first()
            if t:
                t.status = "cancelled"
        elif ev.event_type == "URGENT_TASK" and ev.task:
            task_id = ev.task.id or f"urgent_{uuid.uuid4().hex[:6]}"
            new_task = Task(
                id=task_id,
                dispatcher_id=disp.id,
                address=ev.task.address,
                district=ev.task.district or "",
                lat=ev.task.lat,
                lon=ev.task.lon,
                window_start=ev.task.window_start,
                window_end=ev.task.window_end,
                duration_min=ev.task.duration_min,
                required_skill=ev.task.required_skill,
                required_transport=ev.task.required_transport,
                priority="Срочная",
                status="active"
            )
            db.add(new_task)
    db.commit()

    # Reconstruct current schedule routes
    state = build_state_response(disp.id, db)
    current_schedule_payload = [r.model_dump() for r in state.schedule]
    engineers_payload = [e.model_dump() for e in state.engineers if e.status != "unavailable"]
    events_payload = [ev.model_dump() for ev in req.events]

    algo_res = await call_replan(current_schedule_payload, engineers_payload, events_payload)

    db.query(ScheduleRecord).filter(ScheduleRecord.dispatcher_id == disp.id).delete()

    for route in algo_res.get("updated_routes", []):
        eng_id = route["engineer_id"]
        eng_name = route["engineer_name"]
        trans = route["transport_type"]
        for stop in route.get("stops", []):
            sr = ScheduleRecord(
                dispatcher_id=disp.id,
                engineer_id=eng_id,
                engineer_name=eng_name,
                transport_type=trans,
                task_id=stop["task_id"],
                task_address=stop["address"],
                district=stop.get("district", ""),
                lat=stop["lat"],
                lon=stop["lon"],
                order=stop["order"],
                arrival_time=stop["arrival_time"],
                start_time=stop["start_time"],
                end_time=stop["end_time"],
                travel_km=stop["travel_km"],
                travel_min=stop["travel_min"],
                required_skill=stop["required_skill"],
                priority=stop["priority"]
            )
            db.add(sr)

    m = algo_res.get("metrics", {})
    unassigned = algo_res.get("unassigned_tasks", [])
    metrics_rec = db.query(PlanMetricsRecord).filter(PlanMetricsRecord.dispatcher_id == disp.id).first()
    if metrics_rec:
        metrics_rec.optimized_engineers = m.get("total_engineers_used", 0)
        metrics_rec.optimized_mileage = m.get("total_mileage_km", 0.0)
        metrics_rec.assigned_count = m.get("assigned_tasks_count", 0)
        metrics_rec.unassigned_count = m.get("unassigned_tasks_count", 0)
        metrics_rec.unassigned_json = json.dumps(unassigned, ensure_ascii=False)

    # Mark new tasks and engineers as active since they are now incorporated into the schedule
    for t in db.query(Task).filter(Task.dispatcher_id == disp.id, Task.status == "new").all():
        t.status = "active"
    for e in db.query(Engineer).filter(Engineer.dispatcher_id == disp.id, Engineer.status == "new").all():
        e.status = "active"

    db.commit()
    return build_state_response(disp.id, db)

@router.get("/tasks/{task_id}/explanation", response_model=ExplanationOut)
async def get_task_explanation(
    task_id: str,
    disp: Dispatcher = Depends(get_or_create_dispatcher),
    db: Session = Depends(get_db)
):
    cached = (
        db.query(ExplanationCache)
        .filter(ExplanationCache.dispatcher_id == disp.id, ExplanationCache.task_id == task_id)
        .first()
    )
    if cached:
        return ExplanationOut(
            task_id=task_id,
            assigned_engineer_id=cached.assigned_engineer_id,
            explanation=cached.explanation_text,
            cached=True
        )

    sr = (
        db.query(ScheduleRecord)
        .filter(ScheduleRecord.dispatcher_id == disp.id, ScheduleRecord.task_id == task_id)
        .first()
    )
    task = db.query(Task).filter(Task.dispatcher_id == disp.id, Task.id == task_id).first()

    all_engs = db.query(Engineer).filter(Engineer.dispatcher_id == disp.id).all()
    all_tasks = db.query(Task).filter(Task.dispatcher_id == disp.id, Task.status != "cancelled").all()
    all_records = db.query(ScheduleRecord).filter(ScheduleRecord.dispatcher_id == disp.id).all()

    assigned_id = sr.engineer_id if sr else None

    # Find candidate alternatives
    candidates = []
    for e in all_engs:
        if e.id != assigned_id:
            candidates.append({
                "id": e.id,
                "name": e.name,
                "transport": e.transport_type,
                "has_skill": (task.required_skill in e.skills) if task else False,
                "status": e.status
            })

    context = {
        "address": sr.task_address if sr else (task.address if task else "Москва"),
        "district": sr.district if sr else (task.district if task else ""),
        "priority": sr.priority if sr else (task.priority if task else "Обычная"),
        "engineer_name": sr.engineer_name if sr else "Инженер",
        "required_skill": sr.required_skill if sr else (task.required_skill if task else "Локальные работы"),
        "transport_type": sr.transport_type if sr else "Автомобиль",
        "arrival_time": sr.arrival_time if sr else "18:00",
        "window": f"{task.window_start} - {task.window_end}" if task else "18:00 - 20:00",
        "travel_km": sr.travel_km if sr else 2.1,
        "travel_min": sr.travel_min if sr else 15,
        "total_tasks_count": len(all_tasks),
        "total_engineers_count": len(all_engs),
        "active_engineers_count": len(set(r.engineer_id for r in all_records)),
        "alternative_candidates": candidates[:4]
    }

    if not sr:
        context["type"] = "task_unassigned"
        context["reason"] = (
            "Изменена: ожидает нажатия «Распланировать»"
            if (task and task.status == "new")
            else "Превышение временных окон или дефицит свободных бригад"
        )

    try:
        algo_res = await call_explain(task_id, assigned_id, context)
        text = algo_res.get("explanation", "Обоснование сформировано")
    except Exception as e:
        # Fallback generator directly in backend if service is slow/unreachable
        if not sr:
            text = (
                f"### Обоснование нераспределенной заявки #{task_id}\n\n"
                f"В секторе находится {context['total_tasks_count']} заявок и {context['total_engineers_count']} инженеров "
                f"(активно: {context['active_engineers_count']}).\n\n"
                f"Заявка по адресу **{context['address']}** (приоритет: {context['priority']}, требуемый навык: «{context['required_skill']}», окно: {context['window']}) "
                f"в настоящее время **не назначена** на исполнителя: {context.get('reason', 'Ограничения смен и логистической доступности')}."
            )
        else:
            text = (
                f"### Обоснование назначения заявки #{task_id}\n\n"
                f"В секторе находится {context['total_tasks_count']} заявок и {context['total_engineers_count']} инженеров "
                f"(активно: {context['active_engineers_count']}).\n\n"
                f"Заявка по адресу **{context['address']}** (приоритет: {context['priority']}) успешно назначена "
                f"**{context['engineer_name']}** на основе многокритериального VRPTW-отбора:\n\n"
                f"1. **Квалификация:** Требуемый навык *«{context['required_skill']}»* подтвержден в профиле исполнителя.\n"
                f"2. **Транспортная доступность:** Используется {context['transport_type']}, расчетный доезд {context['travel_km']} км ({context['travel_min']} мин).\n"
                f"3. **Временное окно:** Прибытие к {context['arrival_time']} укладывается в окно клиента ({context['window']})."
            )

    new_cache = ExplanationCache(
        dispatcher_id=disp.id,
        task_id=task_id,
        assigned_engineer_id=assigned_id,
        explanation_text=text
    )
    db.add(new_cache)
    db.commit()

    return ExplanationOut(
        task_id=task_id,
        assigned_engineer_id=assigned_id,
        explanation=text,
        cached=False
    )

@router.get("/engineers/{engineer_id}/explanation", response_model=ExplanationOut)
async def get_engineer_explanation(
    engineer_id: str,
    disp: Dispatcher = Depends(get_or_create_dispatcher),
    db: Session = Depends(get_db)
):
    cache_key = f"eng_exp_{engineer_id}"
    cached = (
        db.query(ExplanationCache)
        .filter(ExplanationCache.dispatcher_id == disp.id, ExplanationCache.task_id == cache_key)
        .first()
    )
    if cached:
        return ExplanationOut(
            task_id=cache_key,
            assigned_engineer_id=engineer_id,
            explanation=cached.explanation_text,
            cached=True
        )

    eng = db.query(Engineer).filter(Engineer.dispatcher_id == disp.id, Engineer.id == engineer_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Инженер не найден")

    stops = db.query(ScheduleRecord).filter(
        ScheduleRecord.dispatcher_id == disp.id, 
        ScheduleRecord.engineer_id == engineer_id
    ).order_by(ScheduleRecord.order).all()
    stops_count = len(stops)

    total_km = round(sum(s.travel_km for s in stops), 2)
    total_min = sum(s.travel_min for s in stops)

    all_engs = db.query(Engineer).filter(Engineer.dispatcher_id == disp.id).all()
    all_tasks = db.query(Task).filter(Task.dispatcher_id == disp.id, Task.status != "cancelled").all()
    all_records = db.query(ScheduleRecord).filter(ScheduleRecord.dispatcher_id == disp.id).all()

    context = {
        "type": "engineer_idle" if stops_count == 0 else "engineer_route",
        "is_idle": (stops_count == 0),
        "engineer_name": eng.name,
        "transport_type": eng.transport_type,
        "shift": f"{eng.shift_start} - {eng.shift_end}",
        "skills": eng.skills,
        "stops_count": stops_count,
        "total_travel_km": total_km,
        "total_travel_min": total_min,
        "first_start": stops[0].start_time if stops else eng.shift_start,
        "last_end": stops[-1].end_time if stops else eng.shift_end,
        "total_tasks_count": len(all_tasks),
        "total_engineers_count": len(all_engs),
        "active_engineers_count": len(set(r.engineer_id for r in all_records))
    }

    try:
        algo_res = await call_explain(cache_key, engineer_id, context)
        text = algo_res.get("explanation", "Обоснование сформировано")
    except Exception:
        text = (
            f"### Обоснование статуса: {eng.name}\n\n"
            f"В секторе находится {context['total_tasks_count']} задач и {context['total_engineers_count']} специалистов.\n\n"
            f"Инженер **{eng.name}** ({eng.transport_type}, смена {eng.shift_start}–{eng.shift_end}) "
            f"находится в оперативном резерве согласно критериям оптимизации ТЗ Билайн:\n\n"
            f"1. **Минимизация штата:** Все задачи распределены с наименьшим числом исполнителей без перегрузки смен.\n"
            f"2. **Резерв:** Специалист дежурит для экстренного перекрытия аварий и замены заболевших сотрудников."
        )

    new_cache = ExplanationCache(
        dispatcher_id=disp.id,
        task_id=cache_key,
        assigned_engineer_id=engineer_id,
        explanation_text=text
    )
    db.add(new_cache)
    db.commit()

    return ExplanationOut(
        task_id=cache_key,
        assigned_engineer_id=engineer_id,
        explanation=text,
        cached=False
    )

@router.post("/session/reset", response_model=StateResponse)
def reset_session(disp: Dispatcher = Depends(get_or_create_dispatcher), db: Session = Depends(get_db)):
    db.query(ScheduleRecord).filter(ScheduleRecord.dispatcher_id == disp.id).delete()
    db.query(ExplanationCache).filter(ExplanationCache.dispatcher_id == disp.id).delete()
    db.query(PlanMetricsRecord).filter(PlanMetricsRecord.dispatcher_id == disp.id).delete()
    db.query(Task).filter(Task.dispatcher_id == disp.id).delete()
    db.query(Engineer).filter(Engineer.dispatcher_id == disp.id).delete()
    db.commit()
    return build_state_response(disp.id, db)
