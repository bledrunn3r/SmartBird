from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AppSettings, AppSettingsSchema

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get(db: Session, key: str, default: str | None = None) -> str | None:
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    return row.value if row else default


def _set(db: Session, key: str, value: str) -> None:
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSettings(key=key, value=value))


@router.get("", response_model=AppSettingsSchema)
def get_settings(db: Session = Depends(get_db)):
    lat = _get(db, "weather_lat")
    lon = _get(db, "weather_lon")
    threshold = _get(db, "rain_threshold_mm", "2.0")
    return AppSettingsSchema(
        lat=float(lat) if lat else None,
        lon=float(lon) if lon else None,
        rain_threshold_mm=float(threshold),
    )


@router.put("", response_model=AppSettingsSchema)
def update_settings(payload: AppSettingsSchema, db: Session = Depends(get_db)):
    if payload.lat is not None:
        _set(db, "weather_lat", str(payload.lat))
    if payload.lon is not None:
        _set(db, "weather_lon", str(payload.lon))
    _set(db, "rain_threshold_mm", str(payload.rain_threshold_mm))
    db.commit()
    return get_settings(db)
