import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, SessionLocal
from .models import Base
from .services.rainbird import rainbird_service
from .services.scheduler import scheduler, load_schedules_from_db
from .routers import zones, schedules, history, ws, programs
from .routers import settings as settings_router
from .routers import weather as weather_router
from .routers.programs import load_programs_from_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    rainbird_service.initialize()

    db = SessionLocal()
    try:
        load_schedules_from_db(db)
        load_programs_from_db(db)
    finally:
        db.close()

    scheduler.start()
    polling_task = asyncio.create_task(ws.polling_loop())

    yield

    polling_task.cancel()
    scheduler.shutdown(wait=False)


app = FastAPI(title="SmartBird API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(zones.router)
app.include_router(schedules.router)
app.include_router(programs.router)
app.include_router(history.router)
app.include_router(ws.router)
app.include_router(settings_router.router)
app.include_router(weather_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
