import api from './api'

export const budgetService = {
  async list(year, month) {
    const { data } = await api.get('/api/budgets', { params: { year, month } })
    return data
  },

  async create(data) {
    const { data: created } = await api.post('/api/budgets', data)
    return created
  },

  async update(id, data) {
    const { data: updated } = await api.put(`/api/budgets/${id}`, data)
    return updated
  },

  async delete(id) {
    await api.delete(`/api/budgets/${id}`)
  },
}
