from fastapi import Depends, FastAPI, Query
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from shared.clinical.ground_truth import GroundTruthRepository, SAFE_EMPTY_MESSAGE
from shared.database.session import get_session
from shared.schemas.common import ApiResponse
from shared.utils.health import register_health_routes
from shared.utils.logging import configure_logging

configure_logging("antibiogram-service")
app = FastAPI(title="Antibiogram Service", version="1.0.0", openapi_url="/api/v1/openapi.json")
register_health_routes(app, "antibiogram-service")
Instrumentator().instrument(app).expose(app)

ORGANISMS: list[dict] = []
ANTIBIOTICS: list[dict] = []


async def get_ground_truth_repository(
    session: AsyncSession = Depends(get_session),
) -> GroundTruthRepository:
    return GroundTruthRepository(session)


def safe_empty_response(meta: dict | None = None) -> ApiResponse:
    return ApiResponse(message=SAFE_EMPTY_MESSAGE, data=[], meta=meta or {})


@app.get("/api/v1/organisms", response_model=ApiResponse[list[dict]])
async def organisms():
    return ApiResponse(message="Organisms loaded", data=ORGANISMS)


@app.get("/api/v1/antibiotics", response_model=ApiResponse[list[dict]])
async def antibiotics():
    return ApiResponse(message="Antibiotics loaded", data=ANTIBIOTICS)


@app.get("/api/v1/sensitivity", response_model=ApiResponse[list[dict]])
async def sensitivity(organism: str = Query(default="ecoli"), department: str | None = None):
    return ApiResponse(
        message=(
            "No approved source-linked sensitivity data available. Refer institutional "
            "guideline / ID specialist."
        ),
        data=[],
        meta={"department": department, "organism": organism},
    )


@app.get("/api/v1/resistance-trends", response_model=ApiResponse[list[dict]])
async def resistance_trends():
    return ApiResponse(
        message=(
            "No approved source-linked resistance trends available. Refer institutional "
            "guideline / ID specialist."
        ),
        data=[],
    )


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
