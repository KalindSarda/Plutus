import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, field_validator


class AccountCreate(BaseModel):
    name: str
    type: Literal["savings", "current"]
    balance: Decimal = Decimal("0")
    bank_name: str

    @field_validator("name", "bank_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("must not be blank")
        return v.strip()


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[Literal["savings", "current"]] = None
    balance: Optional[Decimal] = None
    bank_name: Optional[str] = None
    is_active: Optional[bool] = None


class AccountResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    balance: Decimal
    bank_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
