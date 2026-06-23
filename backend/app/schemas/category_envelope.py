import uuid
from typing import Optional

from pydantic import BaseModel, model_validator


class EnvelopeCreate(BaseModel):
    category_id: uuid.UUID
    account_id: Optional[uuid.UUID] = None
    credit_card_id: Optional[uuid.UUID] = None

    @model_validator(mode="after")
    def exactly_one_must_be_set(self):
        if self.account_id and self.credit_card_id:
            raise ValueError("Provide either account_id or credit_card_id, not both.")
        if not self.account_id and not self.credit_card_id:
            raise ValueError("Either account_id or credit_card_id is required.")
        return self


class EnvelopeUpdate(BaseModel):
    account_id: Optional[uuid.UUID] = None
    credit_card_id: Optional[uuid.UUID] = None

    @model_validator(mode="after")
    def not_both(self):
        if self.account_id and self.credit_card_id:
            raise ValueError("Provide either account_id or credit_card_id, not both.")
        return self


class EnvelopeResponse(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    category_name: str
    account_id: Optional[uuid.UUID] = None
    account_name: Optional[str] = None
    credit_card_id: Optional[uuid.UUID] = None
    cc_name: Optional[str] = None

    model_config = {"from_attributes": True}
