import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.schemas.category_envelope import EnvelopeCreate, EnvelopeResponse
from app.services import envelope_service

router = APIRouter()


@router.get("/", response_model=list[EnvelopeResponse])
def list_envelopes(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return envelope_service.list_envelopes(current_user.id, db)


@router.post("/", response_model=EnvelopeResponse)
def upsert_envelope(data: EnvelopeCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return envelope_service.upsert_envelope(
        data.category_id, data.account_id, data.credit_card_id, current_user.id, db
    )


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_envelope(category_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    envelope_service.delete_envelope(category_id, current_user.id, db)
