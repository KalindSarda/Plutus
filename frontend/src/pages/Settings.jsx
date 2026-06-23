import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

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
