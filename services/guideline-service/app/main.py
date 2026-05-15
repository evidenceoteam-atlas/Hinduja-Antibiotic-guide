from uuid import uuid4

from fastapi import FastAPI
from pydantic import BaseModel

from shared.schemas.common import ApiResponse
from shared.utils.health import register_health_routes
from shared.utils.logging import configure_logging

configure_logging("guideline-service")
app = FastAPI(title="Guideline Service", version="1.0.0", openapi_url="/api/v1/openapi.json")
register_health_routes(app, "guideline-service")


class GuidelinePayload(BaseModel):
    title: str
    markdown: str
    status: str = "draft"


GUIDELINES: dict[str, dict] = {}


@app.post("/api/v1/guidelines", response_model=ApiResponse[dict])
async def create_guideline(payload: GuidelinePayload):
    guideline_id = str(uuid4())
    GUIDELINES[guideline_id] = payload.model_dump() | {"id": guideline_id, "version": "0.1"}
    return ApiResponse(message="Guideline created", data=GUIDELINES[guideline_id])


@app.get("/api/v1/guidelines", response_model=ApiResponse[list[dict]])
async def list_guidelines(q: str | None = None):
    values = list(GUIDELINES.values()) or [
        {"id": "uti-2024", "title": "UTI Empiric Therapy", "status": "published", "version": "1.0"}
    ]
    if q:
        values = [item for item in values if q.lower() in item["title"].lower()]
    return ApiResponse(message="Guidelines loaded", data=values)


@app.patch("/api/v1/guidelines/{guideline_id}", response_model=ApiResponse[dict])
async def update_guideline(guideline_id: str, payload: GuidelinePayload):
    GUIDELINES[guideline_id] = (
        GUIDELINES.get(guideline_id, {"id": guideline_id}) | payload.model_dump()
    )
    return ApiResponse(message="Guideline updated", data=GUIDELINES[guideline_id])
