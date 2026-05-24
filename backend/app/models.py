from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from pydantic import BaseModel
from .database import Base


# ── SQLAlchemy ORM models ─────────────────────────────────────────────────────

class ZoneConfig(Base):
    __tablename__ = "zone_configs"
    zone_id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    enabled = Column(Boolean, default=True)


class WateringHistory(Base):
    __tablename__ = "watering_history"
    id = Column(Integer, primary_key=True, autoincrement=True)
    zone_id = Column(Integer, nullable=False)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=False)
    trigger_type = Column(String(20), nullable=False)  # 'manual' | 'schedule'
    schedule_id = Column(Integer, nullable=True)


class IrrigationProgram(Base):
    """Multi-zone sequential program, mirrors RainBird programs A/B/C."""
    __tablename__ = "irrigation_programs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    days_of_week = Column(String(50), nullable=False)  # "1,3,5"
    start_time = Column(String(5), nullable=False)     # "06:00"
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    refill_minutes = Column(Integer, default=60)       # wait between zones
    skip_on_rain = Column(Boolean, default=True)       # inhibit if rain forecast


class AppSettings(Base):
    """Key-value store for application configuration (weather coords, thresholds)."""
    __tablename__ = "app_settings"
    key = Column(String(100), primary_key=True)
    value = Column(String(500), nullable=True)


class ProgramZone(Base):
    """One zone step within an IrrigationProgram, executed in order."""
    __tablename__ = "program_zones"
    id = Column(Integer, primary_key=True, autoincrement=True)
    program_id = Column(Integer, ForeignKey("irrigation_programs.id", ondelete="CASCADE"), nullable=False)
    zone_id = Column(Integer, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    order = Column(Integer, nullable=False)


class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    zone_id = Column(Integer, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    days_of_week = Column(String(50), nullable=False)  # "1,3,5" (Mon=1 … Sun=7)
    start_time = Column(String(5), nullable=False)     # "06:30"
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ZoneStatus(BaseModel):
    zone_id: int
    name: str
    is_active: bool
    minutes_remaining: Optional[float] = None


class ZoneStartRequest(BaseModel):
    duration_minutes: int


class ZoneUpdateRequest(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None


class ControllerStatus(BaseModel):
    active_zone: Optional[int] = None
    minutes_remaining: Optional[float] = None
    rain_sensor: bool = False
    timestamp: datetime


class HistoryItem(BaseModel):
    id: int
    zone_id: int
    zone_name: str
    started_at: datetime
    ended_at: Optional[datetime]
    duration_minutes: int
    trigger_type: str
    schedule_id: Optional[int]


class HistoryResponse(BaseModel):
    items: List[HistoryItem]
    total: int
    page: int
    pages: int


class ScheduleSchema(BaseModel):
    id: int
    name: str
    zone_id: int
    duration_minutes: int
    days_of_week: str
    start_time: str
    enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ScheduleCreateRequest(BaseModel):
    name: str
    zone_id: int
    duration_minutes: int
    days_of_week: str  # "1,3,5"
    start_time: str    # "06:30"


class ScheduleUpdateRequest(BaseModel):
    name: Optional[str] = None
    zone_id: Optional[int] = None
    duration_minutes: Optional[int] = None
    days_of_week: Optional[str] = None
    start_time: Optional[str] = None
    enabled: Optional[bool] = None


# ── Programs (multi-zone sequential) ─────────────────────────────────────────

class ProgramZoneIn(BaseModel):
    zone_id: int
    duration_minutes: int  # 0 = skip this zone


class ProgramZoneSchema(BaseModel):
    zone_id: int
    duration_minutes: int
    order: int
    model_config = {"from_attributes": True}


class ProgramSchema(BaseModel):
    id: int
    name: str
    days_of_week: str
    start_time: str
    enabled: bool
    created_at: datetime
    zones: List[ProgramZoneSchema] = []
    refill_minutes: int = 60
    skip_on_rain: bool = True
    model_config = {"from_attributes": True}


class ProgramCreateRequest(BaseModel):
    name: str
    days_of_week: str
    start_time: str
    zones: List[ProgramZoneIn]  # ordered, skip if duration == 0
    refill_minutes: int = 60
    skip_on_rain: bool = True
    enabled: bool = True


class ProgramUpdateRequest(BaseModel):
    name: Optional[str] = None
    days_of_week: Optional[str] = None
    start_time: Optional[str] = None
    enabled: Optional[bool] = None
    zones: Optional[List[ProgramZoneIn]] = None
    refill_minutes: Optional[int] = None
    skip_on_rain: Optional[bool] = None


# ── Weather / Settings schemas ────────────────────────────────────────────────

class AppSettingsSchema(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    rain_threshold_mm: float = 2.0


class WeatherDay(BaseModel):
    date: str
    precipitation_mm: float
    weather_code: int
    description: str
    will_skip: bool
