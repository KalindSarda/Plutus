import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.agents.session_store import session_store
from app.models.category import Category
from app.schemas.budget import BudgetCreate
from app.services import budget_service


def make_add_budget(user_id: uuid.UUID, db: Session, session_key: str):
    def add_budget(
        category_name: str,
        amount: float,
        period: Optional[str] = "monthly",
    ) -> str:
        """
        Set a budget for a category.

        Args:
            category_name: name of the category (partial match ok)
            amount: budget amount in rupees
            period: 'monthly' or 'yearly' (defaults to 'monthly')
        """
        try:
            # 1. Resolve category
            category = (
                db.query(Category)
                .filter(
                    Category.name.ilike(f"%{category_name}%"),
                    (Category.user_id == user_id) | (Category.user_id == None),
                )
                .first()
            )
            if not category:
                return f"Category '{category_name}' not found. Please check the category name."

            # 2. Validate period
            if period not in ("monthly", "yearly"):
                period = "monthly"

            # 3. Build and create budget
            today = date.today()
            data = BudgetCreate(
                category_id=category.id,
                amount=Decimal(str(amount)),
                period=period,
                start_date=today.replace(day=1),
            )
            budget = budget_service.create_budget(data, user_id, db)

            # 4. Store last action
            session_store.set_last_action(
                session_key,
                {
                    "type": "budget_created",
                    "resource_type": "budget",
                    "resource_id": str(budget.id),
                    "undo_data": {},
                },
            )

            return f"Budget set: ₹{float(budget.amount):,.2f}/{period.replace('ly', '')} for {category.name}"

        except Exception as e:
            return f"Failed to add budget: {str(e)}"

    return add_budget
