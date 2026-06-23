import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { transactionService } from '../services/transactionService'
import { categoryService } from '../services/categoryService'
import api from '../services/api'
import { formatINR } from '../utils/currency'

const LIMIT = 50

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  type: 'expense',
  amount: '',
  category_id: '',
  account_id: '',
  credit_card_id: '',
  notes: '',
  tags: '',
  is_recurring: false,
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [creditCards, setCreditCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [skip, setSkip] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'income' | 'expense'
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const { refreshKey } = useApp()
  const [categorySearch, setCategorySearch] = useState('')
  const [showCatDrop, setShowCatDrop] = useState(false)
  const catDropRef = useRef(null)

  // Close category dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (catDropRef.current && !catDropRef.current.contains(e.target)) {
        setShowCatDrop(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load reference data + first page of transactions on mount
  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const [txns, cats, accs, ccs] = await Promise.all([
          transactionService.list(0, LIMIT),
          categoryService.list(),
          api.get('/api/accounts').then((r) => r.data).catch(() => []),
          api.get('/api/credit-cards').then((r) => r.data).catch(() => []),
        ])
        setTransactions(txns)
        setHasMore(txns.length === LIMIT)
        setCategories(cats)
        setAccounts(Array.isArray(accs) ? accs : accs.items ?? [])
        setCreditCards(Array.isArray(ccs) ? ccs : ccs.items ?? [])
      } catch (err) {
        console.error('Failed to load transactions page data', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [refreshKey])

  // ---- helpers ----

  function getCategoryName(id) {
    const cat = categories.find((c) => c.id === id)
    return cat ? cat.name : '—'
  }

  function getAccountName(id) {
    const acc = accounts.find((a) => a.id === id)
    return acc ? acc.name : null
  }

  function getCreditCardName(id) {
    const cc = creditCards.find((c) => c.id === id)
    return cc ? cc.name : null
  }

  function getSourceLabel(txn) {
    if (txn.account_id) return getAccountName(txn.account_id) || '—'
    if (txn.credit_card_id) return getCreditCardName(txn.credit_card_id) || '—'
    return '—'
  }

  // ---- filter ----

  const filtered = transactions.filter((t) => {
    if (filter === 'all') return true
    return t.type === filter
  })

  // ---- load more ----

  async function loadMore() {
    const nextSkip = skip + LIMIT
    try {
      const more = await transactionService.list(nextSkip, LIMIT)
      setTransactions((prev) => [...prev, ...more])
      setSkip(nextSkip)
      setHasMore(more.length === LIMIT)
    } catch (err) {
      console.error('Failed to load more transactions', err)
    }
  }

  // ---- form helpers ----

  function openAddModal() {
    setEditingId(null)
    // Pre-select account when there's only one, so balance updates automatically
    setForm({ ...EMPTY_FORM, account_id: accounts.length === 1 ? accounts[0].id : '' })
    setFormError('')
    setCategorySearch('')
    setShowCatDrop(false)
    setShowModal(true)
  }

  function openEditModal(txn) {
    setEditingId(txn.id)
    setForm({
      date: txn.date ? txn.date.slice(0, 10) : '',
      type: txn.type,
      amount: txn.amount,
      category_id: txn.category_id || '',
      account_id: txn.account_id || '',
      credit_card_id: txn.credit_card_id || '',
      notes: txn.notes || '',
      tags: Array.isArray(txn.tags) ? txn.tags.join(', ') : txn.tags || '',
      is_recurring: txn.is_recurring || false,
    })
    const existingCat = categories.find((c) => c.id === txn.category_id)
    setCategorySearch(existingCat ? existingCat.name : '')
    setShowCatDrop(false)
    setFormError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setCategorySearch('')
    setShowCatDrop(false)
  }

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!form.date) return setFormError('Date is required.')
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
      return setFormError('Enter a valid positive amount.')
    if (!form.category_id) return setFormError('Please select a category.')

    const payload = {
      date: form.date,
      type: form.type,
      amount: Number(form.amount),
      category_id: form.category_id,
      account_id: form.account_id || undefined,
      credit_card_id: form.credit_card_id || undefined,
      notes: form.notes || undefined,
      tags: form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      is_recurring: form.is_recurring,
    }

    setSaving(true)
    try {
      if (editingId) {
        const updated = await transactionService.update(editingId, payload)
        setTransactions((prev) =>
          prev.map((t) => (t.id === editingId ? updated : t))
        )
      } else {
        const created = await transactionService.create(payload)
        setTransactions((prev) => [created, ...prev])
      }
      closeModal()
    } catch (err) {
      setFormError(
        err?.response?.data?.detail || 'Failed to save transaction. Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    try {
      await transactionService.delete(id)
      setTransactions((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      console.error('Failed to delete transaction', err)
    } finally {
      setDeleteConfirmId(null)
    }
  }

  // ---- render ----

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Transactions</h1>
          <p style={styles.subtitle}>Your full transaction history</p>
        </div>
        <button style={styles.addBtn} onClick={openAddModal}>
          + Add Transaction
        </button>
      </header>

      {/* Filter tabs */}
      <div style={styles.tabs}>
        {['all', 'income', 'expense'].map((tab) => (
          <button
            key={tab}
            style={filter === tab ? { ...styles.tab, ...styles.tabActive } : styles.tab}
            onClick={() => setFilter(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <p style={styles.stateMsg}>Loading transactions…</p>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>No transactions yet.</p>
          <p style={styles.emptyHint}>Add your first transaction.</p>
        </div>
      ) : (
        <>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Date', 'Category', 'Type', 'Amount', 'Notes', 'Source', ''].map(
                    (h) => (
                      <th key={h} style={styles.th}>
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((txn) => (
                  <tr key={txn.id} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={styles.dateText}>
                        {txn.date ? txn.date.slice(0, 10) : '—'}
                      </span>
                    </td>
                    <td style={styles.td}>{getCategoryName(txn.category_id)}</td>
                    <td style={styles.td}>
                      <span
                        style={
                          txn.type === 'income'
                            ? styles.badgeIncome
                            : styles.badgeExpense
                        }
                      >
                        {txn.type}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={
                          txn.type === 'income'
                            ? styles.amountIncome
                            : styles.amountExpense
                        }
                      >
                        {txn.type === 'income' ? '+' : '−'}
                        {formatINR(txn.amount)}
                      </span>
                    </td>
                    <td style={{ ...styles.td, ...styles.notesCell }}>
                      {txn.notes ? truncate(txn.notes, 40) : <span style={styles.muted}>—</span>}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.sourceLabel}>{getSourceLabel(txn)}</span>
                    </td>
                    <td style={{ ...styles.td, ...styles.actionCell }}>
                      <button
                        style={styles.iconBtn}
                        title="Edit"
                        onClick={() => openEditModal(txn)}
                      >
                        ✎
                      </button>
                      <button
                        style={{ ...styles.iconBtn, color: 'var(--color-expense)' }}
                        title="Delete"
                        onClick={() => setDeleteConfirmId(txn.id)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && filter === 'all' && (
            <div style={styles.loadMoreRow}>
              <button style={styles.loadMoreBtn} onClick={loadMore}>
                Load More
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete confirm dialog */}
      {deleteConfirmId && (
        <div style={styles.overlay} onClick={() => setDeleteConfirmId(null)}>
          <div style={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <p style={styles.confirmMsg}>Delete this transaction?</p>
            <p style={styles.confirmSub}>This action cannot be undone.</p>
            <div style={styles.confirmActions}>
              <button style={styles.cancelBtn} onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </button>
              <button
                style={styles.deleteBtn}
                onClick={() => handleDelete(deleteConfirmId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div style={styles.overlay} onClick={closeModal}>
          <div
            style={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {editingId ? 'Edit Transaction' : 'Add Transaction'}
              </h2>
              <button style={styles.closeBtn} onClick={closeModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              {/* Date */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Date</label>
                <input
                  type="date"
                  style={styles.input}
                  value={form.date}
                  onChange={(e) => handleFormChange('date', e.target.value)}
                  required
                />
              </div>

              {/* Type toggle */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Type</label>
                <div style={styles.typeToggle}>
                  <button
                    type="button"
                    style={
                      form.type === 'expense'
                        ? { ...styles.toggleBtn, ...styles.toggleBtnExpenseActive }
                        : { ...styles.toggleBtn, ...styles.toggleBtnInactive }
                    }
                    onClick={() => {
                      handleFormChange('type', 'expense')
                      handleFormChange('category_id', '')
                      setCategorySearch('')
                    }}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    style={
                      form.type === 'income'
                        ? { ...styles.toggleBtn, ...styles.toggleBtnIncomeActive }
                        : { ...styles.toggleBtn, ...styles.toggleBtnInactive }
                    }
                    onClick={() => {
                      handleFormChange('type', 'income')
                      handleFormChange('category_id', '')
                      setCategorySearch('')
                    }}
                  >
                    Income
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Amount (₹)</label>
                <input
                  type="number"
                  style={styles.input}
                  placeholder="0"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => handleFormChange('amount', e.target.value)}
                  required
                />
              </div>

              {/* Category — searchable combobox */}
              <div style={styles.fieldGroup} ref={catDropRef}>
                <label style={styles.label}>Category</label>
                <div style={styles.comboWrap}>
                  <input
                    type="text"
                    style={styles.input}
                    placeholder={`Search ${form.type} categories…`}
                    value={categorySearch}
                    onChange={(e) => {
                      setCategorySearch(e.target.value)
                      handleFormChange('category_id', '')
                      setShowCatDrop(true)
                    }}
                    onFocus={() => setShowCatDrop(true)}
                    autoComplete="off"
                  />
                  {showCatDrop && (() => {
                    const q = categorySearch.toLowerCase()
                    const filtered = categories.filter(
                      (c) => c.type === form.type && c.name.toLowerCase().includes(q)
                    )
                    return filtered.length > 0 ? (
                      <ul style={styles.catDropList}>
                        {filtered.map((cat) => (
                          <li
                            key={cat.id}
                            style={{
                              ...styles.catDropItem,
                              ...(form.category_id === cat.id ? styles.catDropItemActive : {}),
                            }}
                            onMouseEnter={(e) => { if (form.category_id !== cat.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                            onMouseLeave={(e) => { if (form.category_id !== cat.id) e.currentTarget.style.backgroundColor = '' }}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              handleFormChange('category_id', cat.id)
                              setCategorySearch(cat.name)
                              setShowCatDrop(false)
                            }}
                          >
                            <span style={styles.catIcon}>{cat.icon}</span>
                            {cat.name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul style={styles.catDropList}>
                        <li style={{ ...styles.catDropItem, color: 'var(--color-text-muted)', cursor: 'default' }}>
                          No matches
                        </li>
                      </ul>
                    )
                  })()}
                </div>
              </div>

              {/* Account (optional) */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  Account{' '}
                  <span style={styles.optionalTag}>(optional)</span>
                </label>
                <select
                  style={styles.select}
                  value={form.account_id}
                  onChange={(e) => handleFormChange('account_id', e.target.value)}
                >
                  <option value="">None</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
                <p style={styles.fieldHint}>
                  Selecting an account will update its balance automatically.
                </p>
              </div>

              {/* Credit Card (optional) */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  Credit Card{' '}
                  <span style={styles.optionalTag}>(optional)</span>
                </label>
                <select
                  style={styles.select}
                  value={form.credit_card_id}
                  onChange={(e) => handleFormChange('credit_card_id', e.target.value)}
                >
                  <option value="">None</option>
                  {creditCards.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes (optional) */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  Notes{' '}
                  <span style={styles.optionalTag}>(optional)</span>
                </label>
                <textarea
                  style={{ ...styles.input, ...styles.textarea }}
                  placeholder="Add a note…"
                  value={form.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  rows={2}
                />
              </div>

              {/* Tags (optional) */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  Tags{' '}
                  <span style={styles.optionalTag}>(comma-separated, optional)</span>
                </label>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="e.g. food, travel, utilities"
                  value={form.tags}
                  onChange={(e) => handleFormChange('tags', e.target.value)}
                />
              </div>

              {/* Recurring */}
              <div style={styles.checkRow}>
                <input
                  id="is_recurring"
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={(e) => handleFormChange('is_recurring', e.target.checked)}
                  style={styles.checkbox}
                />
                <label htmlFor="is_recurring" style={styles.checkLabel}>
                  Recurring transaction
                </label>
              </div>

              {formError && <p style={styles.errorMsg}>{formError}</p>}

              <div style={styles.modalActions}>
                <button type="button" style={styles.cancelBtn} onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn} disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Update' : 'Add Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function truncate(str, max) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

const styles = {
  page: {
    minHeight: '100dvh',
    backgroundColor: 'var(--color-base)',
    padding: '1.5rem',
    maxWidth: 1100,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.25rem',
  },
  pageTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 24,
    fontWeight: 400,
    color: 'var(--color-text-primary)',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  addBtn: {
    backgroundColor: 'var(--color-gold)',
    color: '#0d1629',
    border: 'none',
    borderRadius: 8,
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: 'inherit',
    fontWeight: 600,
    minHeight: 36,
    whiteSpace: 'nowrap',
  },
  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: '1.25rem',
    borderBottom: '1px solid var(--color-border)',
    paddingBottom: 0,
  },
  tab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 500,
    padding: '0.5rem 1rem',
    marginBottom: -1,
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: 'var(--color-gold)',
    borderBottomColor: 'var(--color-gold)',
  },
  stateMsg: {
    color: 'var(--color-text-secondary)',
    fontSize: 14,
    padding: '2rem 0',
    textAlign: 'center',
  },
  emptyState: {
    textAlign: 'center',
    padding: '4rem 1rem',
  },
  emptyTitle: {
    fontSize: 16,
    color: 'var(--color-text-primary)',
    fontWeight: 500,
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: 12,
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-card)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
  },
  th: {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--color-text-muted)',
    borderBottom: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid var(--color-border)',
  },
  td: {
    padding: '0.75rem 1rem',
    verticalAlign: 'middle',
    color: 'var(--color-text-primary)',
  },
  dateText: {
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--color-text-secondary)',
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  badgeIncome: {
    backgroundColor: 'rgba(61,214,140,0.12)',
    color: 'var(--color-income)',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 500,
    display: 'inline-block',
  },
  badgeExpense: {
    backgroundColor: 'rgba(242,109,109,0.12)',
    color: 'var(--color-expense)',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 500,
    display: 'inline-block',
  },
  amountIncome: {
    color: 'var(--color-income)',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  amountExpense: {
    color: 'var(--color-expense)',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  notesCell: {
    maxWidth: 200,
    color: 'var(--color-text-secondary)',
    fontSize: 13,
  },
  muted: {
    color: 'var(--color-text-muted)',
  },
  sourceLabel: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
  },
  actionCell: {
    whiteSpace: 'nowrap',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontSize: 15,
    padding: '0 6px',
    lineHeight: 1,
    fontFamily: 'inherit',
  },
  loadMoreRow: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '1.25rem',
  },
  loadMoreBtn: {
    background: 'none',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-secondary)',
    borderRadius: 8,
    padding: '0.5rem 1.5rem',
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  // Modal / overlay
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modalCard: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90dvh',
    overflowY: 'auto',
    padding: '1.5rem',
    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  modalTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 20,
    fontWeight: 400,
    color: 'var(--color-text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
    padding: 4,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--color-text-secondary)',
  },
  optionalTag: {
    fontWeight: 400,
    textTransform: 'none',
    letterSpacing: 0,
    color: 'var(--color-text-muted)',
    fontSize: 11,
  },
  fieldHint: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    marginTop: 3,
  },
  input: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit',
    fontSize: 14,
    padding: '0.5rem 0.75rem',
    outline: 'none',
    width: '100%',
  },
  textarea: {
    resize: 'vertical',
    lineHeight: 1.5,
  },
  select: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit',
    fontSize: 14,
    padding: '0.5rem 0.75rem',
    outline: 'none',
    width: '100%',
    cursor: 'pointer',
  },
  typeToggle: {
    display: 'flex',
    gap: 6,
  },
  toggleBtn: {
    flex: 1,
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 500,
    padding: '0.45rem 0',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
  },
  toggleBtnInactive: {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-secondary)',
  },
  toggleBtnIncomeActive: {
    backgroundColor: 'rgba(61,214,140,0.15)',
    color: 'var(--color-income)',
    borderColor: 'var(--color-income)',
  },
  toggleBtnExpenseActive: {
    backgroundColor: 'rgba(242,109,109,0.15)',
    color: 'var(--color-expense)',
    borderColor: 'var(--color-expense)',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    accentColor: 'var(--color-gold)',
    width: 16,
    height: 16,
    cursor: 'pointer',
  },
  checkLabel: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  errorMsg: {
    fontSize: 13,
    color: 'var(--color-expense)',
    backgroundColor: 'rgba(242,109,109,0.08)',
    borderRadius: 6,
    padding: '0.5rem 0.75rem',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    padding: '0.45rem 1rem',
  },
  submitBtn: {
    backgroundColor: 'var(--color-gold)',
    border: 'none',
    borderRadius: 8,
    color: '#0d1629',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    padding: '0.45rem 1.25rem',
  },
  // Category combobox
  comboWrap: {
    position: 'relative',
  },
  catDropList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    listStyle: 'none',
    margin: '2px 0 0',
    padding: '4px 0',
    maxHeight: 220,
    overflowY: 'auto',
    zIndex: 200,
  },
  catDropItem: {
    padding: '0.45rem 0.75rem',
    fontSize: 14,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  catDropItemActive: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    color: 'var(--color-gold)',
  },
  catIcon: {
    fontSize: 16,
    lineHeight: 1,
    flexShrink: 0,
  },
  // Delete confirm card
  confirmCard: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.5rem',
    maxWidth: 360,
    width: '100%',
    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  },
  confirmMsg: {
    fontSize: 16,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: 6,
  },
  confirmSub: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    marginBottom: '1.25rem',
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  deleteBtn: {
    backgroundColor: 'var(--color-expense)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 600,
    padding: '0.45rem 1.25rem',
  },
}
