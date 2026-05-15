from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str
    data: T | None = None
    meta: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    data: None = None
    meta: dict[str, Any] = Field(default_factory=dict)


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
