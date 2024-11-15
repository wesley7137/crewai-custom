from typing import Any, Callable, Dict, List, Optional
import asyncio
from dataclasses import dataclass
from datetime import datetime

@dataclass
class CrewEvent:
    event_type: str  # 'agent_thought', 'tool_usage', 'task_update', etc.
    content: str
    timestamp: datetime = datetime.now()
    metadata: Optional[Dict[str, Any]] = None

class EventStreamer:
    def __init__(self):
        self._subscribers: List[Callable[[CrewEvent], None]] = []
        self._async_subscribers: List[Callable[[CrewEvent], asyncio.coroutine]] = []

    def subscribe(self, callback: Callable[[CrewEvent], None]) -> None:
        """Add a synchronous subscriber"""
        self._subscribers.append(callback)

    def subscribe_async(self, callback: Callable[[CrewEvent], asyncio.coroutine]) -> None:
        """Add an asynchronous subscriber"""
        self._async_subscribers.append(callback)

    def emit(self, event: CrewEvent) -> None:
        """Emit event to all subscribers"""
        for subscriber in self._subscribers:
            subscriber(event)

        if self._async_subscribers:
            asyncio.create_task(self._notify_async_subscribers(event))

    async def _notify_async_subscribers(self, event: CrewEvent) -> None:
        """Notify all async subscribers"""
        for subscriber in self._async_subscribers:
            await subscriber(event)

# Global event streamer instance
event_streamer = EventStreamer()