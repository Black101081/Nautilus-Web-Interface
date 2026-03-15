# Deployment Guide

## Prerequisites

- Python 3.11+
- Node.js 18+
- 2 GB RAM minimum

---

## Quick Start (Local Development)

```bash
# 1. Clone
git clone https://github.com/Black101081/Nautilus-Web-Interface.git
cd Nautilus-Web-Interface

# 2. Backend
cd backend
pip install -r requirements.txt
cp .env.example .env          # edit as needed
python3 nautilus_fastapi.py   # starts on :8000

# 3. Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env          # edit VITE_NAUTILUS_API_URL if needed
npm run dev                   # starts on :5173
```

---

## Production — VPS / Dedicated Server

### Automated Script

```bash
DOMAIN=yourdomain.com bash deploy_to_vps.sh
```

This script installs all system dependencies, sets up a Python virtualenv, creates systemd services for the backend, builds the React frontend, and configures Nginx.

### Manual Steps

#### 1. Install system dependencies

```bash
sudo apt-get update && sudo apt-get install -y \
    python3.11 python3.11-venv python3-pip \
    nodejs npm nginx certbot python3-certbot-nginx git
```

#### 2. Python environment

```bash
mkdir -p /opt/nautilus-web
cp -r ~/Nautilus-Web-Interface/* /opt/nautilus-web/
cd /opt/nautilus-web
python3.11 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

#### 3. Environment configuration

```bash
cat > /opt/nautilus-web/.env << EOF
CORS_ORIGINS=https://yourdomain.com
API_KEY=$(openssl rand -hex 32)
NAUTILUS_API_PORT=8000
EOF
```

#### 4. systemd service

Create `/etc/systemd/system/nautilus-api.service`:

```ini
[Unit]
Description=Nautilus Trader API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/nautilus-web
Environment="PATH=/opt/nautilus-web/venv/bin"
EnvironmentFile=/opt/nautilus-web/.env
ExecStart=/opt/nautilus-web/venv/bin/python3 backend/nautilus_fastapi.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nautilus-api
```

#### 5. Build frontend

```bash
cd /opt/nautilus-web/frontend
cat > .env << EOF
VITE_NAUTILUS_API_URL=https://yourdomain.com
VITE_WS_URL=wss://yourdomain.com
VITE_API_KEY=<same value as server API_KEY>
EOF
npm install && npm run build
```

#### 6. Nginx

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # React SPA
    location / {
        root /opt/nautilus-web/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API + WebSocket
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/nautilus-web /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
# SSL
sudo certbot --nginx -d yourdomain.com
```

---

## Production — Docker

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 8000
CMD ["python3", "nautilus_fastapi.py"]
```

```bash
docker build -t nautilus-backend ./backend
docker run -d -p 8000:8000 \
  -e CORS_ORIGINS=https://yourdomain.com \
  -e API_KEY=your-secret-key \
  nautilus-backend
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CORS_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed origins. **Set this in production.** |
| `API_KEY` | No | _(blank — auth disabled)_ | Enables API key auth on all endpoints when set. Generate: `openssl rand -hex 32` |
| `NAUTILUS_API_PORT` | No | `8000` | Server port |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_NAUTILUS_API_URL` | Yes | `http://localhost:8000` | Backend API base URL |
| `VITE_ADMIN_DB_API_URL` | No | `http://localhost:8001` | Admin DB API base URL |
| `VITE_WS_URL` | No | `ws://localhost:8000` | WebSocket URL |
| `VITE_API_KEY` | No | _(blank)_ | Must match server `API_KEY` when auth is enabled |

---

## Security Checklist

- [ ] Set `CORS_ORIGINS` to your exact frontend domain (not `*`)
- [ ] Set a strong `API_KEY` (`openssl rand -hex 32`)
- [ ] Enable HTTPS with Let's Encrypt
- [ ] Run backend as a non-root user
- [ ] Keep `backend/data/` outside of web root

---

## Health Check

```bash
curl https://yourdomain.com/api/health
# {"status":"healthy","timestamp":"...","service":"nautilus-trader-api","version":"2.0.0"}
```

## Logs

```bash
# Backend logs
sudo journalctl -u nautilus-api -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Updates

```bash
cd /opt/nautilus-web
git pull origin main
pip install -r backend/requirements.txt    # pick up new dependencies
cd frontend && npm install && npm run build
sudo systemctl restart nautilus-api
```

---

## Troubleshooting

### Backend won't start
```bash
# Check port
sudo lsof -i :8000
# Check Python version (must be 3.11+)
python3 --version
# Check dependencies
pip show fastapi aiosqlite httpx
```

### Frontend build fails
```bash
# Clear cache
rm -rf node_modules package-lock.json && npm install
# Node version must be 18+
node --version
```

### CORS errors in browser
1. Verify `CORS_ORIGINS` matches your frontend URL exactly (no trailing slash)
2. Verify `VITE_NAUTILUS_API_URL` in frontend `.env`
3. Rebuild frontend after changing env vars

### WebSocket not connecting
1. Ensure Nginx `location /ws` block proxies `Upgrade` header
2. Use `wss://` (not `ws://`) when HTTPS is enabled

---

**Version**: 2.0.0 | **Last Updated**: March 2026
