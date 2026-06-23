from sqlalchemy.dialects.postgresql import ENUM

account_type_enum = ENUM("savings", "current", name="account_type", create_type=True)
category_type_enum = ENUM("income", "expense", name="category_type", create_type=True)
transaction_type_enum = ENUM("income", "expense", name="transaction_type", create_type=True)
frequency_enum = ENUM("daily", "weekly", "monthly", "yearly", name="frequency_type", create_type=True)
budget_period_enum = ENUM("monthly", "yearly", name="budget_period", create_type=True)
