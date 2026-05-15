from fastapi import FastAPI

from shared.schemas.common import ApiResponse
from shared.utils.health import register_health_routes
from shared.utils.logging import configure_logging

configure_logging("user-service")
app = FastAPI(
    title="User & Role Management Service", version="1.0.0", openapi_url="/api/v1/openapi.json"
)
register_health_routes(app, "user-service")

USERS = [
    {
        "id": "doctor-1",
        "full_name": "Dr. Ananya Sharma",
        "role": "Doctor",
        "department": "Medicine",
    },
    {
        "id": "steward-1",
        "full_name": "Stewardship Team",
        "role": "Stewardship Team",
        "department": "ID",
    },
]
ROLES = [
    {"name": "Doctor", "permissions": ["protocol:evaluate", "case:write", "report:export"]},
    {"name": "Admin", "permissions": ["*"]},
    {"name": "Stewardship Team", "permissions": ["alert:read", "alert:acknowledge"]},
    {
        "name": "Infectious Disease Specialist",
        "permissions": ["protocol:override", "guideline:publish"],
    },
]


@app.get("/api/v1/users", response_model=ApiResponse[list[dict]])
async def users():
    return ApiResponse(message="Users loaded", data=USERS)


@app.get("/api/v1/users/{user_id}", response_model=ApiResponse[dict])
async def user(user_id: str):
    return ApiResponse(
        message="User loaded", data=next((item for item in USERS if item["id"] == user_id), {})
    )


@app.patch("/api/v1/users/{user_id}", response_model=ApiResponse[dict])
async def update_user(user_id: str, payload: dict):
    return ApiResponse(message="User updated", data={"id": user_id, **payload})


@app.get("/api/v1/roles", response_model=ApiResponse[list[dict]])
async def roles():
    return ApiResponse(message="Roles loaded", data=ROLES)
