import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.credit_card import CreditCardCreate, CreditCardUpdate, CreditCardResponse
from app.schemas.credit_card_statement import StatementResponse, PayStatementRequest, CurrentCycleResponse
from app.services import credit_card_service, cc_statement_service

router = APIRouter()


@router.get("", response_model=list[CreditCardResponse])
def list_credit_cards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return credit_card_service.list_credit_cards(current_user.id, db)


@router.post("", response_model=CreditCardResponse, status_code=status.HTTP_201_CREATED)
def create_credit_card(
    data: CreditCardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return credit_card_service.create_credit_card(data, current_user.id, db)


@router.get("/{card_id}", response_model=CreditCardResponse)
def get_credit_card(
    card_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return credit_card_service.get_credit_card(card_id, current_user.id, db)


@router.put("/{card_id}", response_model=CreditCardResponse)
def update_credit_card(
    card_id: uuid.UUID,
    data: CreditCardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return credit_card_service.update_credit_card(card_id, data, current_user.id, db)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_credit_card(
    card_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    credit_card_service.delete_credit_card(card_id, current_user.id, db)


@router.get("/{card_id}/current-cycle", response_model=CurrentCycleResponse)
def get_current_cycle(
    card_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return cc_statement_service.get_current_cycle(card_id, current_user.id, db)


@router.get("/{card_id}/statements", response_model=list[StatementResponse])
def list_statements(
    card_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return cc_statement_service.list_statements(card_id, current_user.id, db)


@router.post("/{card_id}/statements/{stmt_id}/pay", response_model=StatementResponse)
def pay_statement(
    card_id: uuid.UUID,
    stmt_id: uuid.UUID,
    data: PayStatementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return cc_statement_service.pay_statement(card_id, stmt_id, current_user.id, db, data.paid_amount)
