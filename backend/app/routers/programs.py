import asyncio
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    IrrigationProgram, ProgramZone, WateringHistory,
    ProgramSchema, ProgramCreateRequest, ProgramUpdateRequest, ProgramZoneSchema,
)
from ..services.scheduler import scheduler, _days_to_apscheduler
from apscheduler.triggers.cron import CronTrigger  # type: ignore

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/programs", tags=["programs"])


def _build_schema(prog: IrrigationProgram, db: Session) -> ProgramSchema:
    zones = (
        db.query(ProgramZone)
        .filter(ProgramZone.program_id == prog.id)
        .order_by(ProgramZone.order)
        .all()
    )
    return ProgramSchema(
        id=prog.id,
        name=prog.name,
        days_of_week=prog.days_of_week,
        start_time=prog.start_time,
        enabled=prog.enabled,
        created_at=prog.created_at,
        zones=[ProgramZoneSchema(zone_id=z.zone_id, duration_minutes=z.duration_minutes, order=z.order) for z in zones],
    )


def _upsert_program_job(prog: IrrigationProgram):
    hour, minute = prog.start_time.split(":")
    scheduler.add_job(
        _run_program_job,
        CronTrigger(
            day_of_week=_days_to_apscheduler(prog.days_of_week),
            hour=int(hour),
            minute=int(minute),
        ),
        id=f"program_{prog.id}",
        args=[prog.id],
        replace_existing=True,
    )


def _remove_program_job(program_id: int):
    job_id = f"program_{program_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


async def _run_program_job(program_id: int):
    """Execute all zones of a program sequentially."""
    from ..database import SessionLocal
    from ..services.rainbird import rainbird_service
    from ..models import AppSettings
    from ..services.weather import get_today_precipitation

    db: Session = SessionLocal()
    try:
        prog = db.query(IrrigationProgram).filter(IrrigationProgram.id == program_id).first()
        if not prog:
            return

        # Weather inhibition check
        if prog.skip_on_rain:
            lat_row = db.query(AppSettings).filter(AppSettings.key == "weather_lat").first()
            lon_row = db.query(AppSettings).filter(AppSettings.key == "weather_lon").first()
            threshold_row = db.query(AppSettings).filter(AppSettings.key == "rain_threshold_mm").first()
            if lat_row and lon_row:
                threshold = float(threshold_row.value) if threshold_row else 2.0
                try:
                    precip = await get_today_precipitation(float(lat_row.value), float(lon_row.value))
                    if precip > threshold:
                        logger.info(
                            "Program %d '%s' skipped: %.1f mm rain forecast (threshold %.1f mm)",
                            program_id, prog.name, precip, threshold,
                        )
                        return
                except Exception as e:
                    logger.warning("Weather check failed for program %d: %s", program_id, e)

        refill = getattr(prog, "refill_minutes", 60) or 60

        zones = (
            db.query(ProgramZone)
            .filter(ProgramZone.program_id == program_id)
            .order_by(ProgramZone.order)
            .all()
        )

        for pz in zones:
            # Wait up to 2 minutes if another zone is already running
            for _ in range(24):
                status = rainbird_service.get_status()
                if not status.active_zone:
                    break
                await asyncio.sleep(5)
            else:
                logger.warning("Program %d: zone %d skipped (controller busy)", program_id, pz.zone_id)
                continue

            ok = rainbird_service.start_zone(pz.zone_id, pz.duration_minutes)
            if not ok:
                logger.error("Program %d: failed to start zone %d", program_id, pz.zone_id)
                continue

            db.add(WateringHistory(
                zone_id=pz.zone_id,
                started_at=datetime.utcnow(),
                duration_minutes=pz.duration_minutes,
                trigger_type="program",
                schedule_id=program_id,
            ))
            db.commit()

            # Wait for zone to finish, then refill pause before next zone
            await asyncio.sleep(pz.duration_minutes * 60 + refill * 60)

    finally:
        db.close()


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProgramSchema])
def list_programs(db: Session = Depends(get_db)):
    progs = db.query(IrrigationProgram).order_by(IrrigationProgram.created_at.desc()).all()
    return [_build_schema(p, db) for p in progs]


@router.post("", response_model=ProgramSchema, status_code=201)
def create_program(req: ProgramCreateRequest, db: Session = Depends(get_db)):
    active_zones = [(i, z) for i, z in enumerate(req.zones) if z.duration_minutes > 0]
    if not active_zones:
        raise HTTPException(status_code=422, detail="At least one zone must have duration > 0")

    prog = IrrigationProgram(
        name=req.name,
        days_of_week=req.days_of_week,
        start_time=req.start_time,
        refill_minutes=req.refill_minutes,
        skip_on_rain=req.skip_on_rain,
        enabled=req.enabled,
    )
    db.add(prog)
    db.flush()

    for order, (_, z) in enumerate(active_zones):
        db.add(ProgramZone(
            program_id=prog.id,
            zone_id=z.zone_id,
            duration_minutes=z.duration_minutes,
            order=order,
        ))
    db.commit()
    db.refresh(prog)

    _upsert_program_job(prog)
    return _build_schema(prog, db)


@router.patch("/{program_id}", response_model=ProgramSchema)
def update_program(program_id: int, req: ProgramUpdateRequest, db: Session = Depends(get_db)):
    prog = db.query(IrrigationProgram).filter(IrrigationProgram.id == program_id).first()
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")

    for field, value in req.model_dump(exclude_unset=True, exclude={"zones"}).items():
        if hasattr(prog, field):
            setattr(prog, field, value)

    if req.zones is not None:
        db.query(ProgramZone).filter(ProgramZone.program_id == program_id).delete()
        for order, z in enumerate(z for z in req.zones if z.duration_minutes > 0):
            db.add(ProgramZone(
                program_id=prog.id,
                zone_id=z.zone_id,
                duration_minutes=z.duration_minutes,
                order=order,
            ))

    db.commit()
    db.refresh(prog)

    _remove_program_job(program_id)
    if prog.enabled:
        _upsert_program_job(prog)

    return _build_schema(prog, db)


@router.delete("/{program_id}", status_code=204)
def delete_program(program_id: int, db: Session = Depends(get_db)):
    prog = db.query(IrrigationProgram).filter(IrrigationProgram.id == program_id).first()
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")
    _remove_program_job(program_id)
    db.query(ProgramZone).filter(ProgramZone.program_id == program_id).delete()
    db.delete(prog)
    db.commit()


@router.post("/{program_id}/toggle", response_model=ProgramSchema)
def toggle_program(program_id: int, db: Session = Depends(get_db)):
    prog = db.query(IrrigationProgram).filter(IrrigationProgram.id == program_id).first()
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")
    prog.enabled = not prog.enabled
    db.commit()
    db.refresh(prog)

    if prog.enabled:
        _upsert_program_job(prog)
    else:
        _remove_program_job(program_id)

    return _build_schema(prog, db)


@router.post("/{program_id}/run", status_code=202)
async def run_now(program_id: int, db: Session = Depends(get_db)):
    """Trigger a program immediately (outside its schedule)."""
    prog = db.query(IrrigationProgram).filter(IrrigationProgram.id == program_id).first()
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")
    asyncio.create_task(_run_program_job(program_id))
    return {"status": "started", "program_id": program_id}


def load_programs_from_db(db: Session):
    for prog in db.query(IrrigationProgram).filter(IrrigationProgram.enabled.is_(True)).all():
        _upsert_program_job(prog)
