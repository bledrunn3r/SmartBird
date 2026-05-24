import threading
import time
from datetime import datetime
from typing import Optional
from ..config import settings
from ..models import ControllerStatus


class _MockRealController:
    """Mimics the real pyrainbird RainbirdController interface for testing."""

    def __init__(self):
        self._active_zone: Optional[int] = None
        self._duration: float = 0.0
        self._start_time: Optional[float] = None

    # -- real controller interface --

    def get_current_irrigation(self) -> bool:
        if self._active_zone and self._start_time:
            if (time.time() - self._start_time) / 60 < self._duration:
                return True
            self._active_zone = None
        return False

    def get_rain_sensor_state(self) -> bool:
        return False

    def irrigate_zone(self, zone: int, minutes: int) -> bool:
        self._active_zone = zone
        self._duration = float(minutes)
        self._start_time = time.time()
        return True

    def stop_irrigation(self) -> bool:
        self._active_zone = None
        return True

    def get_available_stations(self):
        # Returns AvailableStations-like object; .stations.states is tuple[bool]
        class _States:
            states = tuple(True for _ in range(8))

        class _Stations:
            stations = _States()

        return _Stations()

    def get_zone_state(self, zone: int) -> bool:
        return self.get_current_irrigation() and self._active_zone == zone

    def get_serial_number(self) -> str:
        return "MOCK-ESP-RZXe"


class RainBirdService:
    """
    Thread-safe wrapper around the RainBird controller.

    Because pyrainbird 0.7.1 doesn't expose "which zone is running" or
    "minutes remaining", we track those ourselves in memory after each start.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._client = None

        # In-memory irrigation tracking
        self._active_zone: Optional[int] = None
        self._planned_duration: float = 0.0
        self._zone_start_time: Optional[float] = None

    def initialize(self):
        if settings.mock_mode:
            self._client = _MockRealController()
        else:
            from pyrainbird import RainbirdController  # type: ignore

            self._client = RainbirdController(
                settings.rainbird_host,
                settings.rainbird_password,
                update_delay=0,   # always fetch fresh state, no caching
                retry=2,
                retry_sleep=2,
            )

    # ── public API ──────────────────────────────────────────────────────────

    def get_status(self) -> ControllerStatus:
        with self._lock:
            # Use CurrentStationsActive (supported by ESP-RZXe) instead of
            # CurrentIrrigationState (returns 503 on this model).
            # get_zone_state(1) triggers _update_irrigation_state() which reads
            # all active stations in one request; subsequent zone checks use cache.
            external_active: Optional[int] = None
            try:
                self._client.get_zone_state(1)  # populates self._client.zones
                for i, state in enumerate(self._client.zones.states[:8]):
                    if state:
                        external_active = i + 1
                        break
            except Exception:
                pass

            try:
                rain = self._client.get_rain_sensor_state()
            except Exception:
                rain = False

            if external_active:
                if self._active_zone == external_active and self._zone_start_time:
                    elapsed = (time.time() - self._zone_start_time) / 60
                    remaining = max(0.0, self._planned_duration - elapsed)
                    minutes_remaining: Optional[float] = remaining
                else:
                    # Zone started from keypad or another client
                    self._active_zone = external_active
                    self._zone_start_time = None
                    minutes_remaining = None
                active_zone: Optional[int] = external_active
            else:
                if self._active_zone:
                    # Zone finished naturally — clear tracking
                    self._active_zone = None
                    self._zone_start_time = None
                active_zone = None
                minutes_remaining = None

            return ControllerStatus(
                active_zone=active_zone,
                minutes_remaining=minutes_remaining,
                rain_sensor=bool(rain),
                timestamp=datetime.utcnow(),
            )

    def start_zone(self, zone_id: int, duration_minutes: int) -> bool:
        with self._lock:
            ok = self._client.irrigate_zone(zone_id, duration_minutes)
            if ok:
                self._active_zone = zone_id
                self._planned_duration = float(duration_minutes)
                self._zone_start_time = time.time()
            return bool(ok)

    def stop_all(self) -> bool:
        with self._lock:
            ok = self._client.stop_irrigation()
            self._active_zone = None
            self._zone_start_time = None
            return bool(ok)

    def get_available_zones(self) -> list[int]:
        with self._lock:
            available = self._client.get_available_stations()
            return [
                i + 1
                for i, active in enumerate(available.stations.states)
                if active
            ]

    @property
    def active_zone(self) -> Optional[int]:
        return self._active_zone



rainbird_service = RainBirdService()
