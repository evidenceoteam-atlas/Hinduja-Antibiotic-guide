from fastapi import APIRouter, FastAPI


def register_health_routes(app: FastAPI, service_name: str) -> None:
    payload = {"status": "ok", "service": service_name}
    router = APIRouter()

    @router.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        return payload

    @router.get("/health", include_in_schema=False)
    async def health() -> dict[str, str]:
        return payload

    @router.get("/api/v1/health", tags=["health"])
    async def versioned_health() -> dict[str, str]:
        return payload

    app.include_router(router)
