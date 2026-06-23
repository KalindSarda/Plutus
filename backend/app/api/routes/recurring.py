import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.recurring import RecurringCreate, RecurringUpdate, RecurringResponse
from app.schemas.transaction import TransactionResponse
from app.services import recurring_service

router = APIRouter()


@router.get("", response_model=list[RecurringResponse])
def list_recurring(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return recurring_service.list_recurring(current_user.id, db)


@router.post("", response_model=RecurringResponse, status_code=status.HTTP_201_CREATED)
def create_recurring(
    data: RecurringCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return recurring_service.create_recurring(data, current_user.id, db)


@router.put("/{tmpl_id}", response_model=RecurringResponse)
def update_recurring(
    tmpl_id: uuid.UUID,
    data: RecurringUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return recurring_service.update_recurring(tmpl_id, data, current_user.id, db)


@router.delete("/{tmpl_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring(
    tmpl_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recurring_service.delete_recurring(tmpl_id, current_user.id, db)


@router.post("/{tmpl_id}/apply", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def apply_recurring(
    tmpl_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return recurring_service.apply_recurring(tmpl_id, current_user.id, db)
