import uuid

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import StructuredTool
from langchain_groq import ChatGroq
from langgraph.prebuilt import create_react_agent
from sqlalchemy.orm import Session

from app.agents.prompts import SYSTEM_PROMPT
from app.agents.session_store import session_store
from app.agents.tools.get_account_balances import make_get_account_balances
from app.agents.tools.get_budget_status import make_get_budget_status
from app.agents.tools.get_credit_card_dues import make_get_credit_card_dues
from app.agents.tools.get_spending_trends import make_get_spending_trends
from app.agents.tools.get_summary import make_get_summary
from app.agents.tools.get_transactions import make_get_transactions
from app.agents.tools.add_transaction import make_add_transaction
from app.agents.tools.edit_transaction import make_edit_transaction
from app.agents.tools.delete_transaction import make_delete_transaction
from app.agents.tools.add_budget import make_add_budget
from app.agents.tools.edit_budget import make_edit_budget
from app.agents.tools.add_account import make_add_account
from app.agents.tools.edit_account import make_edit_account
from app.agents.tools.get_envelope_assignments import make_get_envelope_assignments
from app.agents.tools.set_envelope import make_set_envelope
from app.core.config import settings


def _make_tools(user_id: uuid.UUID, db: Session, session_key: str) -> list:
    """Create all Plutus tools with user_id scoped via closure."""
    return [
        StructuredTool.from_function(
            func=make_get_summary(user_id, db),
            name="get_summary",
            description="Get the current month's income, expenses, and net savings summary.",
        ),
        StructuredTool.from_function(
            func=make_get_account_balances(user_id, db),
            name="get_account_balances",
            description="Get current bank account balances and credit card outstanding amounts.",
        ),
        StructuredTool.from_function(
            func=make_get_budget_status(user_id, db),
            name="get_budget_status",
            description="Get current budget usage and remaining amounts for each category.",
        ),
        StructuredTool.from_function(
            func=make_get_credit_card_dues(user_id, db),
            name="get_credit_card_dues",
            description="Get credit card outstanding balances, available limits, and upcoming due dates.",
        ),
        StructuredTool.from_function(
            func=make_get_spending_trends(user_id, db),
            name="get_spending_trends",
            description="Get month-over-month income, expense, and savings trends for the last 6 months.",
        ),
        StructuredTool.from_function(
            func=make_get_transactions(user_id, db),
            name="get_transactions",
            description=(
                "Get recent transactions with optional filters. "
                "Args: type ('income'/'expense'), category_name, start_date (YYYY-MM-DD), "
                "end_date (YYYY-MM-DD), limit (max 20)."
            ),
        ),
        StructuredTool.from_function(
            func=make_add_transaction(user_id, db, session_key),
            name="add_transaction",
            description="Add a new income or expense transaction. Use when the user says they spent money, received income, or wants to log a financial transaction.",
        ),
        StructuredTool.from_function(
            func=make_edit_transaction(user_id, db, session_key),
            name="edit_transaction",
            description="Edit an existing transaction by finding it with description keywords. Use when the user wants to change an amount, category, or notes on a past transaction.",
        ),
        StructuredTool.from_function(
            func=make_delete_transaction(user_id, db, session_key),
            name="delete_transaction",
            description="Delete a transaction by finding it with description keywords. Always confirm with the user before deleting.",
        ),
        StructuredTool.from_function(
            func=make_add_budget(user_id, db, session_key),
            name="add_budget",
            description="Create a budget limit for a spending category. Use when the user wants to set a monthly or yearly spending limit.",
        ),
        StructuredTool.from_function(
            func=make_edit_budget(user_id, db, session_key),
            name="edit_budget",
            description="Update the amount or period of an existing budget. Use when the user wants to change a budget limit.",
        ),
        StructuredTool.from_function(
            func=make_add_account(user_id, db, session_key),
            name="add_account",
            description="Add a new bank account. Use when the user wants to track a new savings or current account.",
        ),
        StructuredTool.from_function(
            func=make_edit_account(user_id, db, session_key),
            name="edit_account",
            description="Update a bank account's name, bank, or balance. Use when the user wants to rename or correct an account.",
        ),
        StructuredTool.from_function(
            func=make_get_envelope_assignments(user_id, db),
            name="get_envelope_assignments",
            description="Get the user's envelope budgeting assignments (which account/card is default for each category). Call this before adding a transaction if no account is specified.",
        ),
        StructuredTool.from_function(
            func=make_set_envelope(user_id, db, session_key),
            name="set_envelope",
            description="Set or update the default account or credit card for a spending category. Use when the user says 'set my default for Food to HDFC' or 'update my travel envelope'.",
        ),
    ]


def run_agent(
    user_message: str,
    session_id: str,
    user_id: uuid.UUID,
    db: Session,
) -> dict:
    """Run the Plutus agent and return a dict with text and optional action metadata."""
    session_key = f"{user_id}:{session_id}"
    history = session_store.get_history(session_key)

    tools = _make_tools(user_id, db, session_key)
    model = ChatGroq(
        model=settings.groq_model,
        temperature=0.3,
        groq_api_key=settings.groq_api_key,
    )

    agent = create_react_agent(model, tools)

    messages = [SystemMessage(content=SYSTEM_PROMPT)] + history + [HumanMessage(content=user_message)]

    result = agent.invoke({"messages": messages})

    all_messages = result["messages"]
    ai_response = all_messages[-1].content

    # Persist updated history (system prompt excluded from stored history)
    new_history = history + [HumanMessage(content=user_message), all_messages[-1]]
    session_store.update_history(session_key, new_history)

    action = session_store.get_last_action(session_key)
    return {"text": ai_response, "action": action}
