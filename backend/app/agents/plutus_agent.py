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
from app.core.config import settings


def _make_tools(user_id: uuid.UUID, db: Session) -> list:
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
    ]


def run_agent(
    user_message: str,
    session_id: str,
    user_id: uuid.UUID,
    db: Session,
) -> str:
    """Run the Plutus agent and return the AI response text."""
    session_key = f"{user_id}:{session_id}"
    history = session_store.get_history(session_key)

    tools = _make_tools(user_id, db)
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

    return ai_response
