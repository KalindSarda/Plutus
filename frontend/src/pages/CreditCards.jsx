import { useState, useEffect, useCallback } from 'react'
import { creditCardService } from '../services/creditCardService'
import { formatINR } from '../utils/currency'

const EMPTY_FORM = {
  name: '',
  bank_name: '',
  credit_limit: '',
  billing_cycle_day: '',
  due_day: '',
}

export default function CreditCards() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Map of cardId -> statements array (loaded on expand)
  const [statementsMap, setStatementsMap] = useState({})
  const [expandedCard, setExpandedCard] = useState(null)
  const [stmtsLoading, setStmtsLoading] = useState(false)

  // Pay dialog state
  const [payDialog, setPayDialog] = useState(null) // { cardId, stmt }
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await creditCardService.list()
      setCards(data)
    } catch {
      setError('Failed to load credit cards.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(card) {
    setEditTarget(card)
    setForm({
      name: card.name,
      bank_name: card.bank_name,
      credit_limit: String(card.credit_limit),
      billing_cycle_day: String(card.billing_cycle_day),
      due_day: String(card.due_day),
    })
    setFormError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditTarget(null)
    setFormError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    const payload = {
      name: form.name.trim(),
      bank_name: form.bank_name.trim(),
      credit_limit: parseFloat(form.credit_limit),
      billing_cycle_day: parseInt(form.billing_cycle_day, 10),
      due_day: parseInt(form.due_day, 10),
    }
    if (!payload.name || !payload.bank_name) {
      setFormError('Name and bank name are required.')
      return
    }
    if (isNaN(payload.credit_limit) || payload.credit_limit <= 0) {
      setFormError('Credit limit must be a positive number.')
      return
    }
    if (
      isNaN(payload.billing_cycle_day) ||
      payload.billing_cycle_day < 1 ||
      payload.billing_cycle_day > 31
    ) {
      setFormError('Billing cycle day must be between 1 and 31.')
      return
    }
    if (isNaN(payload.due_day) || payload.due_day < 1 || payload.due_day > 31) {
      setFormError('Due day must be between 1 and 31.')
      return
    }
    try {
      setSaving(true)
      if (editTarget) {
        await creditCardService.update(editTarget.id, payload)
      } else {
        await creditCardService.create(payload)
      }
      closeModal()
      await load()
    } catch {
      setFormError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await creditCardService.delete(deleteTarget.id)
      setDeleteTarget(null)
      if (expandedCard === deleteTarget.id) setExpandedCard(null)
      await load()
    } catch {
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  async function toggleStatements(cardId) {
    if (expandedCard === cardId) {
      setExpandedCard(null)
      return
    }
    setExpandedCard(cardId)
    if (statementsMap[cardId]) return // already loaded
    try {
      setStmtsLoading(true)
      const data = await creditCardService.statements(cardId)
      setStatementsMap((prev) => ({ ...prev, [cardId]: data }))
    } catch {
      setStatementsMap((prev) => ({ ...prev, [cardId]: [] }))
    } finally {
      setStmtsLoading(false)
    }
  }

  function openPayDialog(cardId, stmt) {
    setPayDialog({ cardId, stmt })
    setPayAmount(String(stmt.total_due ?? stmt.total ?? ''))
    setPayError(null)
  }

  function closePayDialog() {
    setPayDialog(null)
    setPayAmount('')
    setPayError(null)
  }

  async function handlePay(e) {
    e.preventDefault()
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount <= 0) {
      setPayError('Enter a valid amount.')
      return
    }
    try {
      setPaying(true)
      await creditCardService.payStatement(payDialog.cardId, payDialog.stmt.id, amount)
      // Refresh statements for this card
      const updated = await creditCardService.statements(payDialog.cardId)
      setStatementsMap((prev) => ({ ...prev, [payDialog.cardId]: updated }))
      closePayDialog()
      await load()
    } catch {
      setPayError('Payment failed. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Credit Cards</h1>
          <p style={styles.sub}>Manage your credit cards and statements</p>
        </div>
        <button onClick={openAdd} style={styles.addBtn}>
          + Add Card
        </button>
      </header>

      {/* Card list */}
      {loading ? (
        <p style={styles.stateMsg}>Loading credit cards...</p>
      ) : error ? (
        <p style={{ ...styles.stateMsg, color: 'var(--color-expense)' }}>{error}</p>
      ) : cards.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>No credit cards yet</p>
          <p style={styles.emptyHint}>Add a credit card to track your spending and statements.</p>
        </div>
      ) : (
        <div style={styles.cardList}>
          {cards.map((card) => (
            <CreditCardItem
              key={card.id}
              card={card}
              expanded={expandedCard === card.id}
              statements={statementsMap[card.id]}
              stmtsLoading={stmtsLoading && expandedCard === card.id}
              onEdit={() => openEdit(card)}
              onDelete={() => setDeleteTarget(card)}
              onToggleStatements={() => toggleStatements(card.id)}
              onPayStatement={(stmt) => openPayDialog(card.id, stmt)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <Modal title={editTarget ? 'Edit Credit Card' : 'Add Credit Card'} onClose={closeModal}>
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>
              Card Name
              <input
                style={styles.input}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. HDFC Regalia"
                required
              />
            </label>
            <label style={styles.label}>
              Bank Name
              <input
                style={styles.input}
                value={form.bank_name}
                onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                placeholder="e.g. HDFC Bank"
                required
              />
            </label>
            <label style={styles.label}>
              Credit Limit (₹)
              <input
                style={styles.input}
                type="number"
                min="1"
                step="1"
                value={form.credit_limit}
                onChange={(e) => setForm((f) => ({ ...f, credit_limit: e.target.value }))}
                placeholder="e.g. 200000"
                required
              />
            </label>
            <div style={styles.row}>
              <label style={{ ...styles.label, flex: 1 }}>
                Billing Cycle Day
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  max="31"
                  value={form.billing_cycle_day}
                  onChange={(e) => setForm((f) => ({ ...f, billing_cycle_day: e.target.value }))}
                  placeholder="1–31"
                  required
                />
              </label>
              <label style={{ ...styles.label, flex: 1 }}>
                Due Day
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  max="31"
                  value={form.due_day}
                  onChange={(e) => setForm((f) => ({ ...f, due_day: e.target.value }))}
                  placeholder="1–31"
                  required
                />
              </label>
            </div>
            {formError && <p style={styles.formError}>{formError}</p>}
            <div style={styles.modalFooter}>
              <button type="button" onClick={closeModal} style={styles.cancelBtn} disabled={saving}>
                Cancel
              </button>
              <button type="submit" style={styles.submitBtn} disabled={saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Card'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm Dialog */}
      {deleteTarget && (
        <Modal title="Delete Credit Card" onClose={() => setDeleteTarget(null)}>
          <p style={styles.confirmText}>
            Are you sure you want to delete{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>{deleteTarget.name}</strong>?
            This cannot be undone.
          </p>
          <div style={{ ...styles.modalFooter, marginTop: '1.25rem' }}>
            <button
              onClick={() => setDeleteTarget(null)}
              style={styles.cancelBtn}
              disabled={deleting}
            >
              Cancel
            </button>
            <button onClick={handleDelete} style={styles.deleteBtn} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {/* Pay Statement Dialog */}
      {payDialog && (
        <Modal title="Mark Statement Paid" onClose={closePayDialog}>
          <p style={{ ...styles.confirmText, marginBottom: '1rem' }}>
            Enter the amount paid for the statement ending{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {formatDate(payDialog.stmt.billing_period_end ?? payDialog.stmt.end_date)}
            </strong>.
          </p>
          <form onSubmit={handlePay} style={styles.form}>
            <label style={styles.label}>
              Amount Paid (₹)
              <input
                style={styles.input}
                type="number"
                min="1"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
                autoFocus
              />
            </label>
            {payError && <p style={styles.formError}>{payError}</p>}
            <div style={styles.modalFooter}>
              <button type="button" onClick={closePayDialog} style={styles.cancelBtn} disabled={paying}>
                Cancel
              </button>
              <button type="submit" style={styles.submitBtn} disabled={paying}>
                {paying ? 'Saving…' : 'Mark Paid'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function CreditCardItem({
  card,
  expanded,
  statements,
  stmtsLoading,
  onEdit,
  onDelete,
  onToggleStatements,
  onPayStatement,
}) {
  const outstanding = card.outstanding ?? card.current_outstanding ?? 0
  const limit = card.credit_limit ?? 0
  const available = Math.max(limit - outstanding, 0)
  const ratio = limit > 0 ? outstanding / limit : 0

  return (
    <div style={styles.ccCard}>
      {/* Card top section */}
      <div style={styles.ccTop}>
        <div style={styles.ccInfo}>
          <p style={styles.ccName}>{card.name}</p>
          <p style={styles.ccBank}>{card.bank_name}</p>
        </div>
        <div style={styles.ccRight}>
          <p style={styles.ccAvailLabel}>Available</p>
          <p style={styles.heroNumber}>{formatINR(available)}</p>
        </div>
      </div>

      {/* Usage bar */}
      <div style={styles.barTrack}>
        <div
          style={{
            ...styles.barFill,
            width: `${Math.min(ratio * 100, 100)}%`,
            backgroundColor: getBarColor(ratio),
          }}
        />
      </div>

      {/* Outstanding / Limit */}
      <div style={styles.ccMeta}>
        <span style={styles.metaItem}>
          Outstanding: <span style={{ color: 'var(--color-text-primary)' }}>{formatINR(outstanding)}</span>
        </span>
        <span style={styles.metaItem}>
          Limit: <span style={{ color: 'var(--color-text-primary)' }}>{formatINR(limit)}</span>
        </span>
      </div>

      {/* Cycle info */}
      <div style={styles.ccCycleRow}>
        <span style={styles.metaItem}>
          Billing day: <span style={{ color: 'var(--color-text-primary)' }}>{card.billing_cycle_day}</span>
        </span>
        <span style={styles.metaItem}>
          Due day: <span style={{ color: 'var(--color-text-primary)' }}>{card.due_day}</span>
        </span>
      </div>

      {/* Action row */}
      <div style={styles.ccActions}>
        <button onClick={onToggleStatements} style={styles.stmtToggleBtn}>
          {expanded ? 'Hide Statements' : 'View Statements'}
          <ChevronIcon expanded={expanded} />
        </button>
        <div style={styles.iconGroup}>
          <button onClick={onEdit} style={styles.iconBtn} title="Edit card">
            <PencilIcon />
          </button>
          <button onClick={onDelete} style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} title="Delete card">
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Statements section */}
      {expanded && (
        <div style={styles.stmtsSection}>
          {stmtsLoading ? (
            <p style={styles.stmtsMsgText}>Loading statements...</p>
          ) : !statements || statements.length === 0 ? (
            <p style={styles.stmtsMsgText}>No statements available.</p>
          ) : (
            <div style={styles.stmtsList}>
              {statements.map((stmt) => (
                <StatementRow key={stmt.id} stmt={stmt} onPay={() => onPayStatement(stmt)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatementRow({ stmt, onPay }) {
  const isPaid = stmt.is_paid ?? stmt.paid ?? false
  const total = stmt.total_due ?? stmt.total_amount ?? stmt.total ?? 0
  const startDate = stmt.billing_period_start ?? stmt.start_date
  const endDate = stmt.billing_period_end ?? stmt.end_date
  const dueDate = stmt.due_date

  return (
    <div style={styles.stmtRow}>
      <div style={styles.stmtLeft}>
        <p style={styles.stmtPeriod}>
          {formatDate(startDate)} – {formatDate(endDate)}
        </p>
        {dueDate && (
          <p style={styles.stmtDue}>Due: {formatDate(dueDate)}</p>
        )}
      </div>
      <div style={styles.stmtRight}>
        <p style={styles.stmtTotal}>{formatINR(total)}</p>
        {isPaid ? (
          <span style={styles.paidBadge}>Paid</span>
        ) : (
          <button onClick={onPay} style={styles.markPaidBtn}>
            Mark Paid
          </button>
        )}
      </div>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div
      style={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{title}</h2>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ChevronIcon({ expanded }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function getBarColor(ratio) {
  if (ratio >= 0.9) return 'var(--color-expense)'
  if (ratio >= 0.7) return 'var(--color-warning)'
  return 'var(--color-income)'
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const styles = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
  },
  pageTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 24,
    fontWeight: 400,
    color: 'var(--color-text-primary)',
    marginBottom: 2,
  },
  sub: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
  },
  addBtn: {
    backgroundColor: 'var(--color-gold)',
    color: '#080c18',
    border: 'none',
    borderRadius: 8,
    padding: '0.5rem 1rem',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  stateMsg: {
    color: 'var(--color-text-secondary)',
    fontSize: 14,
    textAlign: 'center',
    padding: '2rem 0',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1rem',
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
  },
  emptyTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 18,
    color: 'var(--color-text-secondary)',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
  },
  cardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  ccCard: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.125rem',
  },
  ccTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.875rem',
  },
  ccInfo: {
    flex: 1,
    minWidth: 0,
  },
  ccName: {
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: 2,
  },
  ccBank: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  ccRight: {
    textAlign: 'right',
    flexShrink: 0,
    marginLeft: '1rem',
  },
  ccAvailLabel: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    marginBottom: 2,
  },
  heroNumber: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 22,
    fontWeight: 500,
    color: 'var(--color-gold)',
  },
  barTrack: {
    height: 4,
    backgroundColor: 'var(--color-border)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: '0.625rem',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  ccMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.375rem',
  },
  ccCycleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.875rem',
  },
  metaItem: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  ccActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '0.75rem',
    borderTop: '1px solid var(--color-border)',
  },
  stmtToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    color: 'var(--color-text-secondary)',
    fontSize: 12,
    fontFamily: 'inherit',
    padding: '0.375rem 0.75rem',
    cursor: 'pointer',
  },
  iconGroup: {
    display: 'flex',
    gap: 6,
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  iconBtnDanger: {
    color: 'var(--color-expense)',
    borderColor: 'rgba(242,109,109,0.25)',
  },
  stmtsSection: {
    marginTop: '0.875rem',
    paddingTop: '0.875rem',
    borderTop: '1px solid var(--color-border)',
  },
  stmtsMsgText: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
    textAlign: 'center',
    padding: '0.75rem 0',
  },
  stmtsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  stmtRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '0.625rem 0.875rem',
  },
  stmtLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  stmtPeriod: {
    fontSize: 13,
    color: 'var(--color-text-primary)',
    fontWeight: 500,
  },
  stmtDue: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
  },
  stmtRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexShrink: 0,
  },
  stmtTotal: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  paidBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-income)',
    backgroundColor: 'rgba(61,214,140,0.1)',
    borderRadius: 20,
    padding: '2px 10px',
  },
  markPaidBtn: {
    backgroundColor: 'transparent',
    border: '1px solid var(--color-gold-muted)',
    borderRadius: 6,
    color: 'var(--color-gold)',
    fontSize: 12,
    fontFamily: 'inherit',
    fontWeight: 500,
    padding: '0.25rem 0.625rem',
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(8,12,24,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '1rem',
  },
  modal: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 14,
    padding: '1.5rem',
    width: '100%',
    maxWidth: 440,
    maxHeight: '90dvh',
    overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  modalTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 18,
    fontWeight: 400,
    color: 'var(--color-text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    fontSize: 22,
    cursor: 'pointer',
    lineHeight: 1,
    padding: '0 2px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  row: {
    display: 'flex',
    gap: '0.75rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  input: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    fontSize: 14,
    fontFamily: 'inherit',
    padding: '0.5rem 0.75rem',
    outline: 'none',
    width: '100%',
  },
  formError: {
    fontSize: 12,
    color: 'var(--color-expense)',
    marginTop: -4,
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.625rem',
    marginTop: '0.25rem',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-secondary)',
    fontSize: 13,
    fontFamily: 'inherit',
    padding: '0.45rem 0.875rem',
    cursor: 'pointer',
  },
  submitBtn: {
    backgroundColor: 'var(--color-gold)',
    border: 'none',
    borderRadius: 8,
    color: '#080c18',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    padding: '0.45rem 1rem',
    cursor: 'pointer',
  },
  deleteBtn: {
    backgroundColor: 'var(--color-expense)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    padding: '0.45rem 1rem',
    cursor: 'pointer',
  },
  confirmText: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    lineHeight: 1.5,
  },
}
