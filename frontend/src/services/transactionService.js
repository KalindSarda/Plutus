import api from './api'

export const transactionService = {
  async list(skip = 0, limit = 50) {
    const { data } = await api.get('/api/transactions', { params: { skip, limit } })
    return data
  },

  async create(data) {
    const { data: created } = await api.post('/api/transactions', data)
    return created
  },

  async update(id, data) {
    const { data: updated } = await api.put(`/api/transactions/${id}`, data)
    return updated
  },

  async delete(id) {
    await api.delete(`/api/transactions/${id}`)
  },
}
