#!/bin/bash
#
# Nautilus Trader Web Interface - VPS Deployment Script
# This script automates the deployment of the full stack to a production VPS
#

set -e  # Exit on error

echo "========================================="
echo "Nautilus Trader Web Interface Deployment"
echo "========================================="
echo ""

# Configuration
DOMAIN=${DOMAIN:-"your-domain.com"}
BACKEND_PORT=${BACKEND_PORT:-8000}
ADMIN_API_PORT=${ADMIN_API_PORT:-8001}

echo "Configuration:"
echo "  Domain: $DOMAIN"
echo "  Backend Port: $BACKEND_PORT"
echo "  Admin API Port: $ADMIN_API_PORT"
echo ""

# Step 1: Update system
echo "[1/10] Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Step 2: Install dependencies
echo "[2/10] Installing dependencies..."
sudo apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    nodejs \
    npm \
    nginx \
    certbot \
    python3-certbot-nginx \
    postgresql \
    postgresql-contrib \
    redis-server \
    git

# Step 3: Install Nautilus Trader
echo "[3/10] Installing Nautilus Trader..."
pip3 install nautilus_trader

# Step 4: Create application directory
echo "[4/10] Creating application directory..."
sudo mkdir -p /opt/nautilus-web
sudo chown $USER:$USER /opt/nautilus-web
cd /opt/nautilus-web

# Step 5: Copy application files
echo "[5/10] Copying application files..."
# Assuming files are in current directory
cp -r ~/Nautilus-Web-Interface/* .

# Step 6: Setup Python environment
echo "[6/10] Setting up Python environment..."
python3.11 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn pydantic python-dotenv

# Step 7: Create environment file
echo "[7/10] Creating environment configuration..."
cat > /opt/nautilus-web/.env << EOF
# Backend Configuration
NAUTILUS_API_PORT=$BACKEND_PORT
ADMIN_DB_API_PORT=$ADMIN_API_PORT
DB_PATH=/opt/nautilus-web/data/admin_panel.db
CORS_ORIGINS=https://$DOMAIN,http://localhost:3000

# Nautilus Configuration
TRADER_ID=TRADER-001
LOG_LEVEL=INFO
EOF

# Create data directory
mkdir -p /opt/nautilus-web/data

# Step 8: Setup systemd services
echo "[8/10] Creating systemd services..."

# Nautilus API Service
sudo tee /etc/systemd/system/nautilus-api.service > /dev/null << EOF
[Unit]
Description=Nautilus Trader API
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/nautilus-web
Environment="PATH=/opt/nautilus-web/venv/bin"
EnvironmentFile=/opt/nautilus-web/.env
ExecStart=/opt/nautilus-web/venv/bin/python3 nautilus_trader_api.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Admin DB API Service
sudo tee /etc/systemd/system/admin-db-api.service > /dev/null << EOF
[Unit]
Description=Admin Database API
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/nautilus-web
Environment="PATH=/opt/nautilus-web/venv/bin"
EnvironmentFile=/opt/nautilus-web/.env
ExecStart=/opt/nautilus-web/venv/bin/python3 admin_db_api.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Step 9: Configure Nginx
echo "[9/10] Configuring Nginx..."
sudo tee /etc/nginx/sites-available/nautilus-web > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend
    location / {
        root /opt/nautilus-web/frontend/dist;
        try_files \$uri \$uri/ /index.html;
    }

    # Nautilus API
    location /api/ {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Admin DB API
    location /api/admin/ {
        proxy_pass http://localhost:$ADMIN_API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/nautilus-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Step 10: Start services
echo "[10/10] Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable nautilus-api admin-db-api
sudo systemctl start nautilus-api admin-db-api

# Check status
echo ""
echo "Service Status:"
sudo systemctl status nautilus-api --no-pager | head -10
sudo systemctl status admin-db-api --no-pager | head -10

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Setup SSL: sudo certbot --nginx -d $DOMAIN"
echo "2. Check logs: sudo journalctl -u nautilus-api -f"
echo "3. Access: https://$DOMAIN"
echo ""
echo "To update frontend:"
echo "  cd /opt/nautilus-web/frontend && npm run build"
echo ""
echo "To restart services:"
echo "  sudo systemctl restart nautilus-api admin-db-api"
echo ""

