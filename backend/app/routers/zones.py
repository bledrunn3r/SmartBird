from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import ZoneConfig, WateringHistory, ZoneStatus, ZoneStartRequest, ZoneUpdateRequest
from ..services.rainbird import rainbird_service

router = APIRouter(prefix="/api/zones", tags=["zones"])


def _ensure_zone_configs(db: Session, available: list[int]):
    existing = {c.zone_id for c in db.query(ZoneConfig).all()}
    for zone_id in available:
        if zone_id not in existing:
            db.add(ZoneConfig(zone_id=zone_id, name=f"Zone {zone_id}"))
    db.commit()


@router.get("", response_model=list[ZoneStatus])
def list_zones(db: Session = Depends(get_db)):
    available = rainbird_service.get_available_zones()
    _ensure_zone_configs(db, available)

    status = rainbird_service.get_status()
    configs = {c.zone_id: c for c in db.query(ZoneConfig).all()}

    return [
        ZoneStatus(
            zone_id=zone_id,
            name=configs[zone_id].name,
            is_active=status.active_zone == zone_id,
            minutes_remaining=status.minutes_remaining if status.active_zone == zone_id else None,
        )
        for zone_id in available
    ]


@router.patch("/{zone_id}", response_model=ZoneStatus)
def update_zone(zone_id: int, req: ZoneUpdateRequest, db: Session = Depends(get_db)):
    config = db.query(ZoneConfig).filter(ZoneConfig.zone_id == zone_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Zone not found")

    if req.name is not None:
        config.name = req.name
    if req.enabled is not None:
        config.enabled = req.enabled
    db.commit()

    status = rainbird_service.get_status()
    return ZoneStatus(
        zone_id=zone_id,
        name=config.name,
        is_active=status.active_zone == zone_id,
        minutes_remaining=status.minutes_remaining if status.active_zone == zone_id else None,
    )


@router.post("/{zone_id}/start")
def start_zone(zone_id: int, req: ZoneStartRequest, db: Session = Depends(get_db)):
    available = rainbird_service.get_available_zones()
    if zone_id not in available:
        raise HTTPException(status_code=404, detail="Zone not found")

    status = rainbird_service.get_status()
    if status.active_zone and status.active_zone != zone_id:
        raise HTTPException(
            status_code=409,
            detail=f"Zone {status.active_zone} is already running",
        )

    if not rainbird_service.start_zone(zone_id, req.duration_minutes):
        raise HTTPException(status_code=500, detail="Failed to start zone")

    db.add(
        WateringHistory(
            zone_id=zone_id,
            started_at=datetime.utcnow(),
            duration_minutes=req.duration_minutes,
            trigger_type="manual",
        )
    )
    db.commit()
    return {"status": "started", "zone_id": zone_id, "duration_minutes": req.duration_minutes}


@router.post("/stop")
def stop_zones(db: Session = Depends(get_db)):
    status = rainbird_service.get_status()
    if status.active_zone:
        # Close the open history entry for the active zone
        history = (
            db.query(WateringHistory)
            .filter(
                WateringHistory.zone_id == status.active_zone,
                WateringHistory.ended_at.is_(None),
            )
            .order_by(WateringHistory.started_at.desc())
            .first()
        )
        if history:
            history.ended_at = datetime.utcnow()
            db.commit()

    rainbird_service.stop_all()
    return {"status": "stopped"}
