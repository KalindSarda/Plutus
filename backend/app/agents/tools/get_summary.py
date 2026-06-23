import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.services.report_service import get_monthly_summary


def make_get_summary(user_id: uuid.UUID, db: Session):
    def get_summary() -> str:
        """Get the current month's income, expenses, and net savings summary."""
        today = date.today()
        data = get_monthly_summary(user_id, db, today.year, today.month)

        income = data["total_income"]
        expense = data["total_expense"]
        savings = data["net_savings"]
        balance = data["total_balance"]
        cats = data["top_categories"]

        lines = [
            f"Month: {today.strftime('%B %Y')}",
            f"Total Income:  ₹{income:,.2f}",
            f"Total Expense: ₹{expense:,.2f}",
            f"Net Savings:   ₹{savings:,.2f}",
            f"Total Bank Balance: ₹{balance:,.2f}",
        ]
        if cats:
            lines.append("\nTop categories:")
            for c in cats:
                lines.append(f"  {c['category_name']} ({c['type']}): ₹{c['amount']:,.2f}")

        return "\n".join(lines)

    return get_summary
