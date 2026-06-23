import uuid

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.credit_card import CreditCard


def make_get_account_balances(user_id: uuid.UUID, db: Session):
    def get_account_balances() -> str:
        """Get current bank account balances and total assets."""
        accounts = (
            db.query(Account)
            .filter(Account.user_id == user_id, Account.is_active == True)
            .all()
        )
        cards = (
            db.query(CreditCard)
            .filter(CreditCard.user_id == user_id, CreditCard.is_active == True)
            .all()
        )

        if not accounts and not cards:
            return "No bank accounts or credit cards found."

        lines = []
        total_bank = sum(a.balance for a in accounts)
        total_cc_outstanding = sum(c.current_outstanding for c in cards)

        if accounts:
            lines.append("Bank Accounts:")
            for a in accounts:
                lines.append(f"  {a.name} ({a.bank_name}, {a.type}): ₹{a.balance:,.2f}")
            lines.append(f"  Total bank balance: ₹{total_bank:,.2f}")

        if cards:
            lines.append("\nCredit Cards:")
            for c in cards:
                lines.append(
                    f"  {c.name} ({c.bank_name}): "
                    f"Outstanding ₹{c.current_outstanding:,.2f}, "
                    f"Available ₹{c.available_limit:,.2f} of ₹{c.credit_limit:,.2f}"
                )
            lines.append(f"  Total CC outstanding: ₹{total_cc_outstanding:,.2f}")

        net_worth = total_bank - total_cc_outstanding
        lines.append(f"\nNet worth (bank − CC outstanding): ₹{net_worth:,.2f}")

        return "\n".join(lines)

    return get_account_balances
