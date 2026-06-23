import { useState, useRef, useEffect } from 'react'
import { aiService } from '../../services/aiService'

export default function PlutusChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I\'m Plutus, your financial companion. Ask me about your spending, budgets, or account balances.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const response = await aiService.chat(text)
      setMessages(prev => [...prev, { role: 'assistant', text: response }])
    } catch (err) {
      const detail = err.response?.data?.detail || 'Something went wrong. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', text: `⚠️ ${detail}`, error: true }])
    } finally {
      setLoading(false)
    }
  }

  async function handleClose() {
    setOpen(false)
  }

  async function handleClear() {
    await aiService.clearSession()
    setMessages([
      { role: 'assistant', text: 'Session cleared. How can I help you?' }
    ])
  }

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={styles.fab}
          aria-label="Open Plutus AI"
          title="Chat with Plutus AI"
        >
          <span style={styles.fabIcon}>✦</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div style={styles.panel}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <span style={styles.avatar}>✦</span>
              <div>
                <p style={styles.title}>Plutus AI</p>
                <p style={styles.subtitle}>Your financial companion</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={handleClear} style={styles.headerBtn} title="Clear conversation">
                ↺
              </button>
              <button onClick={handleClose} style={styles.headerBtn} title="Close">
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={styles.messages}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                {msg.role === 'assistant' && (
                  <span style={styles.assistantAvatar}>✦</span>
                )}
                <div
                  style={{
                    ...styles.bubble,
                    ...(msg.role === 'user' ? styles.userBubble : styles.assistantBubble),
                    ...(msg.error ? { borderColor: 'var(--color-expense)', color: 'var(--color-expense)' } : {}),
                  }}
                >
                  <MessageText text={msg.text} />
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                <span style={styles.assistantAvatar}>✦</span>
                <div className="plutus-typing" style={{ display: 'inline-flex', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} style={styles.inputArea}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your finances…"
              style={styles.input}
              disabled={loading}
              maxLength={2000}
            />
            <button type="submit" disabled={loading || !input.trim()} style={styles.sendBtn} aria-label="Send">
              ➤
            </button>
          </form>
        </div>
      )}

      <style>{typingCSS}</style>
    </>
  )
}

function MessageText({ text }) {
  // Preserve newlines
  return (
    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</span>
  )
}

const typingCSS = `
@keyframes plutus-blink {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
.plutus-typing span {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-gold);
  margin: 0 2px;
  animation: plutus-blink 1.2s infinite ease-in-out;
}
.plutus-typing span:nth-child(2) { animation-delay: 0.2s; }
.plutus-typing span:nth-child(3) { animation-delay: 0.4s; }
`

const styles = {
  fab: {
    position: 'fixed',
    bottom: 80,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: '50%',
    backgroundColor: 'var(--color-gold)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
    zIndex: 150,
    transition: 'transform 0.15s',
  },
  fabIcon: {
    fontSize: 22,
    color: '#080c18',
    fontWeight: 700,
    lineHeight: 1,
  },
  panel: {
    position: 'fixed',
    bottom: 0,
    right: 0,
    width: '100%',
    maxWidth: 420,
    height: '70dvh',
    maxHeight: 600,
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 150,
    boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.875rem 1rem',
    borderBottom: '1px solid var(--color-border)',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: 'var(--color-gold)',
    color: '#080c18',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
  },
  title: { fontSize: 14, fontWeight: 600, color: 'var(--color-gold)', lineHeight: 1.2 },
  subtitle: { fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.2 },
  headerBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    fontSize: 16,
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: 6,
    lineHeight: 1,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
  },
  assistantAvatar: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    backgroundColor: 'rgba(200, 168, 75, 0.15)',
    color: 'var(--color-gold)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
    marginRight: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  bubble: {
    maxWidth: '78%',
    padding: '0.625rem 0.875rem',
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 1.55,
  },
  userBubble: {
    backgroundColor: 'rgba(200, 168, 75, 0.12)',
    border: '1px solid var(--color-gold-muted)',
    color: 'var(--color-text-primary)',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    borderBottomLeftRadius: 4,
  },
  inputArea: {
    display: 'flex',
    gap: 8,
    padding: '0.75rem 1rem',
    borderTop: '1px solid var(--color-border)',
    flexShrink: 0,
    paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
  },
  input: {
    flex: 1,
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '0.625rem 0.875rem',
    fontSize: 13,
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit',
    outline: 'none',
  },
  sendBtn: {
    backgroundColor: 'var(--color-gold)',
    border: 'none',
    borderRadius: 8,
    width: 36,
    height: 36,
    cursor: 'pointer',
    fontSize: 14,
    color: '#080c18',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    opacity: 1,
  },
}
