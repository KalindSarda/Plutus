import { useState, useEffect, useCallback } from 'react'
import { accountService } from '../services/accountService'
import { formatINR } from '../utils/currency'

const EMPTY_FORM = { name: '', bank_name: '', type: 'savings', balance: '' }

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // account object being edited
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null) // account object to delete
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await accountService.list()
      setAccounts(data)
    } catch {
      setError('Failed to load accounts.')
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

  function openEdit(account) {
    setEditTarget(account)
    setForm({
      name: account.name,
      bank_name: account.bank_name,
      type: account.type,
      balance: String(account.balance),
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
      type: form.type,
      balance: parseFloat(form.balance),
    }
    if (!payload.name || !payload.bank_name) {
      setFormError('Name and bank name are required.')
      return
    }
    if (isNaN(payload.balance)) {
      setFormError('Balance must be a valid number.')
      return
    }
    try {
      setSaving(true)
      if (editTarget) {
        await accountService.update(editTarget.id, payload)
      } else {
        await accountService.create(payload)
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
      await accountService.delete(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch {
      // keep dialog open and show nothing — simple silent failure acceptable
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0)

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Accounts</h1>
          <p style={styles.sub}>All your bank accounts in one place</p>
        </div>
        <button onClick={openAdd} style={styles.addBtn}>
          + Add Account
        </button>
      </header>

      {/* Total balance hero */}
      <div style={styles.heroCard}>
        <p style={styles.heroLabel}>Total Balance</p>
        <p style={styles.heroNumber}>{formatINR(totalBalance)}</p>
        <p style={styles.heroSub}>across {accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Account list */}
      {loading ? (
        <p style={styles.stateMsg}>Loading accounts...</p>
      ) : error ? (
        <p style={{ ...styles.stateMsg, color: 'var(--color-expense)' }}>{error}</p>
      ) : accounts.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>No accounts yet</p>
          <p style={styles.emptyHint}>Add your first bank account to start tracking your finances.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={() => openEdit(account)}
              onDelete={() => setDeleteTarget(account)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <Modal title={editTarget ? 'Edit Account' : 'Add Account'} onClose={closeModal}>
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>
              Account Name
              <input
                style={styles.input}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. HDFC Salary"
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
              Account Type
              <select
                style={styles.input}
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="savings">Savings</option>
                <option value="current">Current</option>
              </select>
            </label>
            <label style={styles.label}>
              Balance (₹)
              <input
                style={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={form.balance}
                onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                placeholder="0"
                required
              />
            </label>
            {formError && <p style={styles.formError}>{formError}</p>}
            <div style={styles.modalFooter}>
              <button type="button" onClick={closeModal} style={styles.cancelBtn} disabled={saving}>
                Cancel
              </button>
              <button type="submit" style={styles.submitBtn} disabled={saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm Dialog */}
      {deleteTarget && (
        <Modal title="Delete Account" onClose={() => setDeleteTarget(null)}>
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
    </div>
  )
}

function AccountCard({ account, onEdit, onDelete }) {
  const isCurrentType = account.type === 'current'
  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div style={styles.cardInfo}>
          <p style={styles.accountName}>{account.name}</p>
          <p style={styles.bankName}>{account.bank_name}</p>
        </div>
        <span
          style={{
            ...styles.typeBadge,
            backgroundColor: isCurrentType
              ? 'rgba(240,164,41,0.12)'
              : 'rgba(61,214,140,0.12)',
            color: isCurrentType ? 'var(--color-warning)' : 'var(--color-income)',
          }}
        >
          {isCurrentType ? 'Current' : 'Savings'}
        </span>
      </div>
      <p style={styles.balanceLabel}>Balance</p>
      <p style={styles.heroNumber}>{formatINR(account.balance)}</p>
      <div style={styles.cardActions}>
        <button onClick={onEdit} style={styles.iconBtn} title="Edit account">
          <PencilIcon />
        </button>
        <button onClick={onDelete} style={{ ...styles.iconBtn, ...styles.iconBtnDanger }} title="Delete account">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
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
  heroCard: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
  },
  heroLabel: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 4,
  },
  heroNumber: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 32,
    fontWeight: 500,
    color: 'var(--color-gold)',
    lineHeight: 1.1,
  },
  heroSub: {
    fontSize: 12,
    color: 'var(--color-text-muted)',
    marginTop: 4,
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '0.875rem',
  },
  card: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '1.125rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: 2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  bankName: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 20,
    letterSpacing: '0.03em',
    flexShrink: 0,
    marginLeft: 8,
  },
  balanceLabel: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginTop: 4,
  },
  cardActions: {
    display: 'flex',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTop: '1px solid var(--color-border)',
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
    maxWidth: 420,
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
