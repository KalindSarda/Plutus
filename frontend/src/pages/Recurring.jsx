import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { categoryService } from '../services/categoryService'
import { formatINR } from '../utils/currency'

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly']
const EMPTY_FORM = {
  name: '',
  type: 'expense',
  amount: '',
  category_id: '',
  account_id: '',
  credit_card_id: '',
  frequency: 'monthly',
  next_due_date: new Date().toISOString().slice(0, 10),
}

export default function Recurring() {
  const [templates, setTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [accounts, setAccounts] = useState([])
  const [creditCards, setCreditCards] = useState([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [applyingId, setApplyingId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tmplRes, cats, accs, ccs] = await Promise.all([
        api.get('/api/recurring').then(r => r.data),
        categoryService.list(),
        api.get('/api/accounts').then(r => r.data).catch(() => []),
        api.get('/api/credit-cards').then(r => r.data).catch(() => []),
      ])
      setTemplates(Array.isArray(tmplRes) ? tmplRes : [])
      setCategories(cats)
      setAccounts(Array.isArray(accs) ? accs : [])
      setCreditCards(Array.isArray(ccs) ? ccs : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  function openEdit(tmpl) {
    setEditingId(tmpl.id)
    setForm({
      name: tmpl.name,
      type: tmpl.type,
      amount: String(tmpl.amount),
      category_id: tmpl.category_id || '',
      account_id: tmpl.account_id || '',
      credit_card_id: tmpl.credit_card_id || '',
      frequency: tmpl.frequency,
      next_due_date: tmpl.next_due_date,
    })
    setFormError('')
    setShowModal(true)
  }

  function closeModal() { setShowModal(false); setEditingId(null) }

  function f(field) { return e => setForm(prev => ({ ...prev, [field]: e.target.value })) }

  async function handleSave(e) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.name.trim()) { setFormError('Name is required.'); return }
    if (isNaN(amount) || amount <= 0) { setFormError('Amount must be a positive number.'); return }
    if (!form.category_id) { setFormError('Category is required.'); return }

    setSaving(true)
    setFormError('')
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        amount,
        category_id: form.category_id,
        account_id: form.account_id || null,
        credit_card_id: form.credit_card_id || null,
        frequency: form.frequency,
        next_due_date: form.next_due_date,
      }
      if (editingId) {
        await api.put(`/api/recurring/${editingId}`, payload)
      } else {
        await api.post('/api/recurring', payload)
      }
      closeModal()
      load()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleApply(id) {
    setApplyingId(id)
    try {
      await api.post(`/api/recurring/${id}/apply`)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Apply failed.')
    } finally {
      setApplyingId(null)
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/api/recurring/${id}`)
      setDeleteConfirmId(null)
      load()
    } catch {
      alert('Delete failed.')
    }
  }

  const expenseCats = categories.filter(c => !c.parent_id && c.type === 'expense')
  const incomeCats = categories.filter(c => !c.parent_id && c.type === 'income')
  const filteredCats = form.type === 'expense' ? expenseCats : incomeCats

  function getCatName(id) { return categories.find(c => c.id === id)?.name || '—' }

  const dueWithin3Days = (dateStr) => {
    const due = new Date(dateStr)
    const today = new Date()
    const diff = (due - today) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 3
  }

  if (loading) return <div style={styles.loadingBox}>Loading…</div>

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>Recurring Templates</h1>
        <button onClick={openAdd} style={styles.addBtn}>+ Add Template</button>
      </div>

      {templates.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🔁</p>
          <p style={{ fontSize: 15, color: 'var(--color-text-primary)' }}>No recurring templates yet</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Save templates for regular income or expenses and apply them with one tap.
          </p>
          <button onClick={openAdd} style={{ ...styles.addBtn, marginTop: 16 }}>Create first template</button>
        </div>
      ) : (
        <div style={styles.list}>
          {templates.map(tmpl => (
            <div key={tmpl.id} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={{ flex: 1 }}>
                  <p style={styles.templateName}>{tmpl.name}</p>
                  <p style={styles.templateMeta}>
                    {getCatName(tmpl.category_id)} · {tmpl.frequency}
                    {dueWithin3Days(tmpl.next_due_date) && (
                      <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}>⚡ Due soon</span>
                    )}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Next: {tmpl.next_due_date}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ ...styles.amount, color: tmpl.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)' }}>
                    {tmpl.type === 'income' ? '+' : '-'}{formatINR(tmpl.amount)}
                  </p>
                </div>
              </div>

              <div style={styles.cardActions}>
                <button
                  onClick={() => handleApply(tmpl.id)}
                  disabled={applyingId === tmpl.id}
                  style={styles.applyBtn}
                  title="Create transaction from template"
                >
                  {applyingId === tmpl.id ? 'Applying…' : '▶ Apply now'}
                </button>
                <button onClick={() => openEdit(tmpl)} style={styles.iconBtn} title="Edit">✏️</button>
                <button onClick={() => setDeleteConfirmId(tmpl.id)} style={{ ...styles.iconBtn, color: 'var(--color-expense)' }} title="Delete">🗑</button>
              </div>

              {deleteConfirmId === tmpl.id && (
                <div style={styles.deleteConfirm}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>Delete this template?</span>
                  <button onClick={() => handleDelete(tmpl.id)} style={{ ...styles.iconBtn, color: 'var(--color-expense)' }}>Yes, delete</button>
                  <button onClick={() => setDeleteConfirmId(null)} style={styles.iconBtn}>Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={styles.overlay} onClick={closeModal}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>{editingId ? 'Edit Template' : 'New Recurring Template'}</h2>

            <form onSubmit={handleSave}>
              <div style={styles.formGrid}>
                <Field label="Name">
                  <input value={form.name} onChange={f('name')} style={styles.input} placeholder="e.g. Monthly rent" />
                </Field>
                <Field label="Type">
                  <select value={form.type} onChange={f('type')} style={styles.input}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </Field>
                <Field label="Amount (₹)">
                  <input type="number" min="0.01" step="0.01" value={form.amount} onChange={f('amount')} style={styles.input} placeholder="0.00" />
                </Field>
                <Field label="Frequency">
                  <select value={form.frequency} onChange={f('frequency')} style={styles.input}>
                    {FREQUENCIES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                  </select>
                </Field>
                <Field label="Category">
                  <select value={form.category_id} onChange={f('category_id')} style={styles.input}>
                    <option value="">Select category</option>
                    {filteredCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </Field>
                <Field label="Next Due Date">
                  <input type="date" value={form.next_due_date} onChange={f('next_due_date')} style={styles.input} />
                </Field>
                <Field label="Account (optional)">
                  <select value={form.account_id} onChange={f('account_id')} style={styles.input}>
                    <option value="">None</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
                <Field label="Credit Card (optional)">
                  <select value={form.credit_card_id} onChange={f('credit_card_id')} style={styles.input}>
                    <option value="">None</option>
                    {creditCards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              </div>

              {formError && <p style={styles.formError}>{formError}</p>}

              <div style={styles.formActions}>
                <button type="button" onClick={closeModal} style={styles.cancelBtn}>Cancel</button>
                <button type="submit" disabled={saving} style={styles.saveBtn}>
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const styles = {
  page: { minHeight: '100dvh', backgroundColor: 'var(--color-base)', padding: '1.5rem', maxWidth: 800, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  pageTitle: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 400, color: 'var(--color-text-primary)' },
  addBtn: { backgroundColor: 'var(--color-gold)', border: 'none', color: '#080c18', borderRadius: 8, padding: '0.5rem 1.125rem', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  loadingBox: { textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' },
  emptyState: { textAlign: 'center', padding: '4rem 1rem' },
  list: { display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  card: { backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1.125rem' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' },
  templateName: { fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 3 },
  templateMeta: { fontSize: 12, color: 'var(--color-text-secondary)' },
  amount: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 500 },
  cardActions: { display: 'flex', gap: 8, alignItems: 'center' },
  applyBtn: { backgroundColor: 'transparent', border: '1px solid var(--color-gold)', color: 'var(--color-gold)', borderRadius: 6, padding: '0.35rem 0.75rem', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  iconBtn: { background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 13, cursor: 'pointer', padding: '0.35rem 0.5rem' },
  deleteConfirm: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)' },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' },
  modal: { backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 560, maxHeight: '90dvh', overflowY: 'auto' },
  modalTitle: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 400, color: 'var(--color-text-primary)', marginBottom: '1.25rem' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' },
  input: { width: '100%', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit', boxSizing: 'border-box' },
  formError: { color: 'var(--color-expense)', fontSize: 13, marginBottom: 12 },
  formActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  cancelBtn: { background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: 8, padding: '0.5rem 1rem', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  saveBtn: { backgroundColor: 'var(--color-gold)', border: 'none', color: '#080c18', borderRadius: 8, padding: '0.5rem 1.25rem', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
}
