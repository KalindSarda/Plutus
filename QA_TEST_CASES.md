# Plutus — QA Test Cases

**Application:** Plutus Personal Finance Portal  
**Frontend:** http://localhost:8000  
**Backend API:** http://localhost:8001  
**Last updated:** 2026-06-22  
**Coverage:** All 12 modules · 120 test cases  

---

## How to Use This Document

- **Priority:** P1 = must pass before release · P2 = important but not blocking · P3 = nice to have
- **Pre-condition "Fresh account"** = register a brand-new user for that test
- **Pre-condition "Seeded account"** = use an account that already has the data described in the Pre-conditions column
- Each test case is self-contained; testers can run them in any order unless otherwise noted
- When a step says "Expect:", that is the pass/fail criterion

---

## Module 1 — Authentication

### TC-AUTH-001 · Register with valid data · P1

**Purpose:** Verify a new user can create an account with the invite code.

**Pre-conditions:** No existing account with the test email.

**Steps:**
1. Navigate to `http://localhost:8000/register`
2. Enter **Full Name:** `QA Tester`
3. Enter **Email:** `qa_tester_001@test.com`
4. Enter **Password:** `QATest@123`
5. Enter **Invite Code:** `plutus2024`
6. Click **Register**

**Expected:**
- Page redirects to `/login`
- No error message shown
- User is NOT automatically logged in (redirect to login, not dashboard)

---

### TC-AUTH-002 · Register with wrong invite code · P1

**Purpose:** Ensure registration is gated behind the invite code.

**Pre-conditions:** None.

**Steps:**
1. Navigate to `/register`
2. Fill all fields with valid data
3. Enter **Invite Code:** `wrongcode`
4. Click **Register**

**Expected:**
- Registration fails
- An error message is displayed (e.g., "Invalid invite code" or 403 response)
- User remains on `/register`

---

### TC-AUTH-003 · Register with duplicate email · P1

**Purpose:** Verify duplicate email is rejected.

**Pre-conditions:** TC-AUTH-001 has been completed (email `qa_tester_001@test.com` exists).

**Steps:**
1. Navigate to `/register`
2. Use the same email `qa_tester_001@test.com` with any password and the correct invite code
3. Click **Register**

**Expected:**
- Registration fails
- Error message indicating the email is already registered
- User stays on `/register`

---

### TC-AUTH-004 · Register with missing fields · P2

**Purpose:** Confirm required field validation fires before API call.

**Steps:**
1. Navigate to `/register`
2. Leave **Full Name** blank; fill all other fields correctly
3. Click **Register**

**Expected:** Form does not submit; browser native validation or inline error highlights the missing field.

Repeat with each required field left blank individually.

---

### TC-AUTH-005 · Login with correct credentials · P1

**Purpose:** Verify login flow and redirect to dashboard.

**Pre-conditions:** Account `qa_tester_001@test.com` / `QATest@123` exists.

**Steps:**
1. Navigate to `/login`
2. Enter **Email:** `qa_tester_001@test.com`
3. Enter **Password:** `QATest@123`
4. Click **Sign In**

**Expected:**
- Page redirects to `/` (Dashboard)
- Dashboard loads with user's name in greeting (e.g., "Good morning, QA Tester")
- Sidebar is visible with all navigation links

---

### TC-AUTH-006 · Login with wrong password · P1

**Purpose:** Verify invalid credentials are rejected.

**Steps:**
1. Navigate to `/login`
2. Enter correct email, wrong password
3. Click **Sign In**

**Expected:**
- Login fails
- Error message is shown (e.g., "Invalid credentials")
- User stays on `/login`

---

### TC-AUTH-007 · Login with non-existent email · P1

**Steps:**
1. Navigate to `/login`
2. Enter `nobody@notexist.com` as email and any password
3. Click **Sign In**

**Expected:** Error message shown; user stays on `/login`.

---

### TC-AUTH-008 · Protected route blocked when logged out · P1

**Purpose:** Ensure unauthenticated users cannot access protected pages.

**Pre-conditions:** User is logged out (or fresh browser session).

**Steps:**
1. Type `http://localhost:8000/` directly in the address bar
2. Press Enter

**Expected:** Browser is redirected to `/login`; dashboard content is NOT visible.

Repeat for: `/accounts`, `/transactions`, `/reports`, `/settings`

---

### TC-AUTH-009 · Session persists after page refresh · P1

**Purpose:** Verify the refresh-token cookie keeps the user logged in after a hard reload.

**Pre-conditions:** User is logged in.

**Steps:**
1. Log in successfully (TC-AUTH-005)
2. Navigate to Dashboard
3. Press **F5** (hard refresh)

**Expected:**
- Page reloads and still shows the Dashboard (NOT the login page)
- User name in greeting is still correct

---

### TC-AUTH-010 · Logout clears session · P1

**Purpose:** Verify logout invalidates the session.

**Pre-conditions:** User is logged in.

**Steps:**
1. Click **Sign out** button (top-right on Dashboard, or sidebar)
2. After redirect to `/login`, press the browser **Back** button

**Expected:**
- After clicking Sign out, browser redirects to `/login`
- After pressing Back, the page either shows `/login` again or redirects to it — the Dashboard is NOT accessible without re-logging in

---

## Module 2 — Dashboard

### TC-DASH-001 · Dashboard loads with correct summary · P1

**Purpose:** Verify all four summary cards render correct data.

**Pre-conditions:**
- User logged in
- 1 account "HDFC Savings" with balance ₹10,000 (opening balance)
- 1 income transaction: ₹5,000 linked to HDFC Savings on a date in the current month
- 1 expense transaction: ₹1,500 linked to HDFC Savings on a date in the current month

**Steps:**
1. Navigate to Dashboard

**Expected:**
| Card | Expected Value |
|---|---|
| Total Balance | ₹13,500 (10,000 + 5,000 income − 1,500 expense) |
| Income | ₹5,000 |
| Expenses | ₹1,500 |
| Net Savings | ₹3,500 |

---

### TC-DASH-002 · Net Savings hint when no income recorded · P2

**Purpose:** Confirm helpful sub-label appears when income is zero.

**Pre-conditions:** User has only expense transactions this month (no income).

**Steps:**
1. Navigate to Dashboard

**Expected:**
- Net Savings card shows a negative value
- Sub-label under Net Savings reads **"No income recorded yet"** (not "this month")

---

### TC-DASH-003 · Month navigation — Previous month · P1

**Purpose:** Verify summary data changes when navigating to a previous month.

**Pre-conditions:** Data exists for the previous month (or at minimum, zero data).

**Steps:**
1. On Dashboard, note current month label and values
2. Click **‹** (left arrow)

**Expected:**
- Month label changes to the previous month (e.g., "May 2026" if current is "June 2026")
- Income/Expense/Net Savings values update to reflect that month's transactions
- Total Balance still reflects current account balances (not month-specific)

---

### TC-DASH-004 · Month navigation — Cannot navigate to future · P1

**Steps:**
1. On Dashboard showing current month, click **›** (right arrow)

**Expected:** Right arrow is disabled/greyed out; month does not change.

---

### TC-DASH-005 · Expenses by Category donut chart · P2

**Purpose:** Verify the chart renders when expense transactions exist.

**Pre-conditions:** At least one expense transaction this month.

**Steps:**
1. Navigate to Dashboard

**Expected:**
- "Expenses by Category" section shows a donut/pie chart
- Legend below chart lists category names and amounts
- Amounts match what was entered in transactions

---

### TC-DASH-006 · Income vs Expenses bar chart · P2

**Steps:**
1. Navigate to Dashboard with both income and expense transactions this month

**Expected:**
- Bar chart shows two bars (Income = green, Expenses = red)
- Tooltip on hover shows correct values
- Legend at bottom shows "Income ₹X" and "Expenses ₹Y"

---

### TC-DASH-007 · Empty state — no transactions this month · P2

**Pre-conditions:** No transactions recorded for the displayed month.

**Steps:**
1. Navigate to Dashboard (or navigate to a month with no transactions)

**Expected:**
- Income = ₹0, Expenses = ₹0, Net Savings = ₹0
- "Expenses by Category" shows "No expense data for this period."
- Charts render without crashing

---

### TC-DASH-008 · AI Chat opens and responds · P2

**Purpose:** Verify the AI assistant FAB opens and accepts a question.

**Pre-conditions:** GROQ_API_KEY is configured in backend `.env`.

**Steps:**
1. Navigate to Dashboard
2. Click the gold circular **AI button** (bottom-right corner, ★ icon)
3. In the chat input, type: `What is my total balance?`
4. Click **Send** or press Enter
5. Wait up to 20 seconds

**Expected:**
- Chat panel slides open
- User's message appears in the thread
- AI assistant replies with a response (any text mentioning balance, accounts, or financial data)
- No JS error in the browser console

---

### TC-DASH-009 · AI Chat — clear conversation · P3

**Steps:**
1. Open AI chat and send a message
2. Click the **↺ (Clear)** button

**Expected:** Chat history is cleared; input is empty; the thread shows no messages.

---

## Module 3 — Accounts

### TC-ACC-001 · Add a Savings account · P1

**Purpose:** Create a bank account and verify it appears in the list.

**Pre-conditions:** User logged in.

**Steps:**
1. Click **Accounts** in the sidebar
2. Click **+ Add Account**
3. Enter **Account Name:** `HDFC Salary`
4. Enter **Bank Name:** `HDFC Bank`
5. Select **Account Type:** `Savings`
6. Enter **Balance:** `50000`
7. Click **Add Account**

**Expected:**
- Modal closes
- "HDFC Salary" card appears in the accounts list
- Card shows: Bank: HDFC Bank · Type: Savings · Balance: ₹50,000
- **Total Balance** hero at top increases by ₹50,000

---

### TC-ACC-002 · Add a Current account · P2

**Steps:** Same as TC-ACC-001 but select **Account Type:** `Current`.

**Expected:** Card shows type badge "Current" (amber color).

---

### TC-ACC-003 · Add account — missing Name · P1

**Steps:**
1. Click **+ Add Account**
2. Leave Account Name blank
3. Fill all other fields
4. Click **Add Account**

**Expected:** Error message "Name and bank name are required." is shown; account is NOT created.

---

### TC-ACC-004 · Add account — missing Bank Name · P1

**Steps:** Same as TC-ACC-003 but leave Bank Name blank.

**Expected:** Same error message; account not created.

---

### TC-ACC-005 · Add account — invalid balance (text) · P1

**Steps:**
1. Open Add Account modal
2. Enter `abc` in the Balance field
3. Click **Add Account**

**Expected:** Error "Balance must be a valid number." or browser native validation blocks submission.

---

### TC-ACC-006 · Add account — zero balance · P2

**Steps:**
1. Open Add Account modal
2. Enter all valid data with Balance = `0`
3. Click **Add Account**

**Expected:** Account is created successfully with ₹0 balance. (Zero is valid.)

---

### TC-ACC-007 · Edit an account · P1

**Pre-conditions:** At least one account exists.

**Steps:**
1. Click the pencil (edit) icon on any account card
2. Change **Account Name** to `HDFC Salary Updated`
3. Change **Balance** to `75000`
4. Click **Save Changes**

**Expected:**
- Modal closes
- Account card shows the updated name and ₹75,000 balance
- **Total Balance** hero reflects the new balance

---

### TC-ACC-008 · Delete an account · P1

**Pre-conditions:** At least one account exists.

**Steps:**
1. Click the trash (delete) icon on an account card
2. Confirm delete dialog appears with the account name
3. Click **Delete**

**Expected:**
- Modal closes
- Account card is removed from the list
- Total Balance decreases by the deleted account's balance

---

### TC-ACC-009 · Cancel delete account · P2

**Steps:**
1. Click delete icon on an account card
2. Click **Cancel** in the confirm dialog

**Expected:** Dialog closes; account remains in the list.

---

### TC-ACC-010 · Total Balance updates when expense transaction is added · P1

**Purpose:** Core business logic — expense must reduce account balance.

**Pre-conditions:**
- Account "HDFC Savings" with balance ₹10,000
- Backend has been restarted after the latest code changes

**Steps:**
1. Go to **Transactions** → **+ Add Transaction**
2. Set Type: **Expense**
3. Set Amount: `500`
4. Select any expense category
5. In the **Account** dropdown, select `HDFC Savings`
6. Click **Add Transaction**
7. Navigate to **Accounts**

**Expected:**
- HDFC Savings balance is now **₹9,500** (10,000 − 500)
- Dashboard Total Balance also shows ₹9,500

---

### TC-ACC-011 · Total Balance updates when income transaction is added · P1

**Pre-conditions:** Account "HDFC Savings" with balance ₹9,500 (from TC-ACC-010).

**Steps:**
1. Go to **Transactions** → **+ Add Transaction**
2. Set Type: **Income**
3. Set Amount: `3000`
4. Select any income category (e.g., Salary)
5. Select **Account:** `HDFC Savings`
6. Click **Add Transaction**
7. Navigate to **Accounts**

**Expected:** HDFC Savings balance is **₹12,500** (9,500 + 3,000).

---

### TC-ACC-012 · Account balance unaffected when transaction has no account linked · P2

**Purpose:** Confirm that if no account is selected, the balance is not changed.

**Pre-conditions:** Any account with a known balance, e.g., ₹5,000.

**Steps:**
1. Add an expense of ₹200 leaving the **Account** field as **"None"**
2. Check the account balance

**Expected:** Account balance remains ₹5,000 (no account was linked, so no deduction occurs).

---

## Module 4 — Transactions

### TC-TXN-001 · Add an expense transaction (account linked) · P1

**Pre-conditions:** At least one account and at least one expense category exist.

**Steps:**
1. Go to **Transactions** → **+ Add Transaction**
2. Set **Date:** today
3. Click **Expense** type button
4. Enter **Amount:** `250`
5. In **Category** field, type `food` → select **Food & Dining** from dropdown
6. In **Account** dropdown, select your account
7. Click **Add Transaction**

**Expected:**
- Modal closes
- Transaction appears at the top of the list (most recent first)
- Type badge shows "expense" (red)
- Amount shows "−₹250" in red
- Source column shows the account name
- Account balance decreased by ₹250

---

### TC-TXN-002 · Add an income transaction · P1

**Steps:**
1. **+ Add Transaction**
2. Click **Income** type button
3. Amount: `8000`
4. Category: search `salary` → select **Salary**
5. Select account
6. Click **Add Transaction**

**Expected:**
- Transaction appears with type badge "income" (green)
- Amount shows "+₹8,000" in green
- Account balance increased by ₹8,000

---

### TC-TXN-003 · Category combobox — filters by transaction type · P1

**Purpose:** Verify the category combobox only shows relevant categories.

**Steps:**
1. Open Add Transaction modal
2. Ensure **Type = Expense** is selected
3. Click inside the Category field

**Expected:** Dropdown shows only expense categories (Food & Dining, Transport, etc.) — no income categories (Salary, Freelance, etc.)

4. Click **Income** type button
5. Click inside Category field again

**Expected:** Dropdown now shows only income categories.

---

### TC-TXN-004 · Category combobox — search filter works · P1

**Steps:**
1. Open Add Transaction modal with Expense selected
2. In Category field, type `trans`

**Expected:** Only categories containing "trans" (e.g., "Transport", "Transportation") appear in the list.

3. Clear the search text → type `xyz`

**Expected:** "No matches" message shown.

---

### TC-TXN-005 · Category clears when switching type · P1

**Steps:**
1. Open Add Transaction modal
2. Search for an expense category and select it (e.g., "Food & Dining")
3. Click **Income** type button

**Expected:**
- Category search field is cleared
- category_id is reset (no category selected)
- Dropdown now shows income categories

---

### TC-TXN-006 · Add transaction — missing amount · P1

**Steps:**
1. Open Add Transaction
2. Fill date and category; leave **Amount** blank
3. Click **Add Transaction**

**Expected:** Error "Enter a valid positive amount." is shown; transaction is NOT saved.

---

### TC-TXN-007 · Add transaction — zero or negative amount · P1

**Steps:**
1. Enter Amount = `0`; fill everything else
2. Click **Add Transaction**

**Expected:** Validation error; transaction not saved.

---

### TC-TXN-008 · Add transaction — missing category · P1

**Steps:**
1. Fill date and amount; leave Category empty (don't select from combobox)
2. Click **Add Transaction**

**Expected:** Error "Please select a category." is shown.

---

### TC-TXN-009 · Add transaction with notes and tags · P2

**Steps:**
1. Open Add Transaction
2. Fill required fields
3. Enter **Notes:** `Lunch with team`
4. Enter **Tags:** `work, lunch, reimbursable`
5. Click **Add Transaction**

**Expected:** Transaction saved; notes and tags are stored (visible when editing the transaction).

---

### TC-TXN-010 · Edit a transaction · P1

**Pre-conditions:** At least one transaction exists.

**Steps:**
1. Click the pencil (edit) icon on a transaction row
2. Change **Amount** to a new value (e.g., `300`)
3. Click **Update**

**Expected:**
- Modal closes
- Transaction row shows the updated amount
- Account balance adjusts: old amount is reversed, new amount is applied

---

### TC-TXN-011 · Delete a transaction · P1

**Pre-conditions:** Account balance known before the transaction to delete.

**Steps:**
1. Click the ✕ (delete) icon on a transaction row
2. Confirm in the dialog

**Expected:**
- Transaction removed from list
- Account balance reverses the effect of the deleted transaction (e.g., deleting a ₹200 expense adds ₹200 back to the account)

---

### TC-TXN-012 · Cancel delete transaction · P2

**Steps:**
1. Click ✕ on a transaction
2. Click **Cancel** in the confirm dialog

**Expected:** Dialog closes; transaction remains in the list.

---

### TC-TXN-013 · Filter by Income · P1

**Pre-conditions:** Mix of income and expense transactions exist.

**Steps:**
1. On Transactions page, click **Income** filter tab

**Expected:** Only income transactions (green badge) are shown; expense rows disappear.

---

### TC-TXN-014 · Filter by Expense · P1

**Steps:** Click **Expense** filter tab.

**Expected:** Only expense transactions shown.

---

### TC-TXN-015 · Filter All · P1

**Steps:** Click **All** filter tab.

**Expected:** Both income and expense transactions are shown.

---

### TC-TXN-016 · Load More pagination · P2

**Pre-conditions:** More than 50 transactions exist.

**Steps:**
1. Scroll to the bottom of the Transactions page
2. Click **Load More**

**Expected:** Additional transactions append to the list without page reload.

---

### TC-TXN-017 · Default account pre-selected when only one account exists · P2

**Purpose:** When there is exactly one account, the Add Transaction modal should auto-select it.

**Pre-conditions:** Exactly 1 account in the user's profile.

**Steps:**
1. Open Add Transaction modal

**Expected:** The **Account** dropdown already shows the account name (pre-selected, not "None").

---

### TC-TXN-018 · Add transaction with Credit Card (no bank account) · P2

**Pre-conditions:** A credit card exists with available limit.

**Steps:**
1. Open Add Transaction → Expense
2. Amount: `1000`
3. Category: any expense category
4. Leave **Account** as None
5. Select **Credit Card** dropdown → pick your card
6. Click **Add Transaction**

**Expected:**
- Transaction saved
- Credit card's outstanding balance increases by ₹1,000
- Credit card's available limit decreases by ₹1,000
- Bank account balance is NOT affected

---

## Module 5 — Credit Cards

### TC-CC-001 · Add a credit card · P1

**Steps:**
1. Go to **Credit Cards** → **+ Add Card**
2. **Card Name:** `HDFC Regalia`
3. **Bank Name:** `HDFC Bank`
4. **Credit Limit:** `200000`
5. **Billing Cycle Day:** `1`
6. **Due Day:** `20`
7. Click **Add Card**

**Expected:**
- Card appears in the list
- Available = ₹2,00,000, Outstanding = ₹0, Limit = ₹2,00,000
- Billing day: 1, Due day: 20 are shown

---

### TC-CC-002 · Add card — missing required fields · P1

**Steps:**
1. Open Add Card modal
2. Leave Card Name blank
3. Click **Add Card**

**Expected:** Error "Name and bank name are required."; card not saved.

---

### TC-CC-003 · Add card — invalid credit limit (zero) · P1

**Steps:**
1. Open Add Card; fill all fields; set Credit Limit = `0`
2. Click **Add Card**

**Expected:** Error "Credit limit must be a positive number."

---

### TC-CC-004 · Add card — billing cycle day out of range · P1

**Steps:** Enter Billing Cycle Day = `32`; fill all other fields.

**Expected:** Error "Billing cycle day must be between 1 and 31."

---

### TC-CC-005 · Edit a credit card · P1

**Pre-conditions:** A card exists.

**Steps:**
1. Click pencil icon on the card
2. Change **Credit Limit** to `300000`
3. Click **Save Changes**

**Expected:** Card shows new limit ₹3,00,000; available limit updates accordingly.

---

### TC-CC-006 · Delete a credit card · P1

**Steps:**
1. Click trash icon on a card
2. Click **Delete** in confirm dialog

**Expected:** Card removed from the list.

---

### TC-CC-007 · Outstanding balance updates when expense is charged to card · P1

**Pre-conditions:** Credit card with ₹2,00,000 limit and ₹0 outstanding.

**Steps:**
1. Add expense transaction of ₹5,000 linked to the credit card (not a bank account)
2. Navigate to Credit Cards

**Expected:**
- Outstanding: ₹5,000
- Available: ₹1,95,000
- Usage bar reflects ~2.5% utilisation (green)

---

### TC-CC-008 · Usage bar color — warning threshold (70%+) · P3

**Pre-conditions:** Credit card with ₹10,000 limit.

**Steps:** Add expense transactions totalling ₹7,500 to the card.

**Expected:** Usage bar turns amber/yellow (≥70% utilisation).

---

### TC-CC-009 · Usage bar color — danger threshold (90%+) · P3

**Steps:** Total outstanding ≥ ₹9,000 on a ₹10,000-limit card.

**Expected:** Usage bar turns red (≥90% utilisation).

---

### TC-CC-010 · View Statements · P2

**Pre-conditions:** A credit card exists.

**Steps:**
1. Click **View Statements** on a card

**Expected:**
- Statements section expands
- If no statements: "No statements available." is shown
- If statements exist: each row shows period dates, total due, and "Mark Paid" or "Paid" badge

---

### TC-CC-011 · Mark Statement Paid · P2

**Pre-conditions:** A statement exists with unpaid status.

**Steps:**
1. Click **Mark Paid** on an unpaid statement
2. Amount field is pre-filled with total due; click **Mark Paid**

**Expected:**
- Statement row shows "Paid" badge
- Outstanding balance on the card decreases accordingly

---

## Module 6 — Budgets

### TC-BUD-001 · Add a budget · P1

**Pre-conditions:** At least one expense category exists.

**Steps:**
1. Go to **Budgets**
2. Click **+ Add Budget** (or equivalent button)
3. Select **Category:** `Food & Dining`
4. Enter **Amount:** `5000`
5. Select **Period:** `monthly`
6. Set **Start Date:** first day of current month
7. Click **Add**

**Expected:**
- Budget card appears for "Food & Dining"
- Budget amount: ₹5,000
- Spent amount and progress bar reflect current month's food & dining expenses

---

### TC-BUD-002 · Budget progress bar — within budget (green) · P2

**Pre-conditions:** Food & Dining budget = ₹5,000; food expenses this month = ₹1,000.

**Steps:** Navigate to Budgets.

**Expected:**
- Spent: ₹1,000 / ₹5,000
- Progress bar is green (20% used)

---

### TC-BUD-003 · Budget progress bar — warning (70-89%) · P2

**Pre-conditions:** Budget = ₹5,000; spent ≥ ₹3,500.

**Expected:** Progress bar turns amber.

---

### TC-BUD-004 · Budget progress bar — over budget (90%+) · P2

**Pre-conditions:** Budget = ₹5,000; spent ≥ ₹4,500.

**Expected:** Progress bar turns red.

---

### TC-BUD-005 · Edit budget amount · P1

**Pre-conditions:** A budget exists.

**Steps:**
1. Click the edit (pencil) icon on a budget
2. Change the amount to `8000`
3. Save

**Expected:** Budget amount updates to ₹8,000; progress bar ratio recalculates.

---

### TC-BUD-006 · Delete a budget · P1

**Steps:**
1. Click delete icon on a budget
2. Confirm

**Expected:** Budget is removed from the list.

---

### TC-BUD-007 · Budget month navigation · P1

**Steps:**
1. On Budgets page, click **‹** to go to previous month

**Expected:**
- Month label changes
- Spent amounts update to reflect that month's transactions for each budget category
- Budget amounts remain (they are not month-specific unless filtered)

---

### TC-BUD-008 · Add budget — missing category · P1

**Steps:**
1. Open Add Budget form
2. Leave Category unselected
3. Fill amount and click Save

**Expected:** Validation error; budget not saved.

---

### TC-BUD-009 · Add budget — missing or zero amount · P1

**Steps:**
1. Select a category; enter Amount = `0` or leave blank
2. Click Save

**Expected:** Validation error; budget not saved.

---

## Module 7 — Recurring Transactions

### TC-REC-001 · Add a recurring template · P1

**Pre-conditions:** At least one account and expense category exist.

**Steps:**
1. Go to **Recurring** → **+ Add Recurring**
2. **Name:** `Netflix Subscription`
3. **Type:** Expense
4. **Amount:** `649`
5. **Category:** search and select `Entertainment`
6. **Account:** your bank account
7. **Frequency:** `monthly`
8. **Next Due Date:** first of next month
9. Click **Add**

**Expected:**
- Template card appears: "Netflix Subscription · ₹649 · monthly"
- Next due date is shown correctly
- Account balance is NOT affected (template only; no transaction created yet)

---

### TC-REC-002 · Apply a recurring template · P1

**Purpose:** Applying creates an actual transaction.

**Pre-conditions:** A recurring template exists; note the linked account's current balance.

**Steps:**
1. On the template card, click **Apply Now** (or equivalent)
2. Confirm if prompted

**Expected:**
- A new transaction appears on the Transactions page matching the template's amount, type, and category
- The linked account's balance decreases (for expense) or increases (for income)
- The template's "Next Due Date" advances by one frequency period (monthly → +1 month)

---

### TC-REC-003 · Edit a recurring template · P1

**Steps:**
1. Click edit on a recurring template
2. Change **Amount** to `799`
3. Save

**Expected:** Template shows new amount ₹799; future applies use ₹799.

---

### TC-REC-004 · Delete a recurring template · P1

**Steps:**
1. Click delete icon on a template
2. Confirm

**Expected:** Template removed; existing applied transactions are NOT affected.

---

### TC-REC-005 · Add recurring — missing name · P1

**Steps:** Leave Name blank; fill all other fields; click Add.

**Expected:** Validation error; template not saved.

---

### TC-REC-006 · Add recurring — all frequency options · P3

**Steps:**
1. Create templates with each frequency: `daily`, `weekly`, `monthly`, `yearly`
2. Apply each once

**Expected:** Each applies and advances the next_due_date by the correct interval.

---

## Module 8 — Categories

### TC-CAT-001 · Default categories are seeded · P1

**Purpose:** Verify system seed data is present.

**Steps:**
1. Go to **Categories**

**Expected:**
- Expense categories visible: Food & Dining, Transport, Utilities, Entertainment, Shopping, Healthcare, etc.
- Income categories visible: Salary, Freelance, Business, Investment, etc.
- Categories are grouped by type (Expense / Income)

---

### TC-CAT-002 · Add a custom category · P1

**Steps:**
1. Click **+ Add Category**
2. **Name:** `Pet Care`
3. **Type:** Expense
4. Select a **Color** swatch
5. Enter **Icon:** `🐾`
6. Click **Add**

**Expected:**
- "Pet Care" appears in the Expense list with the chosen color and icon
- It is available in the Transactions form's category combobox under expense categories

---

### TC-CAT-003 · Add a subcategory · P2

**Steps:**
1. On a parent category (e.g., Food & Dining), click **+ Add Subcategory**
2. Enter name `Restaurants`
3. Click **Add**

**Expected:** "Restaurants" appears nested under "Food & Dining".

---

### TC-CAT-004 · Edit a custom category · P1

**Pre-conditions:** A custom category "Pet Care" exists.

**Steps:**
1. Click edit icon on "Pet Care"
2. Change name to `Pets & Vet`
3. Save

**Expected:** Category name updates in the list and in the Transactions combobox.

---

### TC-CAT-005 · Delete a custom category · P1

**Steps:**
1. Click delete icon on a custom category
2. Confirm

**Expected:** Category is removed from the list. (Default categories cannot be deleted — verify this too.)

---

### TC-CAT-006 · Cannot delete a default category · P2

**Steps:** Click delete on a default category (e.g., Food & Dining).

**Expected:** Delete is either blocked (no delete button shown) or fails with an error message. The category remains.

---

### TC-CAT-007 · Add category — missing name · P1

**Steps:** Open Add Category; leave Name blank; click Add.

**Expected:** Validation error; category not saved.

---

## Module 9 — Reports

### TC-REP-001 · Reports page loads all sections · P1

**Steps:**
1. Go to **Reports**

**Expected:** All four sections are visible:
- Category breakdown (pie chart)
- Monthly trends (bar chart — 6 months)
- Net Worth card
- Projection card

---

### TC-REP-002 · Category breakdown reflects current month transactions · P1

**Pre-conditions:** Expense transactions exist in the current month across different categories.

**Steps:**
1. Navigate to Reports
2. Check "Category Breakdown" section

**Expected:**
- Each category with expenses this month appears with its name, amount, and percentage
- Pie chart slices match the listed categories
- Percentages add up to approximately 100%

---

### TC-REP-003 · Monthly trends chart — 6 months · P2

**Steps:**
1. Navigate to Reports

**Expected:**
- Bar chart shows up to 6 months of data (oldest on left, current on right)
- Each month shows income bar (green) and expense bar (red)
- Month labels (e.g., "Jan 2026") are correct

---

### TC-REP-004 · Net Worth calculation · P1

**Purpose:** Net Worth = Total Assets (account balances) − Total CC Outstanding.

**Pre-conditions:**
- Bank account balance: ₹50,000
- Credit card outstanding: ₹10,000

**Steps:**
1. Navigate to Reports → Net Worth section

**Expected:**
- Assets: ₹50,000
- Liabilities: ₹10,000
- Net Worth: ₹40,000

---

### TC-REP-005 · Projection card · P3

**Steps:** Navigate to Reports → Projection section.

**Expected:**
- "Avg Monthly Income", "Avg Monthly Expense", and "Projected Savings" values are shown
- Values are calculated as averages of the last 3 months

---

### TC-REP-006 · Month navigation in Reports · P1

**Steps:**
1. On Reports, click **‹** to navigate to the previous month

**Expected:**
- Month label changes
- Category breakdown updates to show that month's data
- Monthly trends chart does NOT change (it's always the last 6 months)
- Net Worth and Projection do NOT change (they are always current)

---

### TC-REP-007 · Export to CSV · P2

**Steps:**
1. Click **Export CSV** button on Reports page

**Expected:**
- Browser downloads a `.csv` file
- File contains columns: date, type, amount, category, account, credit_card, notes, tags
- Rows match the user's transactions

---

## Module 10 — Import

### TC-IMP-001 · Upload a valid CSV · P1

**Purpose:** Verify the CSV import pipeline parses and creates transactions.

**Pre-conditions:**
Create a file `test_import.csv` with these contents:
```
date,type,amount,category
2026-06-01,expense,500,Food & Dining
2026-06-02,income,10000,Salary
2026-06-03,expense,200,Transport
```

**Steps:**
1. Go to **Import**
2. Click the upload area
3. Select `test_import.csv`

**Expected:**
- Preview table appears with 3 rows
- Each row shows: date, type, amount, matched category
- Valid rows show a green indicator; invalid rows show red with reason

---

### TC-IMP-002 · Confirm import · P1

**Pre-conditions:** TC-IMP-001 completed; preview is shown.

**Steps:**
1. Click **Confirm Import**

**Expected:**
- Success message: "X transactions imported" (X = number of valid rows)
- Navigating to Transactions shows the imported transactions
- If accounts were matched, their balances updated accordingly

---

### TC-IMP-003 · Upload non-CSV file · P1

**Steps:**
1. Upload a `.xlsx` or `.txt` file

**Expected:**
- Error message: "Only CSV files are accepted."
- No preview is shown

---

### TC-IMP-004 · Upload CSV exceeding 5 MB · P1

**Steps:**
1. Upload a CSV file larger than 5 MB

**Expected:**
- Error message: "File exceeds the 5 MB limit."
- No parse request is sent to the server

---

### TC-IMP-005 · CSV with missing required columns · P2

**Pre-conditions:**
Create `bad_import.csv`:
```
description,value
Lunch,500
```

**Steps:** Upload `bad_import.csv`.

**Expected:**
- Error or all rows marked invalid with reason "Missing required column: type" (or similar)
- Confirm button is disabled or import fails gracefully

---

### TC-IMP-006 · CSV with some invalid rows · P2

**Pre-conditions:**
Create `mixed_import.csv`:
```
date,type,amount,category
2026-06-01,expense,500,Food & Dining
2026-06-01,expense,abc,Transport
2026-06-01,badtype,200,Salary
```

**Steps:** Upload and preview.

**Expected:**
- Row 1: valid (green)
- Row 2: invalid — "invalid amount" (red)
- Row 3: invalid — "invalid type" (red)
- Confirm imports only the valid row

---

## Module 11 — Settings

### TC-SET-001 · Update profile name · P1

**Steps:**
1. Go to **Settings**
2. In **Profile** section, change **Name** to `QA Tester Updated`
3. Click **Save Profile**

**Expected:**
- Success message: "Profile updated."
- Dashboard greeting now shows "QA Tester Updated"

---

### TC-SET-002 · Update profile — empty name rejected · P1

**Steps:**
1. Clear the Name field
2. Click **Save Profile**

**Expected:** Error or button disabled; profile not saved.

---

### TC-SET-003 · Change password — valid · P1

**Steps:**
1. Go to Settings → Password section
2. **Current Password:** (correct current password)
3. **New Password:** `NewQA@456`
4. Click **Change Password**

**Expected:**
- Success message: "Password changed successfully."
- Old password and new password fields are cleared
- Logging out and back in with `NewQA@456` works

---

### TC-SET-004 · Change password — wrong current password · P1

**Steps:**
1. Enter an incorrect current password
2. Enter a valid new password
3. Click **Change Password**

**Expected:** Error message (e.g., "Wrong password" or "Failed to change password."); password is NOT changed.

---

### TC-SET-005 · Change password — new password too short · P1

**Steps:**
1. Enter correct current password
2. Enter new password of 6 characters (e.g., `abc123`)
3. Click **Change Password**

**Expected:** Error: "New password must be at least 8 characters."; no API call made.

---

### TC-SET-006 · Toggle theme Dark ↔ Light · P2

**Steps:**
1. Note current theme (default = dark)
2. Click **Toggle Theme** (or Light/Dark button)

**Expected:**
- App background switches from dark to light
- All text and cards remain readable
- Theme preference is saved in localStorage (refresh page — theme persists)

---

### TC-SET-007 · Change AI model · P2

**Steps:**
1. In Settings → AI section, change model from `Qwen3 32B` to `Llama 3.3 70B`
2. Navigate to Dashboard and open AI Chat
3. Send a message

**Expected:**
- Model selection is saved (verify localStorage key `plutus_groq_model`)
- AI chat responds (model change is accepted by the backend)

---

## Module 12 — Navigation & Cross-Cutting Concerns

### TC-NAV-001 · Sidebar navigation — all links work · P1

**Steps:**
1. From Dashboard, click each sidebar link in order: Transactions, Accounts, Credit Cards, Budgets, Recurring, Categories, Reports, Import, Settings

**Expected:**
- Each click navigates to the correct page with correct page title
- No full page reload (URL changes via React Router; page content transitions without white flash)
- Active link is highlighted in the sidebar

---

### TC-NAV-002 · Direct URL navigation while logged in · P1

**Steps:** Type each URL directly: `/transactions`, `/accounts`, `/credit-cards`, `/budgets`, `/recurring`, `/categories`, `/reports`, `/import`, `/settings`

**Expected:** Each loads the correct page content without login redirect.

---

### TC-NAV-003 · 404 handling for unknown route · P3

**Steps:** Navigate to `http://localhost:8000/this-does-not-exist`

**Expected:** A 404 or "Not Found" page is shown, OR the user is redirected to the dashboard. The app does NOT show a blank white page or crash.

---

### TC-NAV-004 · Sidebar brand visible · P2

**Steps:** On any authenticated page, look at the sidebar.

**Expected:**
- "Plutus" logo/name visible
- "Your wealth, understood." tagline visible
- User's name and email shown at the bottom of the sidebar

---

### TC-NAV-005 · Responsive layout — mobile width · P3

**Steps:** Set browser width to 375px (iPhone SE size); navigate through all pages.

**Expected:** Content is readable, no horizontal scrollbars on main content areas, modals are usable.

---

### TC-NAV-006 · API error handling — backend down · P2

**Steps:**
1. Stop the backend server
2. Log in (session still active via cookie)
3. Try to load Transactions page

**Expected:** An error state is shown (e.g., "Failed to load transactions" or similar message) — the page does NOT crash or show a blank screen.

---

### TC-NAV-007 · Currency formatting — Indian Rupee format · P2

**Purpose:** Verify amounts display with ₹ symbol and Indian number formatting (lakhs/crores).

**Steps:** Add a transaction with amount `1500000`

**Expected:** Amount displays as `₹15,00,000` (Indian formatting, not `₹1,500,000`).

---

### TC-NAV-008 · Date format consistency · P2

**Purpose:** Dates should display consistently across all pages.

**Steps:** Check dates on Transactions list, Account cards, Budget section, Reports.

**Expected:** Date format is consistent (e.g., "22 Jun 2026" or "2026-06-22" everywhere).

---

### TC-NAV-009 · Modal closes on overlay click · P2

**Purpose:** Clicking outside a modal should dismiss it.

**Steps:**
1. Open any modal (Add Account, Add Transaction, etc.)
2. Click the dark overlay area outside the modal box

**Expected:** Modal closes without saving.

---

### TC-NAV-010 · Concurrent session — token refresh · P2

**Purpose:** Verify the app auto-refreshes the access token.

**Steps:**
1. Log in and stay on Dashboard
2. Wait 30 minutes (access token expires)
3. Click any action (e.g., add a transaction)

**Expected:**
- Action completes successfully (token was silently refreshed via the httpOnly cookie)
- User is NOT redirected to login

---

## Known Behaviours / Clarifications for Testers

| # | Behaviour | Explanation |
|---|---|---|
| 1 | Account balance doesn't change when no account is selected in a transaction | By design — you must select an account for balance tracking. This is shown in the "Selecting an account will update its balance" hint. |
| 2 | Net Savings can be negative | Correct when expenses > income for the period. Shows "No income recorded yet" hint when income = 0. |
| 3 | Opening balance set on account creation is not an income transaction | It's the starting balance only. Track subsequent income via the Transactions page. |
| 4 | Deleting a transaction reverses its balance impact | e.g., deleting a ₹100 expense adds ₹100 back to the linked account. |
| 5 | Only expense type shows CC outstanding impact | Income transactions do not affect credit card balances (credit cards are for spending, not income). |
| 6 | Reports Net Worth uses live account balances | It always shows current state, not historical. |
| 7 | Import CSV category matching | Category column must match a category name exactly (case-insensitive). Unmatched rows are marked invalid. |
