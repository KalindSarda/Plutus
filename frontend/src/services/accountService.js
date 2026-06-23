import api from './api'

export const accountService = {
  async list() {
    const { data } = await api.get('/api/accounts')
    return data
  },

  async create(data) {
    const { data: created } = await api.post('/api/accounts', data)
    return created
  },

  async update(id, data) {
    const { data: updated } = await api.put(`/api/accounts/${id}`, data)
    return updated
  },

  async delete(id) {
    await api.delete(`/api/accounts/${id}`)
  },

  async summary(id) {
    const { data } = await api.get(`/api/accounts/${id}/summary`)
    return data
  },
}
