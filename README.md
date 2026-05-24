# SmartBird

Web interface to control a **RainBird ESP-RZXe 8-zone irrigation controller** via its LNK WiFi module, entirely over the local network.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python · FastAPI · APScheduler · SQLAlchemy (SQLite) · pyrainbird |
| Frontend | React 18 · TypeScript · Vite · TanStack Query · Tailwind CSS |
| Real-time | WebSocket (status polling every N seconds) |

## Features

- Start / stop any zone manually with a configurable duration
- Rename zones (the controller has no name storage)
- Create watering schedules (day of week + time + duration) with enable/disable toggle
- Live status bar: active zone, time remaining, rain sensor state
- Paginated irrigation history log
- **Mock mode** — run and develop without physical hardware

## Getting started

### Prerequisites

- Python 3.11+
- Node 20+

### Backend

```bash
cd backend
cp .env.example .env   # then edit RAINBIRD_HOST and RAINBIRD_PASSWORD
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API available at `http://localhost:8000` — interactive docs at `/docs`.

**Environment variables** (`backend/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `RAINBIRD_HOST` | — | IP address of the LNK module |
| `RAINBIRD_PASSWORD` | — | Controller password |
| `MOCK_MODE` | `false` | Set `true` to simulate hardware |
| `POLL_INTERVAL` | `5` | Seconds between status polls |
| `DATABASE_URL` | `sqlite:///./rainbird.db` | SQLAlchemy connection string |

### Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173
```

Vite proxies `/api` → `http://localhost:8000` (REST + WebSocket).

## Project structure

```
backend/
  app/
    config.py          # Pydantic settings
    database.py        # SQLAlchemy engine
    models.py          # ORM models + Pydantic schemas
    routers/           # zones · schedules · history · ws
    services/
      rainbird.py      # Thread-safe RainBird client (or mock)
      scheduler.py     # APScheduler wrapper

frontend/src/
  api/client.ts        # Typed axios wrappers
  hooks/useStatus.ts   # WebSocket with auto-reconnect
  components/          # Layout · ZoneCard · StatusBar
  pages/               # Dashboard · Schedules · History
```

## Hardware

Tested with a **RainBird ESP-RZXe** + **LNK WiFi module** on a local network.  
The backend uses [`pyrainbird`](https://github.com/jbarrancos/pyrainbird) `>=0.6,<1.0` to communicate with the controller.
