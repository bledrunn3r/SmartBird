import asyncio
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..services.rainbird import rainbird_service
from ..config import settings

router = APIRouter(tags=["websocket"])


class _ConnectionManager:
    def __init__(self):
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket):
        self._connections.discard if hasattr(self._connections, "discard") else None
        if ws in self._connections:
            self._connections.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self._connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = _ConnectionManager()


@router.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep-alive / ignore client messages
    except WebSocketDisconnect:
        manager.disconnect(ws)


async def _close_completed_history(prev_zone: int):
    """Mark the open history entry as ended when a zone finishes naturally."""
    from ..database import SessionLocal
    from ..models import WateringHistory

    db = SessionLocal()
    try:
        history = (
            db.query(WateringHistory)
            .filter(
                WateringHistory.zone_id == prev_zone,
                WateringHistory.ended_at.is_(None),
            )
            .order_by(WateringHistory.started_at.desc())
            .first()
        )
        if history:
            history.ended_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


async def polling_loop():
    prev_active_zone: int | None = None

    while True:
        try:
            loop = asyncio.get_event_loop()
            status = await loop.run_in_executor(None, rainbird_service.get_status)

            # Detect natural zone completion
            if prev_active_zone and not status.active_zone:
                await _close_completed_history(prev_active_zone)

            prev_active_zone = status.active_zone

            await manager.broadcast(
                {
                    "type": "status",
                    "data": {
                        "active_zone": status.active_zone,
                        "minutes_remaining": status.minutes_remaining,
                        "rain_sensor": status.rain_sensor,
                        "timestamp": status.timestamp.isoformat(),
                    },
                }
            )
        except Exception:
            pass

        await asyncio.sleep(settings.poll_interval)
