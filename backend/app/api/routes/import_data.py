from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limiter import limiter
from app.api.dependencies import get_current_user
from app.models.user import User
from app.services import import_service

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_MIME_TYPES = {"text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"}


class ImportRow(BaseModel):
    row_number: int
    date: str
    type: str
    amount: str
    category: str
    category_id: str | None
    account: str
    account_id: str | None
    credit_card: str
    credit_card_id: str | None
    notes: str
    tags: list[str]
    errors: list[str]
    valid: bool


class ConfirmRequest(BaseModel):
    rows: list[ImportRow]


@router.post("/parse", response_model=list[ImportRow])
@limiter.limit("5/minute")
async def parse_import(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate MIME type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES and not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 5 MB limit.")

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty.")

    rows = import_service.parse_csv(content, current_user.id, db)
    return [ImportRow(**r) for r in rows]


@router.post("/confirm")
def confirm_import(
    body: ConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows_dicts = [r.model_dump() for r in body.rows]
    result = import_service.confirm_import(rows_dicts, current_user.id, db)
    return result
