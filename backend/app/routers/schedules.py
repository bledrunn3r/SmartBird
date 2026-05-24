from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Schedule, ScheduleSchema, ScheduleCreateRequest, ScheduleUpdateRequest
from ..services.scheduler import add_schedule_job, remove_schedule_job

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


@router.get("", response_model=list[ScheduleSchema])
def list_schedules(db: Session = Depends(get_db)):
    return db.query(Schedule).order_by(Schedule.created_at.desc()).all()


@router.post("", response_model=ScheduleSchema, status_code=201)
def create_schedule(req: ScheduleCreateRequest, db: Session = Depends(get_db)):
    schedule = Schedule(**req.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    add_schedule_job(schedule)
    return schedule


@router.patch("/{schedule_id}", response_model=ScheduleSchema)
def update_schedule(schedule_id: int, req: ScheduleUpdateRequest, db: Session = Depends(get_db)):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(schedule, field, value)
    db.commit()
    db.refresh(schedule)

    remove_schedule_job(schedule_id)
    if schedule.enabled:
        add_schedule_job(schedule)
    return schedule


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    remove_schedule_job(schedule_id)
    db.delete(schedule)
    db.commit()


@router.post("/{schedule_id}/toggle", response_model=ScheduleSchema)
def toggle_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    schedule.enabled = not schedule.enabled
    db.commit()
    db.refresh(schedule)

    if schedule.enabled:
        add_schedule_job(schedule)
    else:
        remove_schedule_job(schedule_id)
    return schedule
