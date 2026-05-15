from fastapi import FastAPI, Query
from prometheus_fastapi_instrumentator import Instrumentator

from shared.schemas.common import ApiResponse
from shared.utils.health import register_health_routes
from shared.utils.logging import configure_logging

configure_logging("antibiogram-service")
app = FastAPI(title="Antibiogram Service", version="1.0.0", openapi_url="/api/v1/openapi.json")
register_health_routes(app, "antibiogram-service")
Instrumentator().instrument(app).expose(app)

ORGANISMS = [
    {"code": "ecoli", "name": "E. coli"},
    {"code": "klebsiella", "name": "Klebsiella spp."},
]
ANTIBIOTICS = [
    {"name": "Cefoperazone-Sulbactam", "class": "Beta-lactam/beta-lactamase inhibitor"},
    {"name": "Meropenem", "class": "Carbapenem"},
    {"name": "Colistin", "class": "Polymyxin"},
]


@app.get("/api/v1/organisms", response_model=ApiResponse[list[dict]])
async def organisms():
    return ApiResponse(message="Organisms loaded", data=ORGANISMS)


@app.get("/api/v1/antibiotics", response_model=ApiResponse[list[dict]])
async def antibiotics():
    return ApiResponse(message="Antibiotics loaded", data=ANTIBIOTICS)


@app.get("/api/v1/sensitivity", response_model=ApiResponse[list[dict]])
async def sensitivity(organism: str = Query(default="ecoli"), department: str | None = None):
    return ApiResponse(
        message="Sensitivity data loaded",
        data=[
            {
                "organism": organism,
                "antibiotic": "Cefoperazone-Sulbactam",
                "sensitivity_percent": 80,
            },
            {"organism": organism, "antibiotic": "Meropenem", "sensitivity_percent": 80},
            {"organism": organism, "antibiotic": "Colistin", "sensitivity_percent": 97},
        ],
        meta={"department": department, "period": "Jan 2021 - Dec 2023"},
    )


@app.get("/api/v1/resistance-trends", response_model=ApiResponse[list[dict]])
async def resistance_trends():
    return ApiResponse(
        message="Resistance trends loaded",
        data=[
            {"month": "2023-10", "organism": "E. coli", "resistance_percent": 19},
            {"month": "2023-11", "organism": "E. coli", "resistance_percent": 21},
            {"month": "2023-12", "organism": "E. coli", "resistance_percent": 20},
        ],
    )
