import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { envelopeService } from '../services/envelopeService'

const GROQ_MODELS = [
  { id: 'qwen/qwen3-32b', label: 'Qwen3 32B (Default)' },
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
  { id: 'llama3-8b-8192', label: 'Llama 3 8B (Fast)' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
]

export default function Settings() {
  const { user } = useAuth()

  // Theme
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')

  // Profile
  const [name, setName] = useState(user?.name || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  // Password
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')

  // AI model (stored in localStorage, sent per-request ideally, but here just persisted locally)
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('plutus_groq_model') || 'qwen/qwen3-32b')

  // Envelope Budgeting
  const [envelopes, setEnvelopes] = useState([])
  const [envCategories, setEnvCategories] = useState([])
  const [envAccounts, setEnvAccounts] = useState([])
  const [envCards, setEnvCards] = useState([])
  const [envLoading, setEnvLoading] = useState(true)
  const [envSaving, setEnvSaving] = useState({}) // { [category_id]: bool }
  const [envMsg, setEnvMsg] = useState({})        // { [category_id]: string }
  // Local draft state for dropdowns (before saving)
  const [envDraft, setEnvDraft] = useState({})    // { [category_id]: { type: 'account'|'card', id: string } }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    if (next === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    localStorage.setItem('plutus_theme', next)
  }

  useEffect(() => {
    const saved = localStorage.getItem('plutus_theme')
    if (saved) {
      setTheme(saved)
      if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light')
      else document.documentElement.removeAttribute('data-theme')
    }
  }, [])

  useEffect(() => {
    async function loadEnvelopes() {
      setEnvLoading(true)
      try {
        const [envRes, catRes, accRes, ccRes] = await Promise.allSettled([
          api.get('/api/envelopes'),
          api.get('/api/categories'),
          api.get('/api/accounts'),
          api.get('/api/credit-cards'),
        ])
        const envData = envRes.status === 'fulfilled' ? envRes.value.data : []
        const catData = catRes.status === 'fulfilled' ? catRes.value.data : []
        const accData = accRes.status === 'fulfilled' ? accRes.value.data : []
        const ccData = ccRes.status === 'fulfilled' ? ccRes.value.data : []

        setEnvelopes(envData)
        // Only show expense categories (these are the ones you assign accounts to)
        setEnvCategories(catData.filter(c => c.type === 'expense' && !c.parent_id))
        setEnvAccounts(accData)
        setEnvCards(ccData)

        // Initialize draft from current envelopes
        const draft = {}
        envData.forEach(e => {
          if (e.account_id) draft[e.category_id] = { type: 'account', id: e.account_id }
          else if (e.credit_card_id) draft[e.category_id] = { type: 'card', id: e.credit_card_id }
        })
        setEnvDraft(draft)
      } finally {
        setEnvLoading(false)
      }
    }
    loadEnvelopes()
  }, [])

  async function saveProfile(e) {
    e.preventDefault()
    if (!name.trim()) return
    setProfileSaving(true)
    setProfileMsg('')
    try {
      await api.put('/api/auth/me', { name: name.trim() })
      setProfileMsg('Profile updated.')
    } catch (err) {
      setProfileMsg(err.response?.data?.detail || 'Failed to update profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    if (!currentPwd || !newPwd) return
    if (newPwd.length < 8) { setPwdMsg('New password must be at least 8 characters.'); return }
    setPwdSaving(true)
    setPwdMsg('')
    try {
      await api.put('/api/auth/me', { current_password: currentPwd, new_password: newPwd })
      setPwdMsg('Password changed successfully.')
      setCurrentPwd('')
      setNewPwd('')
    } catch (err) {
      setPwdMsg(err.response?.data?.detail || 'Failed to change password.')
    } finally {
      setPwdSaving(false)
    }
  }

  function saveAiModel(model) {
    setAiModel(model)
    localStorage.setItem('plutus_groq_model', model)
  }

  async function saveEnvelope(categoryId) {
    const draft = envDraft[categoryId]
    if (!draft) return
    setEnvSaving(s => ({ ...s, [categoryId]: true }))
    try {
      const payload = { category_id: categoryId }
      if (draft.type === 'account') payload.account_id = draft.id
      else payload.credit_card_id = draft.id
      await envelopeService.upsert(payload)
      setEnvMsg(m => ({ ...m, [categoryId]: 'Saved.' }))
      setTimeout(() => setEnvMsg(m => ({ ...m, [categoryId]: '' })), 2000)
    } catch {
      setEnvMsg(m => ({ ...m, [categoryId]: 'Failed to save.' }))
    } finally {
      setEnvSaving(s => ({ ...s, [categoryId]: false }))
    }
  }

  async function removeEnvelope(categoryId) {
    try {
      await envelopeService.remove(categoryId)
      setEnvDraft(d => { const n = { ...d }; delete n[categoryId]; return n })
      setEnvMsg(m => ({ ...m, [categoryId]: 'Removed.' }))
      setTimeout(() => setEnvMsg(m => ({ ...m, [categoryId]: '' })), 2000)
    } catch {
      setEnvMsg(m => ({ ...m, [categoryId]: 'Failed to remove.' }))
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Settings</h1>

      {/* Theme */}
      <Section title="Appearance">
        <div style={styles.row}>
          <div>
            <p style={styles.rowLabel}>Theme</p>
            <p style={styles.rowSub}>Currently: {theme === 'dark' ? 'Midnight Navy (dark)' : 'Warm Parchment (light)'}</p>
          </div>
          <button onClick={toggleTheme} style={styles.toggleBtn}>
            {theme === 'dark' ? '☀️ Switch to Light' : '🌙 Switch to Dark'}
          </button>
        </div>
      </Section>

      {/* Profile */}
      <Section title="Profile">
        <form onSubmit={saveProfile}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Display Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={styles.input}
              placeholder="Your name"
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email</label>
            <input value={user?.email || ''} disabled style={{ ...styles.input, opacity: 0.5 }} />
          </div>
          {profileMsg && (
            <p style={{ fontSize: 13, color: profileMsg.includes('updated') ? 'var(--color-income)' : 'var(--color-expense)', marginBottom: 8 }}>
              {profileMsg}
            </p>
          )}
          <button type="submit" disabled={profileSaving} style={styles.saveBtn}>
            {profileSaving ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      </Section>

      {/* Password */}
      <Section title="Change Password">
        <form onSubmit={changePassword}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Current Password</label>
            <input
              type="password"
              value={currentPwd}
              onChange={e => setCurrentPwd(e.target.value)}
              style={styles.input}
              placeholder="Current password"
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>New Password</label>
            <input
              type="password"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              style={styles.input}
              placeholder="Min 8 characters"
            />
          </div>
          {pwdMsg && (
            <p style={{ fontSize: 13, color: pwdMsg.includes('success') ? 'var(--color-income)' : 'var(--color-expense)', marginBottom: 8 }}>
              {pwdMsg}
            </p>
          )}
          <button type="submit" disabled={pwdSaving} style={styles.saveBtn}>
            {pwdSaving ? 'Saving…' : 'Change Password'}
          </button>
        </form>
      </Section>

      {/* AI Model */}
      <Section title="Plutus AI Model">
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          Select the Groq model used for Plutus AI conversations.
          The model is set server-side; this preference is saved locally for reference.
        </p>
        <div style={styles.modelList}>
          {GROQ_MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => saveAiModel(m.id)}
              style={{
                ...styles.modelOption,
                borderColor: aiModel === m.id ? 'var(--color-gold)' : 'var(--color-border)',
                color: aiModel === m.id ? 'var(--color-gold)' : 'var(--color-text-secondary)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Envelope Budgeting */}
      <Section title="Envelope Budgeting">
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Assign a default account or card to each expense category.
          Plutus will suggest this when you log a transaction.
        </p>
        {envLoading ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : envCategories.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No expense categories found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {envCategories.map(cat => {
              const draft = envDraft[cat.id]
              const msg = envMsg[cat.id]
              const saving = envSaving[cat.id]
              return (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary)', minWidth: 140 }}>
                    {cat.name}
                  </span>
                  <select
                    value={draft ? `${draft.type}:${draft.id}` : ''}
                    onChange={e => {
                      const val = e.target.value
                      if (!val) {
                        setEnvDraft(d => { const n = { ...d }; delete n[cat.id]; return n })
                      } else {
                        const [type, id] = val.split(':')
                        setEnvDraft(d => ({ ...d, [cat.id]: { type, id } }))
                      }
                    }}
                    style={{ ...styles.input, flex: 1, minWidth: 160, padding: '0.4rem 0.6rem' }}
                  >
                    <option value="">— None —</option>
                    {envAccounts.length > 0 && (
                      <optgroup label="Bank Accounts">
                        {envAccounts.map(a => (
                          <option key={a.id} value={`account:${a.id}`}>{a.name} ({a.bank_name})</option>
                        ))}
                      </optgroup>
                    )}
                    {envCards.length > 0 && (
                      <optgroup label="Credit Cards">
                        {envCards.map(c => (
                          <option key={c.id} value={`card:${c.id}`}>{c.name} ({c.bank_name})</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button
                    onClick={() => saveEnvelope(cat.id)}
                    disabled={saving || !draft}
                    style={{ ...styles.saveBtn, padding: '0.4rem 0.75rem', fontSize: 12 }}
                  >
                    {saving ? '…' : 'Save'}
                  </button>
                  {draft && (
                    <button
                      onClick={() => removeEnvelope(cat.id)}
                      style={{ ...styles.dangerBtn, padding: '0.4rem 0.75rem', fontSize: 12 }}
                    >
                      Remove
                    </button>
                  )}
                  {msg && (
                    <span style={{ fontSize: 12, color: msg === 'Saved.' || msg === 'Removed.' ? 'var(--color-income)' : 'var(--color-expense)' }}>
                      {msg}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* Danger zone */}
      <Section title="Sessions">
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          Sign out all other devices by revoking all active sessions.
        </p>
        <button
          onClick={async () => {
            if (!window.confirm('This will sign you out of all other devices. Continue?')) return
            try {
              await api.delete('/api/auth/sessions')
              alert('All other sessions revoked.')
            } catch {
              alert('Failed to revoke sessions.')
            }
          }}
          style={styles.dangerBtn}
        >
          Revoke All Sessions
        </button>
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.sectionBody}>{children}</div>
    </section>
  )
}

const styles = {
  page: { minHeight: '100dvh', backgroundColor: 'var(--color-base)', padding: '1.5rem', maxWidth: 680, margin: '0 auto' },
  pageTitle: { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 400, color: 'var(--color-text-primary)', marginBottom: '2rem' },
  section: { marginBottom: '2rem' },
  sectionTitle: { fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' },
  sectionBody: { backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1.25rem' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' },
  rowSub: { fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 },
  toggleBtn: { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: 8, padding: '0.45rem 1rem', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  fieldGroup: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4, fontWeight: 500 },
  input: { width: '100%', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.625rem 0.875rem', fontSize: 14, color: 'var(--color-text-primary)', fontFamily: 'inherit', boxSizing: 'border-box' },
  saveBtn: { backgroundColor: 'var(--color-gold)', border: 'none', color: '#080c18', borderRadius: 8, padding: '0.5rem 1.25rem', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  dangerBtn: { backgroundColor: 'transparent', border: '1px solid var(--color-expense)', color: 'var(--color-expense)', borderRadius: 8, padding: '0.5rem 1.25rem', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  modelList: { display: 'flex', flexDirection: 'column', gap: 8 },
  modelOption: { background: 'none', borderWidth: 1, borderStyle: 'solid', borderRadius: 8, padding: '0.625rem 1rem', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'border-color 0.15s, color 0.15s' },
}
