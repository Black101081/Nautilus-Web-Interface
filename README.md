# Nautilus Web Interface

> Professional admin interface for Nautilus Trader with FastAPI backend and React frontend

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/react-18+-61DAFB.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5+-3178C6.svg)](https://www.typescriptlang.org/)

## Overview

Nautilus Web Interface is a complete admin dashboard for [Nautilus Trader](https://nautilustrader.io/) - a high-performance algorithmic trading platform. This project provides a modern web interface to manage, monitor, and control Nautilus Trader instances.

### Features

- 🎯 **Complete Admin Interface** - 8 pages with 140+ operations
- 🚀 **FastAPI Backend** - RESTful API with 15+ endpoints
- ⚛️ **React Frontend** - Modern TypeScript UI with notifications
- 🔄 **Real-time Integration** - Live data from Nautilus Trader core
- 📊 **Component Management** - Control engines, adapters, and services
- 💾 **Database Operations** - PostgreSQL, Parquet, Redis management
- 🔔 **Notification System** - User feedback for all operations
- 📱 **Responsive Design** - Works on desktop and mobile

## Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Frontend   │─────▶│   FastAPI    │─────▶│   Nautilus   │
│  (React/TS)  │      │   Backend    │      │    Trader    │
│              │◀─────│  (Python)    │◀─────│    Core      │
└──────────────┘      └──────────────┘      └──────────────┘
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- 2GB RAM minimum

### Installation

```bash
# Clone repository
git clone https://github.com/Black101081/Nautilus-Web-Interface.git
cd Nautilus-Web-Interface

# Install backend dependencies
pip install nautilus_trader fastapi uvicorn

# Start backend
cd backend
python3 nautilus_api.py

# In another terminal, install frontend dependencies
cd frontend
npm install

# Start frontend
npm run dev
```

### Access

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Project Structure

```
Nautilus-Web-Interface/
├── backend/                 # FastAPI backend
│   ├── nautilus_api.py     # Main API server
│   └── nautilus_instance.py # Nautilus core setup
├── frontend/               # React frontend
│   ├── pages/             # Admin pages (8 pages)
│   ├── services/          # API services
│   ├── components/        # React components
│   ├── contexts/          # React contexts
│   └── utils/             # Utilities
├── docs/                  # Documentation
│   ├── NAUTILUS_ADMIN_COMPLETE.md
│   ├── DEPLOYMENT_GUIDE.md
│   └── test_integration.html
└── README.md
```

## Admin Pages

1. **Dashboard** - Overview and quick actions (16 operations)
2. **Database** - PostgreSQL, Parquet, Redis management (15 operations)
3. **Components** - Manage Nautilus components (22 operations)
4. **Features** - Feature flags and configuration (20 operations)
5. **Adapters** - Exchange/broker connections (19 operations)
6. **Monitoring** - System metrics and logs (11 operations)
7. **Settings** - System configuration (14 operations)
8. **Component Showcase** - UI component demo (23 operations)

## API Endpoints

### Health & Info
- `GET /api/health` - Health check
- `GET /api/nautilus/engine/info` - Engine information
- `GET /api/nautilus/instruments` - List instruments
- `GET /api/nautilus/cache/stats` - Cache statistics

### Database Operations
- `POST /api/nautilus/database/optimize-postgresql`
- `POST /api/nautilus/database/backup-postgresql`
- `POST /api/nautilus/database/export-parquet`
- `POST /api/nautilus/database/clean-parquet`
- `POST /api/nautilus/database/flush-redis`
- `GET /api/nautilus/database/redis-stats`

### Component Management
- `POST /api/nautilus/components/{id}/stop`
- `POST /api/nautilus/components/{id}/restart`
- `POST /api/nautilus/components/{id}/configure`

## Development

### Backend Development

```bash
cd backend

# Run with auto-reload
uvicorn nautilus_api:app --reload --port 8000

# Run tests
pytest tests/
```

### Frontend Development

```bash
cd frontend

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

## Deployment

See [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

### Quick Deploy to Cloudflare Pages

```bash
# Build frontend
cd frontend
npm run build

# Deploy to Cloudflare Pages
# (Connect your GitHub repo to Cloudflare Pages dashboard)
```

### Docker Deployment

```bash
# Build backend image
docker build -t nautilus-backend ./backend

# Run backend
docker run -d -p 8000:8000 nautilus-backend

# Build frontend image
docker build -t nautilus-frontend ./frontend

# Run frontend
docker run -d -p 3000:3000 nautilus-frontend
```

## Configuration

### Backend

Environment variables (optional):
- `NAUTILUS_LOG_LEVEL` - Log level (default: INFO)
- `NAUTILUS_PORT` - API port (default: 8000)

### Frontend

Create `.env` in frontend directory:
```env
VITE_API_URL=http://localhost:8000
```

## Testing

### Integration Test

Open `docs/test_integration.html` in browser to test API integration.

### Manual Testing

```bash
# Test health endpoint
curl http://localhost:8000/api/health

# Test engine info
curl http://localhost:8000/api/nautilus/engine/info

# Test database operation
curl -X POST http://localhost:8000/api/nautilus/database/optimize-postgresql
```

## Documentation

- [Complete System Documentation](docs/NAUTILUS_ADMIN_COMPLETE.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Frontend README](frontend/README.md)
- [API Documentation](http://localhost:8000/docs) (when running)

## Technology Stack

### Backend
- **Nautilus Trader** - Core trading engine
- **FastAPI** - Modern Python web framework
- **Uvicorn** - ASGI server
- **Pydantic** - Data validation

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Nautilus Trader](https://nautilustrader.io/) - The core trading platform
- [FastAPI](https://fastapi.tiangolo.com/) - The backend framework
- [React](https://reactjs.org/) - The frontend library

## Support

For issues, questions, or contributions:
- 📧 Open an issue on GitHub
- 📖 Check the [documentation](docs/)
- 🔍 Review the [integration test](docs/test_integration.html)

## Roadmap

- [ ] WebSocket support for real-time updates
- [ ] Authentication and authorization
- [ ] Strategy management interface
- [ ] Backtesting UI
- [ ] Advanced analytics dashboard
- [ ] Mobile app
- [ ] Multi-instance support

---

**Built with ❤️ for the Nautilus Trader community**

**Version**: 1.0.0  
**Status**: Production Ready  
**Last Updated**: October 2025

