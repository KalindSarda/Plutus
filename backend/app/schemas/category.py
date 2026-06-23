import uuid
from typing import Optional, Literal
from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    type: Literal["income", "expense"]
    parent_id: Optional[uuid.UUID] = None
    color: str = "#5a7a6a"
    icon: str = "📦"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    parent_id: Optional[uuid.UUID]
    color: str
    icon: str
    is_default: bool
    user_id: Optional[uuid.UUID]

    model_config = {"from_attributes": True}
