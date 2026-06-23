"""
Seed default categories and subcategories.
Run: python seed_data.py  (from the backend/ directory)
Idempotent — safe to run multiple times.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.category import Category

EXPENSE_CATEGORIES = [
    {
        "name": "Food & Dining",
        "color": "#6b9df5",
        "icon": "🍽️",
        "subcategories": ["Breakfast", "Lunch", "Dinner", "Snacks", "Coffee", "Takeaway"],
    },
    {
        "name": "Groceries",
        "color": "#5abf8a",
        "icon": "🛒",
        "subcategories": ["Vegetables & Fruits", "Dairy", "Packaged Foods", "Household Supplies"],
    },
    {
        "name": "Transport",
        "color": "#9b74d9",
        "icon": "🚗",
        "subcategories": ["Cab", "Auto", "Metro", "Bus", "Train", "Flight", "Fuel", "Parking"],
    },
    {
        "name": "Shopping",
        "color": "#f0a429",
        "icon": "🛍️",
        "subcategories": ["Clothing", "Electronics", "Accessories", "Home & Furniture"],
    },
    {
        "name": "Housing",
        "color": "#30c4d8",
        "icon": "🏠",
        "subcategories": ["Rent", "Maintenance", "Repairs"],
    },
    {
        "name": "Utilities",
        "color": "#8098c4",
        "icon": "⚡",
        "subcategories": ["Electricity", "Water", "Gas", "Internet", "Mobile Recharge"],
    },
    {
        "name": "Entertainment",
        "color": "#d468a4",
        "icon": "🎬",
        "subcategories": ["OTT Subscriptions", "Movies", "Events", "Games"],
    },
    {
        "name": "Healthcare",
        "color": "#e87d3e",
        "icon": "🏥",
        "subcategories": ["Doctor", "Medicine", "Lab Tests", "Fitness"],
    },
    {
        "name": "Education",
        "color": "#5abf8a",
        "icon": "📚",
        "subcategories": ["Courses", "Books", "Fees"],
    },
    {
        "name": "Travel",
        "color": "#6b9df5",
        "icon": "✈️",
        "subcategories": ["Hotel", "Food (Travel)", "Sightseeing", "Visa & Documents"],
    },
    {
        "name": "Insurance",
        "color": "#8098c4",
        "icon": "🛡️",
        "subcategories": ["Health", "Vehicle", "Life", "Others"],
    },
    {
        "name": "EMI / Loan",
        "color": "#f26d6d",
        "icon": "💳",
        "subcategories": ["Home Loan", "Personal Loan", "Vehicle Loan", "Others"],
    },
    {
        "name": "Personal Care",
        "color": "#d468a4",
        "icon": "💄",
        "subcategories": ["Salon", "Skincare", "Clothing Accessories"],
    },
    {
        "name": "Gifts & Donations",
        "color": "#f0a429",
        "icon": "🎁",
        "subcategories": ["Gifts", "Charity", "Religious"],
    },
    {
        "name": "Miscellaneous",
        "color": "#5a7a6a",
        "icon": "📦",
        "subcategories": [],
    },
]

INCOME_CATEGORIES = [
    {
        "name": "Salary",
        "color": "#3dd68c",
        "icon": "💼",
        "subcategories": ["Base Pay", "Bonus", "Incentive"],
    },
    {
        "name": "Freelance",
        "color": "#c8a84b",
        "icon": "💻",
        "subcategories": ["Project", "Consulting", "Referral"],
    },
    {
        "name": "Business",
        "color": "#f0a429",
        "icon": "🏢",
        "subcategories": ["Revenue", "Reimbursement"],
    },
    {
        "name": "Investments",
        "color": "#30c4d8",
        "icon": "📈",
        "subcategories": ["Dividends", "Capital Gains", "Interest"],
    },
    {"name": "Rental Income", "color": "#6b9df5", "icon": "🏘️", "subcategories": []},
    {"name": "Gifts Received", "color": "#f0a429", "icon": "🎀", "subcategories": []},
    {"name": "Refunds", "color": "#5abf8a", "icon": "🔄", "subcategories": []},
    {"name": "Other Income", "color": "#5a7a6a", "icon": "💰", "subcategories": []},
]


def seed():
    db = SessionLocal()
    try:
        inserted = 0
        for cat_type, categories in [("expense", EXPENSE_CATEGORIES), ("income", INCOME_CATEGORIES)]:
            for cat_data in categories:
                existing = db.query(Category).filter(
                    Category.name == cat_data["name"],
                    Category.type == cat_type,
                    Category.user_id == None,
                    Category.parent_id == None,
                ).first()
                if existing:
                    parent = existing
                else:
                    parent = Category(
                        name=cat_data["name"],
                        type=cat_type,
                        color=cat_data["color"],
                        icon=cat_data["icon"],
                        is_default=True,
                        user_id=None,
                        parent_id=None,
                    )
                    db.add(parent)
                    db.flush()
                    inserted += 1

                for sub_name in cat_data["subcategories"]:
                    sub_exists = db.query(Category).filter(
                        Category.name == sub_name,
                        Category.type == cat_type,
                        Category.parent_id == parent.id,
                        Category.user_id == None,
                    ).first()
                    if not sub_exists:
                        sub = Category(
                            name=sub_name,
                            type=cat_type,
                            color=cat_data["color"],
                            icon=cat_data["icon"],
                            is_default=True,
                            user_id=None,
                            parent_id=parent.id,
                        )
                        db.add(sub)
                        inserted += 1

        db.commit()
        print(f"Seed complete. {inserted} new categories inserted.")
    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
