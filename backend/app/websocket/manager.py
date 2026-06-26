import asyncio
import json
from typing import Any
from fastapi import WebSocket
from jose import JWTError, jwt
from app.config.settings import settings


class WebSocketManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.connection_set: set[WebSocket] = set()
        self._heartbeat_task: asyncio.Task | None = None

    async def connect(self, websocket: WebSocket, token: str = ""):
        if not token:
            await websocket.close(code=4001)
            return
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            if not payload.get("sub"):
                await websocket.close(code=4001)
                return
        except JWTError:
            await websocket.close(code=4001)
            return
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_set.add(websocket)
        # Start heartbeat when first client connects
        if self._heartbeat_task is None or self._heartbeat_task.done():
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    def disconnect(self, websocket: WebSocket):
        if websocket in self.connection_set:
            self.connection_set.remove(websocket)
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, event_type: str, data: dict[str, Any]):
        message = json.dumps({"type": event_type, "data": data}, default=str)
        dead = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                dead.append(connection)
        for conn in dead:
            self.disconnect(conn)

    async def send_personal(self, websocket: WebSocket, event_type: str, data: dict[str, Any]):
        message = json.dumps({"type": event_type, "data": data}, default=str)
        try:
            await websocket.send_text(message)
        except Exception:
            pass

    async def _heartbeat_loop(self):
        """Send ping every 30 seconds to all connected clients."""
        while True:
            await asyncio.sleep(30)
            if not self.active_connections:
                continue
            await self.broadcast("ping", {"timestamp": asyncio.get_event_loop().time(), "interval": 30})


ws_manager = WebSocketManager()
