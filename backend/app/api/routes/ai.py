import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limiter import limiter
from app.api.dependencies import get_current_user
from app.agents.plutus_agent import run_agent
from app.agents.session_store import session_store
from app.models.user import User

router = APIRouter()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str = Field(..., min_length=1, max_length=64)


class ActionMeta(BaseModel):
    type: str
    resource_type: str
    resource_id: str
    undo_data: dict


class ChatResponse(BaseModel):
    response: str
    session_id: str
    action: Optional[ActionMeta] = None


_GREET_TRIGGER = (
    "[INTERNAL TRIGGER — not from the user] "
    "The user just opened Plutus. Greet them briefly and personally. "
    "Call get_summary and get_account_balances first, then craft a 1-2 sentence greeting "
    "that references something real — recent spending, savings, or balance. "
    "Sound like a friend who's been watching their finances, not a bot starting fresh. "
    "No generic welcome. No markdown. No emojis."
)

_emoji_re = re.compile(
    "[\U00002600-\U000027BF]|[\U0001F300-\U0001FAFF]|[\U00002702-\U000027B0]",
    flags=re.UNICODE,
)


@router.get("/greet", response_model=ChatResponse)
@limiter.limit("10/minute")
def greet(
    request: Request,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = run_agent(
            user_message=_GREET_TRIGGER,
            session_id=session_id,
            user_id=current_user.id,
            db=db,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is temporarily unavailable.",
        ) from exc

    clean_text = _emoji_re.sub("", result["text"]).strip()
    return ChatResponse(response=clean_text, session_id=session_id, action=None)


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
def chat(
    request: Request,
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = run_agent(
            user_message=body.message,
            session_id=body.session_id,
            user_id=current_user.id,
            db=db,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is temporarily unavailable. Please try again.",
        ) from exc

    clean_text = _emoji_re.sub("", result["text"]).strip()

    return ChatResponse(
        response=clean_text,
        session_id=body.session_id,
        action=result["action"],
    )


@router.delete("/session/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def clear_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    session_key = f"{current_user.id}:{session_id}"
    session_store.delete_session(session_key)


@router.post("/undo/{session_id}", status_code=status.HTTP_200_OK)
@limiter.limit("20/minute")
def undo_last_action(
    request: Request,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_key = f"{current_user.id}:{session_id}"
    action = session_store.get_last_action(session_key)
    if not action:
        raise HTTPException(status_code=404, detail="Nothing to undo.")

    import uuid as _uuid
    resource_id = _uuid.UUID(action["resource_id"])
    undo_data = action.get("undo_data", {})
    action_type = action["type"]

    try:
        if action_type == "transaction_created":
            from app.services.transaction_service import delete_transaction
            delete_transaction(resource_id, current_user.id, db)

        elif action_type == "transaction_updated":
            from app.services.transaction_service import update_transaction
            from app.schemas.transaction import TransactionUpdate
            update_transaction(resource_id, TransactionUpdate(**undo_data), current_user.id, db)

        elif action_type == "transaction_deleted":
            from app.services.transaction_service import create_transaction
            from app.schemas.transaction import TransactionCreate
            from datetime import date as _date
            from decimal import Decimal
            # undo_data is a full snapshot; reconstruct TransactionCreate
            data = dict(undo_data)
            data["date"] = _date.fromisoformat(data["date"])
            data["amount"] = Decimal(str(data["amount"]))
            for k in ("account_id", "credit_card_id", "category_id", "recurring_template_id"):
                if data.get(k):
                    data[k] = _uuid.UUID(data[k])
            create_transaction(TransactionCreate(**data), current_user.id, db)

        elif action_type == "budget_created":
            from app.services.budget_service import delete_budget
            delete_budget(resource_id, current_user.id, db)

        elif action_type == "budget_updated":
            from app.services.budget_service import update_budget
            from app.schemas.budget import BudgetUpdate
            update_budget(resource_id, BudgetUpdate(**undo_data), current_user.id, db)

        elif action_type == "account_created":
            from app.services.account_service import delete_account
            delete_account(resource_id, current_user.id, db)

        elif action_type == "account_updated":
            from app.services.account_service import update_account
            from app.schemas.account import AccountUpdate
            update_account(resource_id, AccountUpdate(**undo_data), current_user.id, db)

        elif action_type == "envelope_set":
            from app.services.envelope_service import delete_envelope
            import uuid as _uuid2
            cat_id = _uuid2.UUID(undo_data.get("category_id", action["resource_id"]))
            delete_envelope(cat_id, current_user.id, db)

        else:
            raise HTTPException(status_code=400, detail=f"Unknown action type: {action_type}")

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Undo failed: {str(exc)}") from exc

    session_store.clear_last_action(session_key)
    return {"message": "Undone."}
