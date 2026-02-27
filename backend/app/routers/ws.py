from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from collections import defaultdict
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, analysis_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active[analysis_id].append(websocket)

    def disconnect(self, analysis_id: str, websocket: WebSocket):
        conns = self.active.get(analysis_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns and analysis_id in self.active:
            del self.active[analysis_id]

    async def broadcast(self, analysis_id: str, message: dict):
        dead: list[WebSocket] = []
        for ws in self.active.get(analysis_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(analysis_id, ws)


manager = ConnectionManager()


@router.websocket("/ws/analysis/{analysis_id}")
async def analysis_ws(websocket: WebSocket, analysis_id: str):
    await manager.connect(analysis_id, websocket)
    try:
        await websocket.send_json({
            "type": "connected",
            "analysisId": analysis_id,
        })
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(analysis_id, websocket)
    except Exception:
        manager.disconnect(analysis_id, websocket)
