from uuid import uuid4

from fastapi import FastAPI
from pydantic import BaseModel, Field

from shared.events.bus import EventBus
from shared.schemas.common import ApiResponse
from shared.utils.health import register_health_routes
from shared.utils.logging import configure_logging

configure_logging("case-service")
app = FastAPI(title="Case Service", version="1.0.0", openapi_url="/api/v1/openapi.json")
register_health_routes(app, "case-service")
events = EventBus()
CASES: dict[str, dict] = {}


class CasePayload(BaseModel):
    infection_code: str
    setting: str
    acquisition: str
    risk_type: str
    recommendation: dict


class SharePayload(BaseModel):
    case_id: str
    recipients: list[str] = Field(default_factory=list)


@app.post("/api/v1/cases", response_model=ApiResponse[dict])
async def create_case(payload: CasePayload):
    case_id = str(uuid4())
    CASES[case_id] = payload.model_dump() | {"id": case_id}
    await events.publish(
        "case.saved", {"case_id": case_id, "infection_code": payload.infection_code}
    )
    return ApiResponse(message="Case saved successfully", data=CASES[case_id])


@app.get("/api/v1/cases", response_model=ApiResponse[list[dict]])
async def list_cases():
    return ApiResponse(message="Cases loaded", data=list(CASES.values()))


@app.get("/api/v1/cases/{case_id}", response_model=ApiResponse[dict])
async def get_case(case_id: str):
    return ApiResponse(
        message="Case loaded", data=CASES.get(case_id, {"id": case_id, "status": "not_found"})
    )


@app.post("/api/v1/cases/share", response_model=ApiResponse[dict])
async def share_case(payload: SharePayload):
    return ApiResponse(
        message="Case shared", data={"case_id": payload.case_id, "recipients": payload.recipients}
    )
