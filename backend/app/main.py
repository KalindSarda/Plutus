from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import secure

from app.core.config import settings
from app.core.rate_limiter import limiter
from app.api.routes import auth, accounts, credit_cards, transactions, categories, budgets, recurring, reports, import_data, ai, envelopes

app = FastAPI(title="Plutus API", version="1.0.0")

# Rate limiter state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers middleware
_secure = secure.Secure.with_default_headers()


@app.middleware("http")
async def set_secure_headers(request: Request, call_next):
    response = await call_next(request)
    _secure.set_headers(response)
    return response


# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])
app.include_router(credit_cards.router, prefix="/api/credit-cards", tags=["credit-cards"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["budgets"])
app.include_router(recurring.router, prefix="/api/recurring", tags=["recurring"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(import_data.router, prefix="/api/import", tags=["import"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(envelopes.router, prefix="/api/envelopes", tags=["envelopes"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
