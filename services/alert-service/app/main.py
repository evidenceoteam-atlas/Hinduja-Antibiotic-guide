from datetime import UTC, datetime

from fastapi import FastAPI
from pydantic import BaseModel

from shared.schemas.common import ApiResponse
from shared.utils.health import register_health_routes
from shared.utils.logging import configure_logging

configure_logging("alert-service")
app = FastAPI(title="Alert Service", version="1.0.0", openapi_url="/api/v1/openapi.json")
register_health_routes(app, "alert-service")

ALERTS: list[dict] = []


class AcknowledgePayload(BaseModel):
    alert_id: str


@app.get("/api/v1/alerts", response_model=ApiResponse[list[dict]])
async def alerts():
    return ApiResponse(message="Alerts loaded", data=ALERTS)


@app.post("/api/v1/alerts/acknowledge", response_model=ApiResponse[dict])
async def acknowledge(payload: AcknowledgePayload):
    for alert in ALERTS:
        if alert["id"] == payload.alert_id:
            alert["status"] = "acknowledged"
            alert["acknowledged_at"] = datetime.now(UTC).isoformat()
    return ApiResponse(message="Alert acknowledged", data={"alert_id": payload.alert_id})
