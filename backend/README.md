# Nautilus Web Interface - Backend

FastAPI backend for Nautilus Trader Admin Interface.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python3 nautilus_api.py
```

Server will start on http://localhost:8000

## API Documentation

Interactive API docs available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Endpoints

See main README or visit /docs for complete API documentation.

## Development

```bash
# Run with auto-reload
uvicorn nautilus_api:app --reload --port 8000

# Run with custom host/port
uvicorn nautilus_api:app --host 0.0.0.0 --port 8080
```

## Production

```bash
# Using gunicorn
pip install gunicorn
gunicorn nautilus_api:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Environment Variables

- `NAUTILUS_LOG_LEVEL` - Log level (default: INFO)
- `NAUTILUS_PORT` - API port (default: 8000)

## Files

- `nautilus_api.py` - Main FastAPI application
- `nautilus_instance.py` - Nautilus Trader core setup
- `requirements.txt` - Python dependencies

