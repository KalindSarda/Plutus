import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', inviteCode: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register(form.name, form.email, form.password, form.inviteCode)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <p style={styles.brandTitle}>Plutus</p>
          <p style={styles.brandTagline}>Create your account</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              autoComplete="name"
              style={styles.input}
              placeholder="Your name"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
              style={styles.input}
              placeholder="you@example.com"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              style={styles.input}
              placeholder="Min 8 chars, at least 1 digit"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Invite Code</label>
            <input
              type="text"
              name="inviteCode"
              value={form.inviteCode}
              onChange={handleChange}
              required
              style={styles.input}
              placeholder="Enter invite code"
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-base)',
    padding: '1.5rem',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 16,
    padding: '2rem',
  },
  brand: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  brandTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 28,
    fontWeight: 500,
    color: 'var(--color-gold)',
    marginBottom: 4,
  },
  brandTagline: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  },
  input: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    color: 'var(--color-text-primary)',
    fontSize: 15,
    padding: '0.625rem 0.875rem',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
    minHeight: 44,
  },
  error: {
    fontSize: 13,
    color: 'var(--color-expense)',
    padding: '0.5rem 0.75rem',
    backgroundColor: 'rgba(242,109,109,0.1)',
    borderRadius: 6,
    border: '1px solid rgba(242,109,109,0.2)',
  },
  button: {
    backgroundColor: 'var(--color-gold)',
    color: '#080c18',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 500,
    padding: '0.75rem',
    cursor: 'pointer',
    minHeight: 44,
    fontFamily: 'inherit',
    marginTop: 4,
  },
  footer: {
    marginTop: '1.5rem',
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  link: {
    color: 'var(--color-gold)',
    textDecoration: 'none',
    fontWeight: 500,
  },
}
