import csv
import io
from datetime import date
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.services import report_service

router = APIRouter()


class CategoryAmountSchema(BaseModel):
    category_name: str
    amount: Decimal
    type: str


class MonthlySummaryResponse(BaseModel):
    year: int
    month: int
    total_income: Decimal
    total_expense: Decimal
    net_savings: Decimal
    total_balance: Decimal
    top_categories: List[CategoryAmountSchema]


class CategoryBreakdownItem(BaseModel):
    category_name: str
    color: str
    icon: str
    type: str
    amount: Decimal
    percentage: Optional[float]


class MonthlyTrendItem(BaseModel):
    year: int
    month: int
    month_label: str
    income: Decimal
    expense: Decimal
    savings: Decimal


class NetWorthResponse(BaseModel):
    total_assets: Decimal
    total_liabilities: Decimal
    net_worth: Decimal


class ProjectionResponse(BaseModel):
    avg_income: Decimal
    avg_expense: Decimal
    projected_savings: Decimal
    based_on_months: int


@router.get("/summary", response_model=MonthlySummaryResponse)
def monthly_summary(
    year: int = Query(default=None),
    month: int = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    y = year if year else today.year
    m = month if month else today.month
    result = report_service.get_monthly_summary(current_user.id, db, y, m)
    return MonthlySummaryResponse(
        year=result["year"],
        month=result["month"],
        total_income=result["total_income"],
        total_expense=result["total_expense"],
        net_savings=result["net_savings"],
        total_balance=result["total_balance"],
        top_categories=[CategoryAmountSchema(**c) for c in result["top_categories"]],
    )


@router.get("/categories", response_model=List[CategoryBreakdownItem])
def category_breakdown(
    year: int = Query(default=None),
    month: int = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    y = year if year else today.year
    m = month if month else today.month
    rows = report_service.get_category_breakdown(current_user.id, db, y, m)
    return [CategoryBreakdownItem(**r) for r in rows]


@router.get("/trends", response_model=List[MonthlyTrendItem])
def monthly_trends(
    months: int = Query(default=6, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = report_service.get_monthly_trends(current_user.id, db, months)
    return [MonthlyTrendItem(**r) for r in rows]


@router.get("/net-worth", response_model=NetWorthResponse)
def net_worth(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = report_service.get_net_worth(current_user.id, db)
    return NetWorthResponse(**result)


@router.get("/projection", response_model=ProjectionResponse)
def projection(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = report_service.get_projection(current_user.id, db)
    return ProjectionResponse(**result)


def _sanitize_csv_cell(value: str) -> str:
    """Prefix formula-starting characters to prevent CSV injection."""
    if value and value[0] in ("=", "-", "+", "@", "\t", "\r"):
        return "'" + value
    return value


@router.get("/export")
def export_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = report_service.get_all_transactions_for_export(current_user.id, db)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["date", "type", "amount", "category", "account", "credit_card", "notes", "tags", "is_recurring"],
        quoting=csv.QUOTE_ALL,
    )
    writer.writeheader()
    for row in rows:
        writer.writerow({
            "date": row["date"],
            "type": row["type"],
            "amount": row["amount"],
            "category": _sanitize_csv_cell(row["category"]),
            "account": _sanitize_csv_cell(row["account"]),
            "credit_card": _sanitize_csv_cell(row["credit_card"]),
            "notes": _sanitize_csv_cell(row["notes"]),
            "tags": _sanitize_csv_cell(row["tags"]),
            "is_recurring": row["is_recurring"],
        })

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=plutus_transactions.csv"},
    )
