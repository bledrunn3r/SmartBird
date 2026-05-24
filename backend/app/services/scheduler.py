from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore
from apscheduler.triggers.cron import CronTrigger  # type: ignore
from datetime import datetime
from sqlalchemy.orm import Session
from ..models import Schedule, WateringHistory
from .rainbird import rainbird_service

scheduler = AsyncIOScheduler()


def _days_to_apscheduler(days_of_week: str) -> str:
    """Convert "1,3,5" (Mon=1 … Sun=7) to APScheduler format (mon,wed,fri)."""
    names = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    return ",".join(names[int(d) - 1] for d in days_of_week.split(",") if d)


async def _run_schedule(schedule_id: int, zone_id: int, duration_minutes: int):
    from ..database import SessionLocal

    status = rainbird_service.get_status()
    if status.active_zone:
        return  # another zone is already running — skip

    success = rainbird_service.start_zone(zone_id, duration_minutes)
    if not success:
        return

    db: Session = SessionLocal()
    try:
        db.add(
            WateringHistory(
                zone_id=zone_id,
                started_at=datetime.utcnow(),
                duration_minutes=duration_minutes,
                trigger_type="schedule",
                schedule_id=schedule_id,
            )
        )
        db.commit()
    finally:
        db.close()


def add_schedule_job(schedule: Schedule):
    hour, minute = schedule.start_time.split(":")
    scheduler.add_job(
        _run_schedule,
        CronTrigger(
            day_of_week=_days_to_apscheduler(schedule.days_of_week),
            hour=int(hour),
            minute=int(minute),
        ),
        id=f"schedule_{schedule.id}",
        args=[schedule.id, schedule.zone_id, schedule.duration_minutes],
        replace_existing=True,
    )


def remove_schedule_job(schedule_id: int):
    job_id = f"schedule_{schedule_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)


def load_schedules_from_db(db: Session):
    for schedule in db.query(Schedule).filter(Schedule.enabled.is_(True)).all():
        add_schedule_job(schedule)
