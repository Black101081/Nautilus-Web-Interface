# Nautilus Trader Admin - Deployment Guide

## Quick Deployment (5 Minutes)

### Prerequisites
- Python 3.11+
- Node.js 18+ (for frontend)
- 2GB RAM minimum

### Step 1: Extract Package
```bash
tar -xzf nautilus-admin-complete.tar.gz
cd nautilus-admin-complete
```

### Step 2: Install Python Dependencies
```bash
pip install nautilus_trader fastapi uvicorn
```

### Step 3: Start Backend
```bash
python3 nautilus_api.py
```

Backend will start on `http://localhost:8000`

### Step 4: Test API
```bash
curl http://localhost:8000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "message": "Nautilus Trader Admin API is running"
}
```

### Step 5: Open Test Frontend
Open `test_api_frontend.html` in your browser to verify integration.

## Production Deployment

### Backend (FastAPI)

#### Option 1: Gunicorn (Recommended)
```bash
pip install gunicorn

gunicorn nautilus_api:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile -
```

#### Option 2: Uvicorn with systemd
Create `/etc/systemd/system/nautilus-api.service`:
```ini
[Unit]
Description=Nautilus Trader API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/nautilus-admin
ExecStart=/usr/bin/python3 nautilus_api.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable nautilus-api
sudo systemctl start nautilus-api
```

#### Option 3: Docker
Create `Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN pip install nautilus_trader fastapi uvicorn gunicorn

COPY nautilus_api.py .
COPY nautilus_instance.py .

EXPOSE 8000

CMD ["gunicorn", "nautilus_api:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000"]
```

Build and run:
```bash
docker build -t nautilus-admin-api .
docker run -d -p 8000:8000 nautilus-admin-api
```

### Frontend (React)

#### Step 1: Setup Project
```bash
cd sprint5-deliverable
npm install
```

#### Step 2: Configure API URL
Create `.env`:
```env
VITE_API_URL=http://your-api-domain.com:8000
```

#### Step 3: Build for Production
```bash
npm run build
```

#### Step 4: Serve with Nginx
Install nginx:
```bash
sudo apt install nginx
```

Create `/etc/nginx/sites-available/nautilus-admin`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/nautilus-admin/sprint5-deliverable/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/nautilus-admin /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Environment Variables

### Backend
No environment variables required for basic setup.

Optional:
- `NAUTILUS_LOG_LEVEL` - Set log level (default: INFO)
- `NAUTILUS_PORT` - API port (default: 8000)

### Frontend
Required in `.env`:
- `VITE_API_URL` - Backend API URL

## Security Considerations

### 1. CORS Configuration
Update `nautilus_api.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],  # Specific domain
    allow_credentials=True,
    allow_methods=["GET", "POST"],  # Specific methods
    allow_headers=["*"],
)
```

### 2. API Authentication
Add authentication middleware (example with JWT):
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer

security = HTTPBearer()

async def verify_token(credentials = Depends(security)):
    # Implement token verification
    pass

@app.get("/api/protected")
async def protected_route(token = Depends(verify_token)):
    # Protected endpoint
    pass
```

### 3. HTTPS
Use Let's Encrypt with Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Monitoring

### Health Checks
```bash
# API health
curl http://localhost:8000/api/health

# Engine status
curl http://localhost:8000/api/nautilus/engine/info
```

### Logs
```bash
# View API logs
tail -f /var/log/nautilus-api.log

# View nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Prometheus Metrics (Optional)
Add to `nautilus_api.py`:
```python
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app)
```

## Troubleshooting

### API Not Starting
```bash
# Check port availability
sudo lsof -i :8000

# Check Python version
python3 --version  # Should be 3.11+

# Check dependencies
pip list | grep nautilus
pip list | grep fastapi
```

### Frontend Build Errors
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version  # Should be 18+
```

### CORS Errors
1. Check `allow_origins` in `nautilus_api.py`
2. Verify `VITE_API_URL` in frontend `.env`
3. Check browser console for specific error

### Connection Refused
1. Verify API is running: `curl http://localhost:8000/api/health`
2. Check firewall: `sudo ufw status`
3. Check nginx config: `sudo nginx -t`

## Scaling

### Horizontal Scaling
Use load balancer (nginx, HAProxy) with multiple API instances:
```nginx
upstream nautilus_api {
    server localhost:8001;
    server localhost:8002;
    server localhost:8003;
}

server {
    location /api {
        proxy_pass http://nautilus_api;
    }
}
```

### Database Optimization
- Use PostgreSQL connection pooling
- Implement Redis caching
- Optimize Parquet queries

### CDN for Frontend
Use Cloudflare, AWS CloudFront, or similar for static assets.

## Backup & Recovery

### Backup Script
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/nautilus-admin"

# Backup database
pg_dump nautilus > $BACKUP_DIR/db_$DATE.sql

# Backup config
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /path/to/config

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /var/log/nautilus-api.log
```

### Recovery
```bash
# Restore database
psql nautilus < db_backup.sql

# Restore config
tar -xzf config_backup.tar.gz -C /
```

## Performance Tuning

### API
- Increase worker count: `--workers 8`
- Use Redis for caching
- Enable gzip compression

### Frontend
- Enable code splitting
- Lazy load components
- Use CDN for assets

### Database
- Add indexes
- Optimize queries
- Use connection pooling

## Support

For issues or questions:
1. Check logs first
2. Review documentation
3. Test with `test_api_frontend.html`
4. Check GitHub issues (if applicable)

---

**Version**: 1.0.0
**Last Updated**: October 19, 2025

