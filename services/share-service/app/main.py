from uuid import uuid4

from fastapi import FastAPI
from pydantic import BaseModel

from shared.schemas.common import ApiResponse
from shared.utils.health import register_health_routes
from shared.utils.logging import configure_logging

configure_logging("share-service")
app = FastAPI(title="QR & Share Service", version="1.0.0", openapi_url="/api/v1/openapi.json")
register_health_routes(app, "share-service")


class ShareRequest(BaseModel):
    case_id: str


@app.post("/api/v1/share/qr", response_model=ApiResponse[dict])
async def qr(payload: ShareRequest):
    token = str(uuid4())
    return ApiResponse(
        message="QR generated",
        data={
            "case_id": payload.case_id,
            "qr_token": token,
            "deep_link": f"hinduja-abx://case/{payload.case_id}?t={token}",
        },
    )


@app.post("/api/v1/share/link", response_model=ApiResponse[dict])
async def link(payload: ShareRequest):
    return ApiResponse(
        message="Share link generated",
        data={"url": f"https://guide.hindujahospital.com/cases/{payload.case_id}"},
    )
