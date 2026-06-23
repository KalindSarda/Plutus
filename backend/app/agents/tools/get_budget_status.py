import uuid
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.category import Category
from app.models.transaction import Transaction


def make_get_budget_status(user_id: uuid.UUID, db: Session):
    def get_budget_status() -> str:
        """Get current budget usage and remaining amounts for this month."""
        budgets = (
            db.query(Budget)
            .filter(Budget.user_id == user_id)
            .all()
        )

        if not budgets:
            return "No budgets set up."

        today = date.today()
        month_start = date(today.year, today.month, 1)
        month_end = date(today.year + 1, 1, 1) if today.month == 12 else date(today.year, today.month + 1, 1)

        lines = [f"Budget status for {today.strftime('%B %Y')}:"]

        for b in budgets:
            cat = db.query(Category).filter(Category.id == b.category_id).first()
            cat_name = cat.name if cat else str(b.category_id)

            spent = (
                db.query(func.sum(Transaction.amount))
                .filter(
                    Transaction.user_id == user_id,
                    Transaction.category_id == b.category_id,
                    Transaction.type == "expense",
                    Transaction.date >= month_start,
                    Transaction.date < month_end,
                )
                .scalar()
            ) or 0

            pct = float(spent / b.amount * 100) if b.amount else 0
            remaining = b.amount - spent
            status = "⚠️ OVER" if pct > 100 else ("⚡ Near limit" if pct >= 80 else "✅ OK")

            lines.append(
                f"  {cat_name}: ₹{spent:,.2f} / ₹{b.amount:,.2f} ({pct:.0f}%) — {status}"
                + (f" | Remaining: ₹{remaining:,.2f}" if pct <= 100 else f" | Over by: ₹{abs(remaining):,.2f}")
            )

        return "\n".join(lines)

    return get_budget_status
