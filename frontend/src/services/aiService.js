import api from './api'

let _sessionId = null

function getSessionId() {
  if (!_sessionId) _sessionId = crypto.randomUUID()
  return _sessionId
}

export const aiService = {
  getSessionId,

  async chat(message) {
    const sessionId = getSessionId()
    const { data } = await api.post('/api/ai/chat', { message, session_id: sessionId })
    return data.response
  },

  async clearSession() {
    const sessionId = _sessionId
    if (!sessionId) return
    try {
      await api.delete(`/api/ai/session/${sessionId}`)
    } catch {
      // best-effort
    }
    _sessionId = null
  },
}
