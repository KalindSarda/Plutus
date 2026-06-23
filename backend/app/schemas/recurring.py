import uuid
from datetime import date
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel


class RecurringCreate(BaseModel):
    name: str
    amount: Decimal
    type: Literal["income", "expense"]
    category_id: uuid.UUID
    account_id: Optional[uuid.UUID] = None
    credit_card_id: Optional[uuid.UUID] = None
    frequency: Literal["daily", "weekly", "monthly", "yearly"]
    next_due_date: date


class RecurringUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[Decimal] = None
    type: Optional[Literal["income", "expense"]] = None
    category_id: Optional[uuid.UUID] = None
    account_id: Optional[uuid.UUID] = None
    credit_card_id: Optional[uuid.UUID] = None
    frequency: Optional[Literal["daily", "weekly", "monthly", "yearly"]] = None
    next_due_date: Optional[date] = None
    is_active: Optional[bool] = None


class RecurringResponse(BaseModel):
    id: uuid.UUID
    name: str
    amount: Decimal
    type: str
    category_id: uuid.UUID
    account_id: Optional[uuid.UUID]
    credit_card_id: Optional[uuid.UUID]
    frequency: str
    next_due_date: date
    is_active: bool

    model_config = {"from_attributes": True}
