import api from './api'

let _sessionId = null

function getSessionId() {
  if (!_sessionId) _sessionId = crypto.randomUUID()
  return _sessionId
}

export const aiService = {
  getSessionId,

  async greet() {
    const sessionId = getSessionId()
    const { data } = await api.get('/api/ai/greet', { params: { session_id: sessionId } })
    return data  // { response, session_id }
  },

  async chat(message) {
    const sessionId = getSessionId()
    const { data } = await api.post('/api/ai/chat', { message, session_id: sessionId })
    return data  // { response, action } — caller extracts .response and .action
  },

  async undo(sessionId) {
    const { data } = await api.post(`/api/ai/undo/${sessionId}`)
    return data
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
