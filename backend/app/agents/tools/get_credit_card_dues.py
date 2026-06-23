import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.models.credit_card import CreditCard
from app.models.credit_card_statement import CreditCardStatement


def make_get_credit_card_dues(user_id: uuid.UUID, db: Session):
    def get_credit_card_dues() -> str:
        """Get credit card outstanding balances, available limits, and upcoming due dates."""
        cards = (
            db.query(CreditCard)
            .filter(CreditCard.user_id == user_id, CreditCard.is_active == True)
            .all()
        )

        if not cards:
            return "No active credit cards."

        today = date.today()
        lines = ["Credit card status:"]

        for card in cards:
            util_pct = float(card.current_outstanding / card.credit_limit * 100) if card.credit_limit else 0
            util_status = "⚠️ High" if util_pct >= 80 else "✅ Good"

            # Find unpaid statement
            stmt = (
                db.query(CreditCardStatement)
                .filter(
                    CreditCardStatement.credit_card_id == card.id,
                    CreditCardStatement.is_paid == False,
                )
                .order_by(CreditCardStatement.due_date)
                .first()
            )

            due_info = ""
            if stmt:
                days_left = (stmt.due_date - today).days
                due_info = f" | Due: ₹{stmt.total_amount:,.2f} on {stmt.due_date} ({days_left}d left)"

            lines.append(
                f"  {card.name} ({card.bank_name}): "
                f"Outstanding ₹{card.current_outstanding:,.2f}, "
                f"Available ₹{card.available_limit:,.2f} / ₹{card.credit_limit:,.2f} "
                f"({util_pct:.0f}% utilisation — {util_status})"
                + due_info
            )

        return "\n".join(lines)

    return get_credit_card_dues
