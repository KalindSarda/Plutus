import csv
import io
import uuid
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.category import Category
from app.models.credit_card import CreditCard
from app.models.transaction import Transaction

REQUIRED_COLUMNS = {"date", "type", "amount", "category"}
ALLOWED_TYPES = {"income", "expense"}


def parse_csv(content: bytes, user_id: uuid.UUID, db: Session) -> list[dict]:
    """Parse CSV bytes and return preview rows with resolved IDs where possible."""
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded.")

    reader = csv.DictReader(io.StringIO(text))

    # Normalise column names (strip whitespace, lowercase)
    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="CSV appears to be empty.")

    fieldnames_lower = [f.strip().lower() for f in reader.fieldnames]
    missing = REQUIRED_COLUMNS - set(fieldnames_lower)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"CSV is missing required columns: {', '.join(sorted(missing))}. "
                   f"Required: date, type, amount, category",
        )

    # Cache lookups
    categories = db.query(Category).filter(
        (Category.user_id == user_id) | (Category.user_id == None)
    ).all()
    cat_map = {c.name.lower(): c for c in categories}

    accounts = db.query(Account).filter(Account.user_id == user_id, Account.is_active == True).all()
    acc_map = {a.name.lower(): a for a in accounts}

    cards = db.query(CreditCard).filter(CreditCard.user_id == user_id, CreditCard.is_active == True).all()
    card_map = {c.name.lower(): c for c in cards}

    rows = []
    for i, raw_row in enumerate(reader, start=2):  # row 2 = first data row
        # Normalise keys
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items()}

        errors = []

        # date
        raw_date = row.get("date", "")
        parsed_date = None
        try:
            parsed_date = date.fromisoformat(raw_date)
        except (ValueError, AttributeError):
            errors.append(f"Invalid date '{raw_date}' (expected YYYY-MM-DD)")

        # type
        tx_type = row.get("type", "").lower()
        if tx_type not in ALLOWED_TYPES:
            errors.append(f"Type must be 'income' or 'expense', got '{tx_type}'")

        # amount
        raw_amount = row.get("amount", "").replace(",", "").replace("₹", "")
        parsed_amount = None
        try:
            parsed_amount = Decimal(raw_amount)
            if parsed_amount <= 0:
                errors.append("Amount must be greater than 0")
        except InvalidOperation:
            errors.append(f"Invalid amount '{raw_amount}'")

        # category
        raw_cat = row.get("category", "").strip()
        category_id = None
        cat = cat_map.get(raw_cat.lower())
        if cat:
            category_id = str(cat.id)
        else:
            errors.append(f"Unknown category '{raw_cat}'")

        # optional: account
        raw_acc = row.get("account", "").strip()
        account_id = None
        if raw_acc:
            acc = acc_map.get(raw_acc.lower())
            if acc:
                account_id = str(acc.id)

        # optional: credit_card
        raw_cc = row.get("credit_card", "").strip()
        credit_card_id = None
        if raw_cc:
            cc = card_map.get(raw_cc.lower())
            if cc:
                credit_card_id = str(cc.id)

        notes = row.get("notes", "")
        tags_raw = row.get("tags", "")
        tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []

        rows.append({
            "row_number": i,
            "date": raw_date,
            "type": tx_type,
            "amount": str(parsed_amount) if parsed_amount else raw_amount,
            "category": raw_cat,
            "category_id": category_id,
            "account": raw_acc,
            "account_id": account_id,
            "credit_card": raw_cc,
            "credit_card_id": credit_card_id,
            "notes": notes,
            "tags": tags,
            "errors": errors,
            "valid": len(errors) == 0,
        })

    return rows


def confirm_import(rows: list[dict], user_id: uuid.UUID, db: Session) -> dict:
    """Bulk insert validated rows. Skips rows with errors."""
    valid_rows = [r for r in rows if r.get("valid") and not r.get("errors")]

    if not valid_rows:
        raise HTTPException(status_code=400, detail="No valid rows to import.")

    inserted = 0
    for row in valid_rows:
        try:
            tx = Transaction(
                user_id=user_id,
                date=date.fromisoformat(row["date"]),
                type=row["type"],
                amount=Decimal(row["amount"]),
                category_id=uuid.UUID(row["category_id"]),
                account_id=uuid.UUID(row["account_id"]) if row.get("account_id") else None,
                credit_card_id=uuid.UUID(row["credit_card_id"]) if row.get("credit_card_id") else None,
                notes=row.get("notes") or None,
                tags=row.get("tags") or [],
                is_recurring=False,
            )
            db.add(tx)
            inserted += 1
        except Exception:
            continue

    db.commit()
    return {"inserted": inserted, "skipped": len(rows) - inserted}
