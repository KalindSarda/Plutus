import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.transaction import Transaction


def make_get_transactions(user_id: uuid.UUID, db: Session):
    def get_transactions(
        type: Optional[str] = None,
        category_name: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 10,
    ) -> str:
        """
        Get recent transactions with optional filters.

        Args:
            type: Filter by 'income' or 'expense'
            category_name: Filter by category name (partial match)
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            limit: Max number of results (1-20)
        """
        limit = min(max(1, limit), 20)

        query = (
            db.query(Transaction, Category.name.label("cat_name"))
            .outerjoin(Category, Transaction.category_id == Category.id)
            .filter(Transaction.user_id == user_id)
        )

        if type and type.lower() in ("income", "expense"):
            query = query.filter(Transaction.type == type.lower())

        if category_name:
            query = query.join(Category, Transaction.category_id == Category.id, isouter=True).filter(
                Category.name.ilike(f"%{category_name}%")
            )

        if start_date:
            try:
                query = query.filter(Transaction.date >= date.fromisoformat(start_date))
            except ValueError:
                pass

        if end_date:
            try:
                query = query.filter(Transaction.date <= date.fromisoformat(end_date))
            except ValueError:
                pass

        rows = query.order_by(Transaction.date.desc()).limit(limit).all()

        if not rows:
            return "No transactions found matching the criteria."

        lines = [f"Recent transactions ({len(rows)} results):"]
        for tx, cat_name in rows:
            sign = "+" if tx.type == "income" else "-"
            lines.append(
                f"  {tx.date} | {sign}₹{tx.amount:,.2f} | {cat_name or 'Unknown'}"
                + (f" | {tx.notes}" if tx.notes else "")
            )

        return "\n".join(lines)

    return get_transactions
