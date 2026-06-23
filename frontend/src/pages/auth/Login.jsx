import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
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
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo / brand */}
        <div style={styles.brand}>
          <p style={styles.brandTitle}>Plutus</p>
          <p style={styles.brandTagline}>Your wealth, understood.</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
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
              autoComplete="current-password"
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={styles.footer}>
          Don't have an account?{' '}
          <Link to="/register" style={styles.link}>
            Create one
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
    fontStyle: 'italic',
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
    transition: 'background-color 0.15s',
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
