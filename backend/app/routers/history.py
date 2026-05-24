from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import WateringHistory, ZoneConfig, HistoryItem, HistoryResponse

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("", response_model=HistoryResponse)
def get_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    zone_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(WateringHistory)
    if zone_id:
        query = query.filter(WateringHistory.zone_id == zone_id)

    total = query.count()
    rows = (
        query.order_by(WateringHistory.started_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    zone_names = {c.zone_id: c.name for c in db.query(ZoneConfig).all()}

    items = [
        HistoryItem(
            id=row.id,
            zone_id=row.zone_id,
            zone_name=zone_names.get(row.zone_id, f"Zone {row.zone_id}"),
            started_at=row.started_at,
            ended_at=row.ended_at,
            duration_minutes=row.duration_minutes,
            trigger_type=row.trigger_type,
            schedule_id=row.schedule_id,
        )
        for row in rows
    ]

    return HistoryResponse(
        items=items,
        total=total,
        page=page,
        pages=max(1, (total + limit - 1) // limit),
    )
