"""
Shared application state: NautilusTradingSystem singleton + WebSocket manager.
Imported by all routers so they all operate on the same engine instance.
"""

import os
from pathlib import Path
from typing import List
from fastapi import WebSocket

backend_dir = Path(__file__).parent
catalog_path = str(backend_dir.parent / "nautilus_data" / "catalog")
os.environ.setdefault("NAUTILUS_CATALOG_PATH", catalog_path)

from nautilus_core import NautilusTradingSystem  # noqa: E402

nautilus_system = NautilusTradingSystem(catalog_path=catalog_path)


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts messages."""

    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()
