# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

API + UI to control a RainBird ESP-RZXe 8-zone irrigation controller via its LNK WiFi module (local network only).

## Commands

### Backend (FastAPI)

```bash
cd backend
cp .env.example .env        # then fill in RAINBIRD_HOST and RAINBIRD_PASSWORD
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API runs on `http://localhost:8000`. Interactive docs at `/docs`.

Set `MOCK_MODE=true` in `.env` to run without physical hardware — the mock simulates all 8 zones and zone timers.

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # production build → dist/
```

Vite proxies `/api` → `http://localhost:8000` (including WebSocket).

## Architecture

### Backend (`backend/app/`)

| Path | Responsibility |
|------|---------------|
| `config.py` | Pydantic settings loaded from `.env` |
| `database.py` | SQLAlchemy sync engine + `get_db()` dependency |
| `models.py` | ORM models (`ZoneConfig`, `WateringHistory`, `Schedule`) **and** Pydantic response/request schemas |
| `services/rainbird.py` | Thread-safe wrapper around `pyrainbird.RainbirdController` (or `_MockClient`). Singleton `rainbird_service`. |
| `services/scheduler.py` | APScheduler wrapper. `add_schedule_job` / `remove_schedule_job` map DB schedules to cron jobs. |
| `routers/zones.py` | Zone list, rename, start, stop |
| `routers/schedules.py` | CRUD + toggle for watering schedules |
| `routers/history.py` | Paginated watering log |
| `routers/ws.py` | WebSocket endpoint + `polling_loop()` async task |

**Startup flow** (`main.py` lifespan): create DB tables → initialise RainBird client → load enabled schedules into APScheduler → start scheduler → start `polling_loop` coroutine.

**Real-time updates**: `polling_loop` calls `rainbird_service.get_status()` every `POLL_INTERVAL` seconds (default 5), broadcasts a `{"type":"status","data":{…}}` JSON message to all WebSocket clients, and closes open `WateringHistory` records when a zone finishes naturally.

**History tracking**: a `WateringHistory` row is created immediately when a zone starts (manual or scheduled). `ended_at` is populated either when the user calls `POST /api/zones/stop` or when the polling loop detects the zone has stopped.

**pyrainbird version**: targets `>=0.6,<1.0`. The key methods used are `get_available_stations()`, `get_current_irrigation()`, `irrigate_zone(zone, minutes)`, `stop_irrigation()`, `get_rain_sensor_state()`. If upgrading to v2+, update `services/rainbird.py` accordingly.

**Days-of-week encoding**: stored as a comma-separated string of integers where Mon=1 … Sun=7 (e.g. `"1,3,5"`). Converted to APScheduler's `mon,wed,fri` format in `scheduler.py::_days_to_apscheduler`.

### Frontend (`frontend/src/`)

| Path | Responsibility |
|------|---------------|
| `api/client.ts` | Typed axios wrappers (`zonesApi`, `schedulesApi`, `historyApi`) |
| `hooks/useStatus.ts` | WebSocket connection with auto-reconnect; exposes `{ status, connected }` |
| `components/Layout.tsx` | Shell with nav + `<StatusBar>` |
| `components/ZoneCard.tsx` | Per-zone card with inline rename, duration selector, start/stop |
| `pages/Dashboard.tsx` | 8-zone grid; polls `/api/zones` every 5 s as fallback |
| `pages/Schedules.tsx` | Schedule list + modal form (days picker, time, duration) |
| `pages/History.tsx` | Paginated table of past irrigation events |

State is managed via TanStack Query (server state) + local `useState`. The WebSocket status in `useStatus` lives in `Layout` and flows down via the `StatusBar`.

## API endpoints

```
GET    /api/zones              list zones with active status
PATCH  /api/zones/{id}         rename / enable a zone
POST   /api/zones/{id}/start   { duration_minutes }
POST   /api/zones/stop         stop all (updates history)

GET    /api/schedules          list
POST   /api/schedules          create { name, zone_id, duration_minutes, days_of_week, start_time }
PATCH  /api/schedules/{id}     partial update
DELETE /api/schedules/{id}
POST   /api/schedules/{id}/toggle

GET    /api/history?page=&limit=&zone_id=

WS     /api/ws                 broadcasts { type:"status", data:{active_zone, minutes_remaining, rain_sensor, timestamp} }
```

## Database (SQLite — `rainbird.db`)

Three tables created automatically on startup:
- `zone_configs` — persists zone names (the controller has no name storage)
- `schedules` — watering programmes with cron parameters
- `watering_history` — log of every irrigation event
