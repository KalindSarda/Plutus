# Plutus AI — Autonomous Agent + Envelope Budgeting + Personality Plan

## Context

Two upgrades combined:

1. **Autonomous agent**: Plutus AI currently only reads financial data. This upgrades it to a full read-write agent — natural language creates, edits, and deletes transactions, budgets, and accounts. Voice input (mic → transcript → send) and an undo button (10-second timer) are added to the chat UI.

2. **Envelope budgeting**: Each spending category gets a "default" account or credit card (the envelope). Plutus uses this when suggesting where to charge a transaction. If you charge to a different account, Plutus notices immediately and asks whether it's intentional. Envelopes are configurable via the Settings page and via chat.

3. **Personality**: Plutus shifts tone based on financial health. When budgets are on track → witty, sarcastic, playful. When over budget or in trouble → calm, direct, supportive. Always feels like a smart friend, never a boring financial tool.

---

## What Changes

### A. New DB model — `category_envelopes`

New file: `backend/app/models/category_envelope.py`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| category_id | UUID FK → categories | unique per user |
| account_id | UUID FK → accounts, nullable | mutually exclusive with cc |
| credit_card_id | UUID FK → credit_cards, nullable | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

New Alembic migration to create this table.

New schema: `backend/app/schemas/category_envelope.py`
- `EnvelopeCreate(category_id, account_id?, credit_card_id?)`
- `EnvelopeUpdate(account_id?, credit_card_id?)`
- `EnvelopeResponse(id, category_id, account_id?, credit_card_id?)`

New service: `backend/app/services/envelope_service.py`
- `list_envelopes(user_id, db)` → all envelopes for user
- `upsert_envelope(category_id, account_id?, cc_id?, user_id, db)` → create or update
- `delete_envelope(category_id, user_id, db)`
- `get_envelope(category_id, user_id, db)` → single lookup

New route: `backend/app/api/routes/envelopes.py`
```
GET    /api/envelopes              # list all with category + account names resolved
POST   /api/envelopes              # upsert (category_id, account_id or cc_id)
DELETE /api/envelopes/{category_id}
```
Register in `backend/app/main.py`.

---

### B. Backend agent changes

#### session_store.py — add last-action tracking

New `_actions: dict` on `SessionStore`.

New methods:
- `set_last_action(session_key, action: dict)`
- `get_last_action(session_key) -> dict | None`
- `clear_last_action(session_key)`

`delete_session` also clears `_actions` entry.

#### Seven new write tools — `backend/app/agents/tools/`

All tool factories gain a `session_key` param (closure) to call `session_store.set_last_action` after mutations.

`_make_tools(user_id, db)` in `plutus_agent.py` becomes `_make_tools(user_id, db, session_key)`.

| File | Key params | Service called |
|---|---|---|
| `add_transaction.py` | type, amount, category_name, date?, account_name?, cc_name?, notes? | `transaction_service.create_transaction()` + envelope deviation check |
| `edit_transaction.py` | description (keywords), amount?, category_name?, date?, notes? | `transaction_service.update_transaction()` |
| `delete_transaction.py` | description (keywords), date? | `transaction_service.delete_transaction()` |
| `add_budget.py` | category_name, amount, period? | `budget_service.create_budget()` |
| `edit_budget.py` | category_name, amount?, period? | `budget_service.update_budget()` |
| `add_account.py` | name, bank_name, account_type?, balance? | `account_service.create_account()` |
| `edit_account.py` | account_name, new_name?, balance?, bank_name? | `account_service.update_account()` |

**Envelope deviation logic inside `add_transaction.py`:**
After creating the transaction, query `envelope_service.get_envelope(category_id, user_id, db)`. If an envelope exists and the used account/card differs from the envelope's default, append a deviation line to the returned string (e.g., `"⚠ ENVELOPE_DEVIATION: expected HDFC Savings, used ICICI Current"`). The LLM sees this and incorporates it into its response.

**One new read tool:**
`get_envelope_assignments.py` — returns all category→account mappings for the user. Used when the agent needs to suggest the right account or explain the user's system.

**One new write tool:**
`set_envelope.py` — upserts an envelope assignment via `envelope_service.upsert_envelope()`. LLM calls this when user says "set my default for Food to HDFC".

Total tools: 6 read (existing) + 1 new read + 7 write + 1 envelope write = **15 tools**.

#### plutus_agent.py

- `_make_tools(user_id, db, session_key)` — pass session_key
- `run_agent()` returns `dict`: `{"text": str, "action": dict | None}`
- After agent completes: read `session_store.get_last_action(session_key)` and include in return

#### prompts.py — Full personality + write capabilities

Replace the current 14-line prompt with an expanded version covering:

**Identity & tone:**
```
You are Plutus — named after the Greek god of wealth, but with the personality of a sharp, witty friend
who happens to know everything about your money. You have two modes:

SERIOUS MODE — activate when: user is over budget, has high CC utilisation (>80%), net savings is
negative, or the financial situation is genuinely concerning. Be calm, direct, supportive. No jokes.

PLAYFUL MODE — activate when: things are on track or the query is casual. Be sarcastic, fun, human.
Reference patterns you've seen ("third Zomato this week, huh"), use light humour, feel like a friend
not a bank. Example: "₹800 on pizza again? Consistent, I'll give you that."

Read the financial data first, then pick the mode. Never be preachy. Never lecture.
```

**Write capabilities section:**
- List all 15 tools and when to use them
- Before calling `add_transaction` without an explicit account: call `get_envelope_assignments` first, propose the envelope default ("Your envelope says HDFC for Food — going with that?")
- After every write: confirm plainly what was done
- If envelope deviation returned: call it out immediately and ask if intentional or if they want to update the default
- For ambiguous edits/deletes: ask which one if multiple candidates match

**Security section** (unchanged from current).

#### schemas/ai.py

```python
class ActionMeta(BaseModel):
    type: str           # "transaction_created" | "transaction_updated" | "transaction_deleted" | ...
    resource_type: str  # "transaction" | "budget" | "account" | "envelope"
    resource_id: str
    undo_data: dict     # previous state snapshot for reversal

class ChatResponse(BaseModel):
    response: str
    session_id: str
    action: ActionMeta | None = None
```

#### ai.py route

- Update `/chat` handler: `run_agent()` now returns dict → extract `text` and `action` → return `ChatResponse(response=text, session_id=..., action=action)`
- Add undo endpoint:
```
POST /api/ai/undo/{session_id}
```
Reads `last_action` from session store, dispatches to the correct reverse operation:
- `transaction_created` → `transaction_service.delete_transaction(resource_id)`
- `transaction_updated` → `transaction_service.update_transaction(resource_id, undo_data)`
- `transaction_deleted` → `transaction_service.create_transaction(undo_data)` (recreate)
- `budget_*` → similar budget service calls
- `account_*` → similar account service calls
Then calls `session_store.clear_last_action(session_key)`.

---

### C. Settings UI — Envelopes section

**`frontend/src/pages/Settings.jsx`** — Add "Envelopes" tab/section:
- Fetch all categories + current envelope assignments (`GET /api/envelopes`)
- Display table: Category name | Assigned to (account or card name) | Edit button
- Inline dropdown to pick account or credit card per category
- Save → `POST /api/envelopes`
- Remove → `DELETE /api/envelopes/{category_id}`

New service: `frontend/src/services/envelopeService.js`
```js
envelopeService.list()   // GET /api/envelopes
envelopeService.upsert({ category_id, account_id?, credit_card_id? })
envelopeService.remove(category_id)
```

---

### D. Frontend chat changes

#### AppContext.jsx

Add `refreshKey` (int, starts 0) + `bumpRefreshKey()` to context value.

#### aiService.js

- `chat(message)` → returns full `{ response, action }` object instead of just the string
- Add `undo(sessionId)` → `POST /api/ai/undo/{sessionId}`

#### PlutusChat.jsx

Three additions:

**Mic button** (Web Speech API):
- Icon button beside send button
- On click: start `SpeechRecognition`, set `listening` state → pulsing gold mic animation
- On result: fill `input` state with transcript; user reviews and hits send
- Hidden if `'SpeechRecognition' not in window`

**Undo button** (per assistant message):
- Messages gain optional `action` field
- If `msg.action` exists: render small "↩ Undo" button + countdown bar inside the bubble
- `useEffect` per message with action: `setTimeout(10000)` → remove undo button
- On click: call `aiService.undo(sessionId)` → append "↩ Undone." to message text, call `bumpRefreshKey()`

**Data refresh**:
- After `handleSend`, if `response.action !== null`: call `bumpRefreshKey()`

#### Five pages — add refreshKey dependency

Pattern (same in all 5): import `useApp`, get `refreshKey`, add to `useCallback`/`useEffect` deps.

Pages: `Dashboard.jsx`, `Transactions.jsx`, `Accounts.jsx`, `CreditCards.jsx`, `Budgets.jsx`

---

## File Checklist

**Backend — new files:**
- `app/models/category_envelope.py`
- `app/schemas/category_envelope.py`
- `app/services/envelope_service.py`
- `app/api/routes/envelopes.py`
- `migrations/versions/<timestamp>_add_category_envelopes.py`
- `app/agents/tools/add_transaction.py`
- `app/agents/tools/edit_transaction.py`
- `app/agents/tools/delete_transaction.py`
- `app/agents/tools/add_budget.py`
- `app/agents/tools/edit_budget.py`
- `app/agents/tools/add_account.py`
- `app/agents/tools/edit_account.py`
- `app/agents/tools/get_envelope_assignments.py`
- `app/agents/tools/set_envelope.py`

**Backend — modified files:**
- `app/agents/session_store.py`
- `app/agents/plutus_agent.py`
- `app/agents/prompts.py`
- `app/schemas/ai.py`
- `app/api/routes/ai.py`
- `app/main.py` (register envelopes router)

**Frontend — new files:**
- `src/services/envelopeService.js`

**Frontend — modified files:**
- `src/context/AppContext.jsx`
- `src/services/aiService.js`
- `src/components/plutus-chat/PlutusChat.jsx`
- `src/pages/Settings.jsx`
- `src/pages/Dashboard.jsx`
- `src/pages/Transactions.jsx`
- `src/pages/Accounts.jsx`
- `src/pages/CreditCards.jsx`
- `src/pages/Budgets.jsx`

---

## Reused (no changes)

- `transaction_service`, `budget_service`, `account_service` — write tools call these directly
- Existing 6 read agent tools — untouched
- All manual UI forms and modals — untouched
- `session_store` singleton — extended, not replaced

---

## Verification

1. Run `alembic upgrade head` — `category_envelopes` table created
2. Go to Settings → Envelopes → assign HDFC to Food & Dining → save
3. Open chat → type "spent 200 on zomato" → Plutus should suggest HDFC (from envelope), create transaction, page refreshes
4. Repeat but say "use ICICI" → Plutus creates it, immediately says "Your envelope for Food is HDFC — was this intentional?"
5. Say "update the default to ICICI" → Plutus calls `set_envelope`, confirms
6. Type "edit that zomato to 220" → Plutus finds it, updates, shows undo button with 10-second timer
7. Click Undo → transaction reverts, Transactions page re-fetches
8. Test mic: click mic button, speak, verify transcript fills input
9. Test personality: query when over budget → serious tone; query when on track → playful/sarcastic
