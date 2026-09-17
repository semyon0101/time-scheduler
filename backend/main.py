from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.Controllers.router import root_router, v1_router
from backend.Entities.database import create_tables
from backend.Models.settings import get_settings

settings = get_settings()

# Initialize database schema
create_tables()

app = FastAPI(
    title="Time Scheduler Backend API",
    description="Layered Architecture Core Management & Persistence Gateway for Dispatchers",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(root_router)
app.include_router(v1_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.host, port=settings.port)
