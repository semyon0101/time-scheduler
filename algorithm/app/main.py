from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import (
    OptimizeRequest, OptimizeResponse,
    ReplanRequest, ReplanResponse,
    ExplainRequest, ExplainResponse
)
from app.solvers.baseline import solve_baseline
from app.solvers.optimizer import solve_vrptw
from app.solvers.replanner import apply_batch_replanning
from app.xai.explainer import generate_explanation

app = FastAPI(
    title="Time Scheduler Algorithm Service",
    description="Stateless VRPTW Optimization & Explainable AI Engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "algorithm-engine"}

@app.post("/api/v1/optimize", response_model=OptimizeResponse)
def optimize_schedule(req: OptimizeRequest):
    # 1. Baseline FIFO calculation
    base_routes, base_metrics, base_unassigned = solve_baseline(req.engineers, req.tasks)

    # 2. Smart VRPTW optimization
    opt_routes, opt_metrics, opt_unassigned = solve_vrptw(req.engineers, req.tasks)

    # 3. Calculate percentage improvements
    if base_metrics.total_mileage_km > 0:
        mileage_delta = base_metrics.total_mileage_km - opt_metrics.total_mileage_km
        opt_metrics.mileage_reduction_pct = round((mileage_delta / base_metrics.total_mileage_km) * 100, 1)

    if base_metrics.total_engineers_used > 0:
        eng_delta = base_metrics.total_engineers_used - opt_metrics.total_engineers_used
        opt_metrics.engineers_reduction_pct = round((eng_delta / base_metrics.total_engineers_used) * 100, 1)

    return OptimizeResponse(
        baseline_metrics=base_metrics,
        baseline_routes=base_routes,
        optimized_metrics=opt_metrics,
        optimized_routes=opt_routes,
        unassigned_tasks=opt_unassigned
    )

@app.post("/api/v1/replan", response_model=ReplanResponse)
def replan_schedule(req: ReplanRequest):
    updated_routes, metrics, unassigned, diff = apply_batch_replanning(
        req.current_schedule,
        req.engineers,
        req.events
    )
    return ReplanResponse(
        updated_routes=updated_routes,
        unassigned_tasks=unassigned,
        metrics=metrics,
        diff=diff
    )

@app.post("/api/v1/explain", response_model=ExplainResponse)
async def explain_decision(req: ExplainRequest):
    text = generate_explanation(req.task_id, req.assigned_engineer_id, req.context)
    return ExplainResponse(
        task_id=req.task_id,
        assigned_engineer_id=req.assigned_engineer_id,
        explanation=text
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
