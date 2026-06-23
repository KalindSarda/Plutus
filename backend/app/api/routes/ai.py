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


class ChatResponse(BaseModel):
    response: str
    session_id: str


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
def chat(
    request: Request,
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        response_text = run_agent(
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

    return ChatResponse(response=response_text, session_id=body.session_id)


@router.delete("/session/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def clear_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    session_key = f"{current_user.id}:{session_id}"
    session_store.delete_session(session_key)
