from pydantic import BaseModel, Field


class SendOtpRequest(BaseModel):
    identity: str = Field(description="Hospital email, mobile number, or hospital ID")
    device_id: str | None = None
    channel: str = "sms"


class VerifyOtpRequest(BaseModel):
    identity: str
    otp: str = Field(min_length=4, max_length=8)
    device_id: str | None = None
    platform: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str
    device_id: str | None = None


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserProfile(BaseModel):
    id: str
    full_name: str
    role: str
    department: str | None = None
    hospital: str = "P. D. Hinduja Hospital & Medical Research Centre"
