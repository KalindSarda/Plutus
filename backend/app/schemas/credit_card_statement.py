import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class StatementResponse(BaseModel):
    id: uuid.UUID
    credit_card_id: uuid.UUID
    billing_period_start: date
    billing_period_end: date
    total_amount: Decimal
    due_date: date
    is_paid: bool
    paid_date: Optional[date]
    paid_amount: Optional[Decimal]

    model_config = {"from_attributes": True}


class PayStatementRequest(BaseModel):
    paid_amount: Decimal


class CurrentCycleResponse(BaseModel):
    credit_card_id: uuid.UUID
    billing_cycle_day: int
    cycle_start: date
    total_spent: Decimal
    transaction_count: int
