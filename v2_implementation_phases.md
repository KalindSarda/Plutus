# Plutus v2 — Implementation Phases

**Feature:** Autonomous AI Agent + Envelope Budgeting + Personality  
**Plan reference:** `C:\Users\Darshana.K\.claude\plans\plutus-v1-plan-md-okay-so-now-majestic-curry.md`

---

## Phase 1 — DB + Envelope Backend ✅ COMPLETE

### 1.1 New model
- [x] Create `backend/app/models/category_envelope.py`
  - Fields: id (UUID PK), user_id (FK→users), category_id (FK→categories, unique per user), account_id (FK→accounts, nullable), credit_card_id (FK→credit_cards, nullable), created_at, updated_at
  - UniqueConstraint on (user_id, category_id)

### 1.2 Schema
- [x] Create `backend/app/schemas/category_envelope.py`
  - `EnvelopeCreate` — with mutual exclusivity validator (exactly one of account_id/credit_card_id required)
  - `EnvelopeUpdate` — with mutual exclusivity validator (both simultaneously rejected)
  - `EnvelopeResponse(id, category_id, category_name, account_id?, account_name?, credit_card_id?, cc_name?)`

### 1.3 Service
- [x] Create `backend/app/services/envelope_service.py`
  - `list_envelopes`, `upsert_envelope` (with FK ownership check ✅), `get_envelope`, `delete_envelope`

### 1.4 Route
- [x] Create `backend/app/api/routes/envelopes.py`
  - `GET /api/envelopes`, `POST /api/envelopes`, `DELETE /api/envelopes/{category_id}`

### 1.5 Register + migrate
- [x] `CategoryEnvelope` added to `app/models/__init__.py` (Alembic picks it up)
- [x] Envelope router registered in `app/main.py`
- [ ] Run `alembic revision --autogenerate -m "add_category_envelopes"` ← **manual step**
- [ ] Run `alembic upgrade head` ← **manual step**

### Tests
- [x] `tests/test_envelopes.py` — 9 tests (list, upsert, update, delete, IDOR, auth)

### Bugs found & fixed
- [x] **HIGH**: FK ownership check missing on upsert → fixed in `envelope_service.py`
- [x] **MEDIUM**: Mutual exclusivity missing (both account+card) → fixed in schema
- [x] **MEDIUM**: Both-None envelope accepted → fixed in schema

---

## Phase 2 — Session Store + Agent Plumbing ✅ COMPLETE

### 2.1 Extend session_store
- [x] `_actions: dict` added to `SessionStore.__init__`
- [x] `set_last_action`, `get_last_action`, `clear_last_action` methods added
- [x] `delete_session` also clears `_actions`

### 2.2 Update schemas
- [x] `ActionMeta` added inline in `routes/ai.py`
- [x] `ChatResponse` updated with `action: Optional[ActionMeta] = None`
- [x] Dead `app/schemas/ai.py` deleted (was duplicate of inline definitions)

### 2.3 Update run_agent signature
- [x] `_make_tools(user_id, db, session_key)` — `session_key` param added
- [x] `run_agent()` returns `{"text": str, "action": dict | None}`

### 2.4 Undo endpoint
- [x] `POST /api/ai/undo/{session_id}` — dispatches reverse operations by action type
- [x] Rate limited `20/minute` ← fixed after review
- [x] `else` branch added for unknown action types → 400 error ← fixed after review

### Tests
- [x] `tests/test_ai.py` — 16 tests (session store unit tests + integration tests for chat/undo)

### Bugs found & fixed
- [x] **MEDIUM**: No `else` branch in undo dispatch (silent no-op on unknown type) → fixed
- [x] **MEDIUM**: No rate limit on `/undo` endpoint → fixed
- [x] **LOW**: Duplicate schema definitions → cleaned up (deleted dead file)

---

## Phase 3 — Write Tools ✅ COMPLETE

### 3.1–3.7 All 7 write tools created in `backend/app/agents/tools/`
- [x] `add_transaction.py` — type, amount, category_name, date?, account_name?, cc_name?, notes? + envelope deviation check
- [x] `edit_transaction.py` — description keywords, disambiguation on multiple matches, full snapshot
- [x] `delete_transaction.py` — description keywords, disambiguation, full snapshot before delete
- [x] `add_budget.py` — category_name, amount, period?, start_date defaults to 1st of current month
- [x] `edit_budget.py` — find by category name, partial update with snapshot
- [x] `add_account.py` — name, bank_name, account_type?, balance?
- [x] `edit_account.py` — find by name ilike, partial update with snapshot

### Tests
- [x] `tests/test_write_tools.py` — 24 tests (7 tools, disambiguation, IDOR, envelope deviation)

### Bugs found & fixed
- [x] **MEDIUM**: `edit_account` returned stale pre-rename name in success message → fixed (use updated.name)
- [x] **LOW**: `edit_budget` silently drops invalid period values (acceptable; logged)
- [x] **LOW**: `add_account` `balance or 0.0` falsy edge case (harmless; logged)

---

## Phase 4 — Envelope Agent Tools ✅ COMPLETE

### 4.1 get_envelope_assignments (read)
- [x] `backend/app/agents/tools/get_envelope_assignments.py`
  - No params, returns formatted assignment list or helpful empty-state message

### 4.2 set_envelope (write)
- [x] `backend/app/agents/tools/set_envelope.py`
  - Params: category_name, account_name?, credit_card_name?
  - Correct undo_data: preserves previous envelope or marks `was_empty: True`
  - Global + user categories resolved

### Tests
- [x] `tests/test_envelope_tools.py` — 12 tests including IDOR, undo_data correctness, global category

### Review result: ✅ READY — no blocking issues

---

## Phase 5 — System Prompt + Tool Registration ✅ COMPLETE

### 5.1 System prompt rewrite
- [x] Rewrite `backend/app/agents/prompts.py`
  - SERIOUS MODE / PLAYFUL MODE personality
  - Envelope rule (call get_envelope_assignments before add_transaction)
  - Deviation rule (surface ⚠ ENVELOPE_DEVIATION)
  - Undo awareness after every write
  - Indian currency format, security section

### 5.2 Register all 15 tools in plutus_agent.py
- [x] Add 9 new tool imports
- [x] Add 9 new StructuredTool entries to `_make_tools()`
- [x] `run_agent` returns `{"text": str, "action": dict | None}`

### Review result: ✅ READY — all 15 tools verified, signatures correct, no blocking issues

---

## Phase 6 — Frontend Core ✅ COMPLETE

### 6.1 AppContext
- [x] `frontend/src/context/AppContext.jsx` — `refreshKey` (int) + `bumpRefreshKey()` added to context

### 6.2 aiService
- [x] `frontend/src/services/aiService.js` — `chat()` returns full `{ response, action }` object; `undo(sessionId)` added

### 6.3 envelopeService (new)
- [x] `frontend/src/services/envelopeService.js` — `list()`, `upsert(payload)`, `remove(categoryId)`

---

## Phase 7 — PlutusChat UI ✅ COMPLETE

### 7.1 Mic button
- [x] Web Speech API, `lang: 'en-IN'`, pulsing gold animation while listening
- [x] Hidden if browser unsupported (`hasSpeech` check)
- [x] `plutus-pulse` keyframe injected into `typingCSS`

### 7.2 Undo button
- [x] `UndoBar` component inside assistant bubbles when `msg.action && !msg.undone`
- [x] 10-second countdown progress bar + "↩ Undo" button
- [x] On click: `aiService.undo()`, append "↩ Undone.", `bumpRefreshKey()`
- [x] On expire: clears action from message state

### 7.3 Data refresh wiring
- [x] `bumpRefreshKey()` called after any write action response

---

## Phase 8 — Settings Envelopes UI ✅ COMPLETE

- [x] `frontend/src/pages/Settings.jsx` — "Envelope Budgeting" section added
  - Parallel fetch of categories + envelopes + accounts + credit cards
  - Category dropdown with Bank Accounts / Credit Cards optgroups
  - Save → `envelopeService.upsert()`, Remove → `envelopeService.remove()`
  - Inline status messages (Saved. / Removed. / Failed.)

---

## Phase 9 — Page RefreshKey Wiring ✅ COMPLETE

- [x] `frontend/src/pages/Dashboard.jsx` — `refreshKey` added to `useCallback` deps
- [x] `frontend/src/pages/Transactions.jsx` — `refreshKey` added to init `useEffect` deps
- [x] `frontend/src/pages/Accounts.jsx` — `refreshKey` added to `useCallback` deps
- [x] `frontend/src/pages/CreditCards.jsx` — `refreshKey` added to `useCallback` deps
- [x] `frontend/src/pages/Budgets.jsx` — `refreshKey` added to `useEffect` deps

---

## Verification Checklist

- [ ] `alembic upgrade head` runs clean — `category_envelopes` table exists in DB
- [ ] `GET /api/envelopes` returns `[]` for a new user
- [ ] Settings → Envelopes → assign HDFC to Food & Dining → saves and reloads correctly
- [ ] Chat: "spent 200 on zomato" → Plutus suggests HDFC (from envelope), creates transaction
- [ ] Transactions page auto-refreshes after agent write (no manual reload)
- [ ] Chat: "use ICICI instead" → creates, immediately flags envelope deviation
- [ ] Chat: "update the food envelope to ICICI" → calls set_envelope, confirms
- [ ] Chat: "edit that zomato to 220" → updates, shows 10-second undo bar
- [ ] Click Undo → reverts, page re-fetches, "↩ Undone." shown
- [ ] Mic button appears in Chrome; fills input on speech; hidden in unsupported browsers
- [ ] Personality: ask about finances when over budget → serious tone; when on track → sarcastic/fun response
