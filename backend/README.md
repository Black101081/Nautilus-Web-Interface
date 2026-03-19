# Nautilus Web Interface — Backend

FastAPI backend for Nautilus Trader Web Interface.

## Entry Point

```bash
# Production server (use this one)
python3 nautilus_fastapi.py

# Or with uvicorn directly
uvicorn nautilus_fastapi:app --host 0.0.0.0 --port 8000
```

Server starts on `http://localhost:8000`.
Interactive API docs: `http://localhost:8000/docs`

> `nautilus_trader_api.py` is a secondary/reference implementation.
> Use `nautilus_fastapi.py` for production — it has all endpoints the frontend requires.

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment file and configure
cp .env.example .env
```

## Environment Variables

See `.env.example` for all options. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed origins |
| `API_KEY` | _(blank — auth disabled)_ | Set to a strong random value to enable API key auth |
| `NAUTILUS_API_PORT` | `8000` | Server port |

Generate a strong API key:
```bash
openssl rand -hex 32
```

## Files

| File | Description |
|------|-------------|
| `nautilus_fastapi.py` | **Production entry point** — full REST API + WebSocket |
| `nautilus_trader_api.py` | Secondary/reference implementation |
| `nautilus_core.py` | `NautilusTradingSystem` wrapper around Nautilus Trader |
| `nautilus_integration.py` | Manager for strategies, orders, positions, risk |
| `market_data_service.py` | Live Binance ticker data with 5s TTL cache + fallback |
| `alerts_db.py` | Async SQLite persistence for price alerts |
| `auth.py` | `ApiKeyMiddleware` — optional API key gate for all endpoints |
| `admin_db_api.py` | Separate admin database API (runs on port 8001) |
| `nautilus_api.py` | Legacy stub (not used in production) |
| `strategies/` | Strategy implementations |
| `.env.example` | Environment variable template |
| `requirements.txt` | Python dependencies |
| `data/alerts.db` | SQLite alerts database (auto-created, git-ignored) |

## Dependencies

```
nautilus_trader>=1.220.0   Core trading engine
fastapi>=0.104.0            REST API framework
uvicorn[standard]>=0.24.0  ASGI server
pydantic>=2.4.0             Data validation
python-multipart>=0.0.6    File upload support
psutil>=5.9.0              System metrics (monitoring endpoint)
httpx>=0.27.0              Async HTTP client (Binance market data)
aiosqlite>=0.20.0          Async SQLite (alerts persistence)
```

## Development

```bash
# Auto-reload during development
uvicorn nautilus_fastapi:app --reload --port 8000

# Production with gunicorn
pip install gunicorn
gunicorn nautilus_fastapi:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
```

## API Overview

| Category | Endpoints |
|----------|-----------|
| Health | `GET /api/health` |
| Engine | `POST /api/engine/initialize`, `GET /api/engine/info`, `POST /api/engine/shutdown` |
| Strategies | `GET/POST /api/strategies`, `POST /api/strategies/{id}/start\|stop`, `DELETE /api/strategies/{id}` |
| Orders | `GET/POST /api/orders`, `DELETE /api/orders/{id}` |
| Positions | `GET /api/positions`, `POST /api/positions/{id}/close` |
| Risk | `GET/POST /api/risk/limits`, `GET /api/risk/metrics` |
| Market Data | `GET /api/market-data/instruments`, `GET /api/market-data/{symbol}` |
| Alerts | `GET/POST /api/alerts`, `DELETE /api/alerts/{id}` |
| System | `GET /api/system/metrics`, `GET/POST /api/settings` |
| Database | `POST /api/database/backup\|optimize\|clean` |
| Backtesting | `POST /api/nautilus/demo-backtest`, `POST /api/nautilus/backtest` |
| WebSocket | `WS /ws` — real-time updates every 2 seconds |
