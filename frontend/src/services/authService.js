import api from './api'

export const authService = {
  async register(name, email, password, inviteCode) {
    const { data } = await api.post('/api/auth/register', {
      name,
      email,
      password,
      invite_code: inviteCode,
    })
    return data
  },

  async login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password })
    return data  // { access_token, token_type }
  },

  async refresh() {
    const { data } = await api.post('/api/auth/refresh')
    return data
  },

  async logout() {
    await api.post('/api/auth/logout')
  },

  async me(token) {
    const { data } = await api.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return data
  },

  async updateMe(payload) {
    const { data } = await api.put('/api/auth/me', payload)
    return data
  },

  async deleteAllSessions() {
    await api.delete('/api/auth/sessions')
  },
}
