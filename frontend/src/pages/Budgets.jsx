import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { categoryService } from '../services/categoryService'
import { budgetService } from '../services/budgetService'
import { formatINR } from '../utils/currency'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatMonthLabel(year, month) {
  return `${MONTHS[month - 1]} ${year}`
}

function getBarColor(ratio) {
  if (ratio >= 0.9) return 'var(--color-expense)'
  if (ratio >= 0.7) return 'var(--color-warning)'
  return 'var(--color-income)'
}

export default function Budgets() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [budgets, setBudgets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({
    category_id: '',
    amount: '',
    period: 'monthly',
    start_date: '',
  })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState(null)

  // Edit state: maps budget id -> draft amount string
  const [editingId, setEditingId] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState(null)
  const { refreshKey } = useApp()

  // Fetch categories once on mount
  useEffect(() => {
    categoryService.list()
      .then(setCategories)
      .catch(() => {}) // non-fatal; categories may still be empty
  }, [])

  // Fetch budgets whenever year/month changes
  useEffect(() => {
    setLoading(true)
    setError(null)
    budgetService.list(year, month)
      .then(setBudgets)
      .catch((err) => setError(err?.response?.data?.detail || 'Failed to load budgets.'))
      .finally(() => setLoading(false))
  }, [year, month, refreshKey])

  // Month navigation
  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  // Category lookup helper
  function getCategoryName(categoryId) {
    const cat = categories.find((c) => c.id === categoryId)
    return cat ? cat.name : categoryId
  }

  // Add budget
  async function handleAdd(e) {
    e.preventDefault()
    setAddLoading(true)
    setAddError(null)
    try {
      const created = await budgetService.create({
        category_id: addForm.category_id,
        amount: parseFloat(addForm.amount),
        period: addForm.period,
        start_date: addForm.start_date,
      })
      setBudgets((prev) => [...prev, created])
      setShowAddForm(false)
      setAddForm({ category_id: '', amount: '', period: 'monthly', start_date: '' })
    } catch (err) {
      setAddError(err?.response?.data?.detail || 'Failed to create budget.')
    } finally {
      setAddLoading(false)
    }
  }

  // Start inline edit
  function startEdit(budget) {
    setEditingId(budget.id)
    setEditAmount(String(budget.amount))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditAmount('')
  }

  async function handleEditSave(id) {
    setEditLoading(true)
    try {
      const updated = await budgetService.update(id, { amount: parseFloat(editAmount) })
      setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, ...updated } : b)))
      setEditingId(null)
      setEditAmount('')
    } catch {
      // Silently keep the edit open so user can retry or cancel
    } finally {
      setEditLoading(false)
    }
  }

  // Delete budget
  async function handleDelete(id) {
    setDeletingId(id)
    try {
      await budgetService.delete(id)
      setBudgets((prev) => prev.filter((b) => b.id !== id))
    } catch {
      // Restore UI on failure — deletion failed silently
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.pageTitle}>Budgets</h1>
        <button
          style={styles.addBtn}
          onClick={() => { setShowAddForm((v) => !v); setAddError(null) }}
        >
          {showAddForm ? 'Cancel' : '+ Add Budget'}
        </button>
      </header>

      {/* Month selector */}
      <div style={styles.monthSelector}>
        <button style={styles.navBtn} onClick={prevMonth} aria-label="Previous month">&#8249;</button>
        <span style={styles.monthLabel}>{formatMonthLabel(year, month)}</span>
        <button style={styles.navBtn} onClick={nextMonth} aria-label="Next month">&#8250;</button>
      </div>

      {/* Add Budget Form */}
      {showAddForm && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>New Budget</h2>
          <form onSubmit={handleAdd} style={styles.form}>
            <div style={styles.formRow}>
              <label style={styles.label}>Category</label>
              <select
                style={styles.select}
                value={addForm.category_id}
                onChange={(e) => setAddForm((f) => ({ ...f, category_id: e.target.value }))}
                required
              >
                <option value="">Select category…</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div style={styles.formRow}>
              <label style={styles.label}>Amount (₹)</label>
              <input
                style={styles.input}
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 5000"
                value={addForm.amount}
                onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>

            <div style={styles.formRow}>
              <label style={styles.label}>Period</label>
              <select
                style={styles.select}
                value={addForm.period}
                onChange={(e) => setAddForm((f) => ({ ...f, period: e.target.value }))}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div style={styles.formRow}>
              <label style={styles.label}>Start Date</label>
              <input
                style={styles.input}
                type="date"
                value={addForm.start_date}
                onChange={(e) => setAddForm((f) => ({ ...f, start_date: e.target.value }))}
                required
              />
            </div>

            {addError && <p style={styles.errorText}>{addError}</p>}

            <div style={styles.formActions}>
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={() => { setShowAddForm(false); setAddError(null) }}
              >
                Cancel
              </button>
              <button type="submit" style={styles.submitBtn} disabled={addLoading}>
                {addLoading ? 'Saving…' : 'Save Budget'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Budget List */}
      {loading && <p style={styles.statusText}>Loading budgets…</p>}
      {error && <p style={styles.errorText}>{error}</p>}

      {!loading && !error && budgets.length === 0 && (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No budgets set for {formatMonthLabel(year, month)}.</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            Click "Add Budget" to create one.
          </p>
        </div>
      )}

      {!loading && budgets.length > 0 && (
        <div style={styles.budgetList}>
          {budgets.map((budget) => {
            const spent = budget.spent ?? 0
            const amount = budget.amount
            const ratio = amount > 0 ? spent / amount : 0
            const percent = Math.round(ratio * 100)
            const remaining = amount - spent
            const barColor = getBarColor(ratio)
            const isEditing = editingId === budget.id
            const isDeleting = deletingId === budget.id

            return (
              <div key={budget.id} style={styles.budgetCard}>
                <div style={styles.budgetTop}>
                  {/* Category + period */}
                  <div style={styles.budgetMeta}>
                    <span style={styles.categoryName}>{getCategoryName(budget.category_id)}</span>
                    <span style={styles.periodBadge}>{budget.period}</span>
                  </div>

                  {/* Actions */}
                  <div style={styles.actions}>
                    <button
                      style={styles.iconBtn}
                      title="Edit amount"
                      onClick={() => isEditing ? cancelEdit() : startEdit(budget)}
                      aria-label="Edit budget"
                    >
                      {isEditing ? '✕' : '✏'}
                    </button>
                    <button
                      style={{ ...styles.iconBtn, color: 'var(--color-expense)' }}
                      title="Delete budget"
                      onClick={() => handleDelete(budget.id)}
                      disabled={isDeleting}
                      aria-label="Delete budget"
                    >
                      {isDeleting ? '…' : '🗑'}
                    </button>
                  </div>
                </div>

                {/* Inline edit */}
                {isEditing && (
                  <div style={styles.inlineEdit}>
                    <input
                      style={{ ...styles.input, flex: 1 }}
                      type="number"
                      min="1"
                      step="1"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      autoFocus
                    />
                    <button
                      style={styles.submitBtn}
                      onClick={() => handleEditSave(budget.id)}
                      disabled={editLoading}
                    >
                      {editLoading ? '…' : 'Save'}
                    </button>
                    <button style={styles.cancelBtn} onClick={cancelEdit}>Cancel</button>
                  </div>
                )}

                {/* Amount row */}
                <div style={styles.amountRow}>
                  <span style={styles.spentAmount}>{formatINR(spent)}</span>
                  <span style={styles.amountSep}>of</span>
                  <span style={styles.budgetAmount}>{formatINR(amount)}</span>
                </div>

                {/* Progress bar */}
                <div style={styles.progressTrack}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${Math.min(ratio * 100, 100)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>

                {/* Footer: percent used + remaining */}
                <div style={styles.budgetFooter}>
                  <span style={{ ...styles.percentText, color: barColor }}>
                    {percent}% used
                  </span>
                  <span style={styles.remainingText}>
                    {remaining >= 0
                      ? `${formatINR(remaining)} remaining`
                      : `${formatINR(Math.abs(remaining))} over budget`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100dvh',
    backgroundColor: 'var(--color-base)',
    padding: '1.5rem',
    maxWidth: 900,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  pageTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 24,
    fontWeight: 400,
    color: 'var(--color-text-primary)',
  },
  addBtn: {
    background: 'var(--color-gold)',
    border: 'none',
    color: '#1a1208',
    borderRadius: 8,
    padding: '0.45rem 1rem',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    minHeight: 36,
  },
  monthSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  navBtn: {
    background: 'none',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: 'pointer',
    fontSize: 18,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    minWidth: 130,
    textAlign: 'center',
  },
  // Form
  formCard: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.25rem',
    marginBottom: '1.5rem',
  },
  formTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 18,
    fontWeight: 400,
    color: 'var(--color-text-primary)',
    marginBottom: '1rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  formRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  input: {
    backgroundColor: 'var(--color-base)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '0.5rem 0.75rem',
    fontSize: 14,
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit',
    outline: 'none',
  },
  select: {
    backgroundColor: 'var(--color-base)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '0.5rem 0.75rem',
    fontSize: 14,
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    marginTop: '0.25rem',
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
    borderRadius: 8,
    padding: '0.45rem 0.875rem',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    minHeight: 36,
  },
  submitBtn: {
    background: 'var(--color-gold)',
    border: 'none',
    color: '#1a1208',
    borderRadius: 8,
    padding: '0.45rem 1rem',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    minHeight: 36,
  },
  errorText: {
    fontSize: 13,
    color: 'var(--color-expense)',
    margin: '0.25rem 0',
  },
  statusText: {
    fontSize: 14,
    color: 'var(--color-text-muted)',
    padding: '2rem 0',
    textAlign: 'center',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1rem',
  },
  emptyText: {
    fontSize: 15,
    color: 'var(--color-text-secondary)',
    marginBottom: 4,
  },
  // Budget cards
  budgetList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  budgetCard: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.125rem',
  },
  budgetTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  budgetMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  categoryName: {
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  periodBadge: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    padding: '1px 6px',
    textTransform: 'capitalize',
  },
  actions: {
    display: 'flex',
    gap: '0.25rem',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontSize: 14,
    padding: '0.25rem 0.375rem',
    borderRadius: 6,
    lineHeight: 1,
  },
  inlineEdit: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  amountRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.375rem',
    marginBottom: '0.625rem',
  },
  spentAmount: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 20,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  amountSep: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
  },
  budgetAmount: {
    fontSize: 15,
    color: 'var(--color-text-secondary)',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'var(--color-border)',
    overflow: 'hidden',
    marginBottom: '0.5rem',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  budgetFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentText: {
    fontSize: 12,
    fontWeight: 600,
  },
  remainingText: {
    fontSize: 12,
    color: 'var(--color-text-muted)',
  },
}
