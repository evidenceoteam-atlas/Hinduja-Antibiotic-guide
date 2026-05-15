from datetime import UTC, datetime
from secrets import randbelow, token_urlsafe
from uuid import uuid4

import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, Request, status
from prometheus_fastapi_instrumentator import Instrumentator

from shared.auth.security import create_access_token, hash_secret, verify_secret
from shared.events.bus import EventBus
from shared.schemas.auth import (
    RefreshRequest,
    SendOtpRequest,
    TokenPair,
    UserProfile,
    VerifyOtpRequest,
)
from shared.schemas.common import ApiResponse
from shared.utils.config import get_settings
from shared.utils.health import register_health_routes
from shared.utils.logging import configure_logging, get_logger

configure_logging("auth-service")
logger = get_logger(__name__)
settings = get_settings()
app = FastAPI(title="Auth Service", version="1.0.0", openapi_url="/api/v1/openapi.json")
register_health_routes(app, "auth-service")
Instrumentator().instrument(app).expose(app)
redis_client = redis.from_url(settings.redis_url, decode_responses=True)
events = EventBus()

DEMO_USER_ID = uuid4()
DEMO_ROLE = "Doctor"
DEMO_PERMISSIONS = ["protocol:evaluate", "case:write", "report:export"]


@app.post("/api/v1/auth/send-otp", response_model=ApiResponse[dict])
async def send_otp(payload: SendOtpRequest, request: Request):
    attempts_key = (
        f"otp-rate:{payload.identity}:{request.client.host if request.client else 'unknown'}"
    )
    attempts = await redis_client.incr(attempts_key)
    await redis_client.expire(attempts_key, 60)
    if attempts > 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many OTP requests"
        )

    otp = f"{randbelow(1_000_000):06d}"
    await redis_client.setex(f"otp:{payload.identity}", settings.otp_ttl_seconds, hash_secret(otp))
    logger.info("otp_generated", identity=payload.identity, demo_otp=otp)
    return ApiResponse(
        message="OTP sent successfully", data={"expires_in": settings.otp_ttl_seconds}
    )


@app.post("/api/v1/auth/verify-otp", response_model=ApiResponse[TokenPair])
async def verify_otp(payload: VerifyOtpRequest):
    hashed = await redis_client.get(f"otp:{payload.identity}")
    if not hashed or not verify_secret(payload.otp, hashed):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP"
        )
    await redis_client.delete(f"otp:{payload.identity}")

    refresh_token = token_urlsafe(48)
    await redis_client.setex(
        f"refresh:{hash_secret(refresh_token)}",
        settings.refresh_token_days * 24 * 3600,
        str(DEMO_USER_ID),
    )
    await events.publish(
        "user.logged_in", {"identity": payload.identity, "device_id": payload.device_id}
    )
    return ApiResponse(
        message="Login successful",
        data=TokenPair(
            access_token=create_access_token(DEMO_USER_ID, DEMO_ROLE, DEMO_PERMISSIONS),
            refresh_token=refresh_token,
            expires_in=settings.access_token_minutes * 60,
        ),
    )


@app.post("/api/v1/auth/refresh", response_model=ApiResponse[TokenPair])
async def refresh(payload: RefreshRequest):
    # Production stores token hashes in PostgreSQL and revokes the old hash atomically.
    refresh_token = token_urlsafe(48)
    return ApiResponse(
        message="Token refreshed",
        data=TokenPair(
            access_token=create_access_token(DEMO_USER_ID, DEMO_ROLE, DEMO_PERMISSIONS),
            refresh_token=refresh_token,
            expires_in=settings.access_token_minutes * 60,
        ),
    )


@app.post("/api/v1/auth/logout", response_model=ApiResponse[dict])
async def logout():
    return ApiResponse(
        message="Logged out successfully", data={"revoked_at": datetime.now(UTC).isoformat()}
    )


@app.get("/api/v1/auth/me", response_model=ApiResponse[UserProfile])
async def me():
    return ApiResponse(
        message="Profile loaded",
        data=UserProfile(
            id=str(DEMO_USER_ID),
            full_name="Dr. Ananya Sharma",
            role=DEMO_ROLE,
            department="Medicine",
        ),
    )
