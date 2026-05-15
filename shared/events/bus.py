from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import redis.asyncio as redis

from shared.utils.config import get_settings
from shared.utils.logging import get_logger

logger = get_logger(__name__)


class EventBus:
    def __init__(self, redis_url: str | None = None, stream: str | None = None) -> None:
        settings = get_settings()
        self.stream = stream or settings.event_stream
        self.client = redis.from_url(redis_url or settings.redis_url, decode_responses=True)

    async def publish(self, event_type: str, payload: dict[str, Any]) -> str:
        event = {
            "id": str(uuid4()),
            "type": event_type,
            "occurred_at": datetime.now(UTC).isoformat(),
            "payload": payload,
        }
        event_id = await self.client.xadd(self.stream, event)
        logger.info("event_published", event_type=event_type, event_id=event_id)
        return str(event_id)
