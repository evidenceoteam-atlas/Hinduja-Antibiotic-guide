from fastapi import FastAPI, HTTPException, status
from prometheus_fastapi_instrumentator import Instrumentator

from shared.schemas.common import ApiResponse
from shared.schemas.mobile import DashboardCard, DashboardMetadata
from shared.utils.health import register_health_routes
from shared.utils.logging import configure_logging

configure_logging("protocol-engine")
app = FastAPI(title="Protocol Engine", version="1.0.0", openapi_url="/api/v1/openapi.json")
register_health_routes(app, "protocol-engine")
Instrumentator().instrument(app).expose(app)
INFECTION_SITES = [
    DashboardCard(
        code="BSI", title="Blood Stream Infection (BSI)", icon="droplet", color="#C026D3"
    ),
    DashboardCard(
        code="UTI", title="Urinary Tract Infection (UTI)", icon="stethoscope", color="#2563EB"
    ),
    DashboardCard(
        code="RTI", title="Respiratory Tract Infection (RTI)", icon="lungs", color="#0284C7"
    ),
    DashboardCard(code="IAI", title="Intra-abdominal Infection", icon="stomach", color="#DC2626"),
    DashboardCard(code="CNS", title="CNS Infection", icon="brain", color="#0891B2"),
    DashboardCard(
        code="SSTI", title="Skin & Soft Tissue Infection (SSTI)", icon="cells", color="#16A34A"
    ),
    DashboardCard(code="FN", title="Febrile Neutropenia", icon="shield", color="#7C3AED"),
]


@app.get("/api/v1/mobile/dashboard", response_model=ApiResponse[DashboardMetadata])
async def dashboard():
    return ApiResponse(
        message="Dashboard metadata loaded",
        data=DashboardMetadata(
            doctor_name="Authenticated Doctor",
            search_placeholder="Search infection or guideline...",
            infection_sites=INFECTION_SITES,
            bottom_tabs=["Home", "Guidelines", "Duration", "Alerts", "Profile"],
        ),
    )


@app.get("/api/v1/protocols", response_model=ApiResponse[list[DashboardCard]])
async def protocols():
    return ApiResponse(message="Protocols loaded", data=INFECTION_SITES)


@app.post("/api/v1/protocols/evaluate", status_code=status.HTTP_410_GONE)
async def evaluate():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "The weighted protocol evaluator is retired. The supported mobile flow "
            "uses the exact active Supabase scenario view and fails closed."
        ),
    )


@app.get("/api/v1/protocols/result/{case_id}", status_code=status.HTTP_410_GONE)
async def result(case_id: str):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            f"Legacy protocol result {case_id!r} is unavailable because the weighted "
            "evaluation flow is retired."
        ),
    )
