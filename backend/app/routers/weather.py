from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AppSettings, WeatherDay
from ..services.weather import get_forecast

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("/forecast", response_model=list[WeatherDay])
async def forecast(db: Session = Depends(get_db)):
    lat_row = db.query(AppSettings).filter(AppSettings.key == "weather_lat").first()
    lon_row = db.query(AppSettings).filter(AppSettings.key == "weather_lon").first()
    threshold_row = db.query(AppSettings).filter(AppSettings.key == "rain_threshold_mm").first()

    if not lat_row or not lon_row:
        raise HTTPException(status_code=404, detail="Location not configured")

    threshold = float(threshold_row.value) if threshold_row else 2.0
    return await get_forecast(float(lat_row.value), float(lon_row.value), threshold)
