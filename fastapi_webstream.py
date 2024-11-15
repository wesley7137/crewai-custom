from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import json
from datetime import datetime
from ..utilities.event_streamer import event_streamer, CrewEvent

# Create FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StreamingManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, event: CrewEvent):
        for connection in self.active_connections:
            try:
                await connection.send_json({
                    "type": event.event_type,
                    "content": event.content,
                    "timestamp": event.timestamp.isoformat(),
                    "metadata": event.metadata
                })
            except:
                # Handle disconnected clients
                await self.disconnect(connection)
manager = StreamingManager()

# Subscribe to events
event_streamer.subscribe_async(manager.broadcast)

@app.websocket("/streaming/ws/crew-output")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except:
        manager.disconnect(websocket)

@app.post("/execute-crew")
async def execute_crew(crew_data: dict):
    try:
        # Your crew setup
        crew = Crew(
            agents=crew_data.get("agents", []),
            tasks=crew_data.get("tasks", []),
        )
        
        # Send initial message through WebSocket
        await manager.broadcast(CrewEvent(
            event_type="task_update",
            content="Starting crew execution",
            metadata={"crew_data": crew_data}
        ))
        
        # Execute crew (this will now stream output through websocket)
        result = await crew.kickoff()
        
        return {"final_result": result}
    except Exception as e:
        # Send error message through WebSocket
        await manager.broadcast(CrewEvent(
            event_type="error",
            content=str(e),
            metadata={"error_type": type(e).__name__}
        ))
        raise

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)