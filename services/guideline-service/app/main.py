from uuid import uuid4

from fastapi import Depends, FastAPI
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from shared.clinical.ground_truth import SAFE_EMPTY_MESSAGE, GroundTruthRepository
from shared.database.session import get_session
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


async def get_ground_truth_repository(
    session: AsyncSession = Depends(get_session),
) -> GroundTruthRepository:
    return GroundTruthRepository(session)


def safe_empty_response(meta: dict | None = None) -> ApiResponse:
    return ApiResponse(message=SAFE_EMPTY_MESSAGE, data=[], meta=meta or {})


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


@app.get("/api/v1/icmr-guidelines", response_model=ApiResponse[list[dict]])
async def list_icmr_guidelines(
    repository: GroundTruthRepository = Depends(get_ground_truth_repository),
):
    try:
        rows = await repository.icmr_guidelines()
    except SQLAlchemyError:
        return safe_empty_response()
    if not rows:
        return safe_empty_response()
    return ApiResponse(message="Approved ICMR guidelines loaded", data=rows)


@app.get("/api/v1/icmr-guidelines/{clinical_condition:path}", response_model=ApiResponse[dict])
async def get_icmr_guideline(
    clinical_condition: str,
    repository: GroundTruthRepository = Depends(get_ground_truth_repository),
):
    try:
        row = await repository.icmr_guideline(clinical_condition)
    except SQLAlchemyError:
        row = None
    if not row:
        return ApiResponse(
            message=SAFE_EMPTY_MESSAGE,
            data=None,
            meta={"clinical_condition": clinical_condition},
        )
    return ApiResponse(message="Approved ICMR guideline loaded", data=row)


@app.get("/api/v1/durations", response_model=ApiResponse[list[dict]])
async def list_durations(
    repository: GroundTruthRepository = Depends(get_ground_truth_repository),
):
    try:
        rows = await repository.durations()
    except SQLAlchemyError:
        return safe_empty_response()
    if not rows:
        return safe_empty_response()
    return ApiResponse(message="Approved treatment durations loaded", data=rows)


@app.get("/api/v1/antibiograms", response_model=ApiResponse[list[dict]])
async def list_antibiograms(
    repository: GroundTruthRepository = Depends(get_ground_truth_repository),
):
    try:
        rows = await repository.antibiograms()
    except SQLAlchemyError:
        return safe_empty_response()
    if not rows:
        return safe_empty_response()
    return ApiResponse(message="Approved antibiograms loaded", data=rows)


@app.get("/api/v1/antibiograms/{infection_type}", response_model=ApiResponse[list[dict]])
async def get_antibiograms_by_infection_type(
    infection_type: str,
    repository: GroundTruthRepository = Depends(get_ground_truth_repository),
):
    try:
        rows = await repository.antibiograms(infection_type)
    except SQLAlchemyError:
        return safe_empty_response({"infection_type": infection_type})
    if not rows:
        return safe_empty_response({"infection_type": infection_type})
    return ApiResponse(
        message="Approved antibiograms loaded",
        data=rows,
        meta={"infection_type": infection_type},
    )


@app.get("/api/v1/stewardship-pearls", response_model=ApiResponse[list[dict]])
async def list_stewardship_pearls(
    repository: GroundTruthRepository = Depends(get_ground_truth_repository),
):
    try:
        rows = await repository.stewardship_pearls()
    except SQLAlchemyError:
        return safe_empty_response()
    if not rows:
        return safe_empty_response()
    return ApiResponse(message="Approved stewardship pearls loaded", data=rows)


@app.get("/api/v1/perioperative", response_model=ApiResponse[dict])
async def get_perioperative(
    repository: GroundTruthRepository = Depends(get_ground_truth_repository),
):
    try:
        data = await repository.perioperative()
    except SQLAlchemyError:
        data = {}
    if not data:
        return ApiResponse(message=SAFE_EMPTY_MESSAGE, data={})
    return ApiResponse(message="Approved perioperative guidance loaded", data=data)
