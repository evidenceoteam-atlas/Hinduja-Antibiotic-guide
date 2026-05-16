from fastapi import FastAPI, Query
from prometheus_fastapi_instrumentator import Instrumentator

from shared.schemas.common import ApiResponse
from shared.utils.health import register_health_routes
from shared.utils.logging import configure_logging

configure_logging("antibiogram-service")
app = FastAPI(title="Antibiogram Service", version="1.0.0", openapi_url="/api/v1/openapi.json")
register_health_routes(app, "antibiogram-service")
Instrumentator().instrument(app).expose(app)

ORGANISMS: list[dict] = []
ANTIBIOTICS: list[dict] = []


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
