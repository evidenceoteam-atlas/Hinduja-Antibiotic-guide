from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.database.base import Base, TimestampMixin, UUIDMixin


class Hospital(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "hospitals"
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)


class Role(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "roles"
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    permissions: Mapped[dict] = mapped_column(JSONB, default=dict)


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"
    hospital_id: Mapped[UUID | None] = mapped_column(ForeignKey("hospitals.id"), nullable=True)
    role_id: Mapped[UUID | None] = mapped_column(ForeignKey("roles.id"), nullable=True)
    full_name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    mobile: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    department: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    role: Mapped[Role | None] = relationship()
    hospital: Mapped[Hospital | None] = relationship()


class OtpSession(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "otp_sessions"
    identity: Mapped[str] = mapped_column(String(255), index=True)
    otp_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)


class UserDevice(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "user_devices"
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    device_id: Mapped[str] = mapped_column(String(160), index=True)
    platform: Mapped[str | None] = mapped_column(String(80))
    last_ip: Mapped[str | None] = mapped_column(String(80))


class RefreshToken(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "refresh_tokens"
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    device_id: Mapped[str | None] = mapped_column(String(160))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rotated_from_id: Mapped[UUID | None] = mapped_column(ForeignKey("refresh_tokens.id"))


class LoginAuditLog(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "login_audit_logs"
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    identity: Mapped[str] = mapped_column(String(255), index=True)
    ip_address: Mapped[str | None] = mapped_column(String(80))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(40))


class InfectionSite(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "infection_sites"
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    icon: Mapped[str | None] = mapped_column(String(80))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Protocol(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "protocols"
    infection_site_id: Mapped[UUID] = mapped_column(ForeignKey("infection_sites.id"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(40), default="published")
    current_version_id: Mapped[UUID | None] = mapped_column(nullable=True)
    infection_site: Mapped[InfectionSite] = relationship()


class ProtocolVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "protocol_versions"
    protocol_id: Mapped[UUID] = mapped_column(ForeignKey("protocols.id"), index=True)
    version: Mapped[str] = mapped_column(String(40))
    rules: Mapped[dict] = mapped_column(JSONB)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    __table_args__ = (UniqueConstraint("protocol_id", "version"),)


class RiskQuestion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "risk_questions"
    protocol_version_id: Mapped[UUID | None] = mapped_column(ForeignKey("protocol_versions.id"))
    key: Mapped[str] = mapped_column(String(120), index=True)
    text: Mapped[str] = mapped_column(Text)
    weight: Mapped[int] = mapped_column(Integer, default=1)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Antibiotic(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "antibiotics"
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    class_name: Mapped[str | None] = mapped_column(String(120))
    stewardship_level: Mapped[str] = mapped_column(String(40), default="standard")


class Organism(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "organisms"
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    gram_stain: Mapped[str | None] = mapped_column(String(40))


class SensitivityRecord(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "sensitivity_records"
    hospital_id: Mapped[UUID | None] = mapped_column(ForeignKey("hospitals.id"), index=True)
    department: Mapped[str | None] = mapped_column(String(120), index=True)
    organism_id: Mapped[UUID] = mapped_column(ForeignKey("organisms.id"), index=True)
    antibiotic_id: Mapped[UUID] = mapped_column(ForeignKey("antibiotics.id"), index=True)
    sensitivity_percent: Mapped[float] = mapped_column(Numeric(5, 2))
    isolate_count: Mapped[int] = mapped_column(Integer)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    organism: Mapped[Organism] = relationship()
    antibiotic: Mapped[Antibiotic] = relationship()
    __table_args__ = (
        Index("ix_sensitivity_org_abx_period", "organism_id", "antibiotic_id", "period_end"),
    )


class TherapyRecommendation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "therapy_recommendations"
    protocol_version_id: Mapped[UUID | None] = mapped_column(ForeignKey("protocol_versions.id"))
    infection_code: Mapped[str] = mapped_column(String(40), index=True)
    risk_type: Mapped[str] = mapped_column(String(40), index=True)
    antibiotic_name: Mapped[str] = mapped_column(String(160))
    dose: Mapped[str] = mapped_column(String(120))
    frequency: Mapped[str] = mapped_column(String(80))
    duration: Mapped[str] = mapped_column(String(120))
    coverage: Mapped[list] = mapped_column(JSONB, default=list)
    notes: Mapped[str | None] = mapped_column(Text)


class PatientCase(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "patient_cases"
    doctor_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    case_reference: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    infection_code: Mapped[str] = mapped_column(String(40), index=True)
    setting: Mapped[str] = mapped_column(String(40))
    acquisition: Mapped[str] = mapped_column(String(40))
    risk_type: Mapped[str] = mapped_column(String(40), index=True)
    risk_score: Mapped[int] = mapped_column(Integer)
    recommendation: Mapped[dict] = mapped_column(JSONB)


class StewardshipAlert(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "stewardship_alerts"
    case_id: Mapped[UUID | None] = mapped_column(ForeignKey("patient_cases.id"), index=True)
    severity: Mapped[str] = mapped_column(String(40), index=True)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="open", index=True)
    acknowledged_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Guideline(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "guidelines"
    title: Mapped[str] = mapped_column(String(220), index=True)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    markdown: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="draft")
    version: Mapped[str] = mapped_column(String(40), default="0.1")
    attachment_url: Mapped[str | None] = mapped_column(String(500))


class AuditLog(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    resource_type: Mapped[str] = mapped_column(String(120), index=True)
    resource_id: Mapped[str | None] = mapped_column(String(120), index=True)
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict)
