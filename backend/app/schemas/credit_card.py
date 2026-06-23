import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, field_validator


class CreditCardCreate(BaseModel):
    name: str
    bank_name: str
    credit_limit: Decimal
    current_outstanding: Decimal = Decimal("0")
    billing_cycle_day: int
    due_day: int

    @field_validator("name", "bank_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("must not be blank")
        return v.strip()

    @field_validator("credit_limit")
    @classmethod
    def positive_limit(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("credit_limit must be positive")
        return v

    @field_validator("billing_cycle_day", "due_day")
    @classmethod
    def valid_day(cls, v: int) -> int:
        if not 1 <= v <= 31:
            raise ValueError("must be between 1 and 31")
        return v


class CreditCardUpdate(BaseModel):
    name: Optional[str] = None
    bank_name: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    current_outstanding: Optional[Decimal] = None
    billing_cycle_day: Optional[int] = None
    due_day: Optional[int] = None
    is_active: Optional[bool] = None


class CreditCardResponse(BaseModel):
    id: uuid.UUID
    name: str
    bank_name: str
    credit_limit: Decimal
    current_outstanding: Decimal
    available_limit: Decimal
    billing_cycle_day: int
    due_day: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
