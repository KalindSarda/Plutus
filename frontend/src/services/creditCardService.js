import api from './api'

export const creditCardService = {
  async list() {
    const { data } = await api.get('/api/credit-cards')
    return data
  },

  async create(data) {
    const { data: created } = await api.post('/api/credit-cards', data)
    return created
  },

  async update(id, data) {
    const { data: updated } = await api.put(`/api/credit-cards/${id}`, data)
    return updated
  },

  async delete(id) {
    await api.delete(`/api/credit-cards/${id}`)
  },

  async currentCycle(id) {
    const { data } = await api.get(`/api/credit-cards/${id}/current-cycle`)
    return data
  },

  async statements(id) {
    const { data } = await api.get(`/api/credit-cards/${id}/statements`)
    return data
  },

  async payStatement(cardId, stmtId, paidAmount) {
    const { data } = await api.post(
      `/api/credit-cards/${cardId}/statements/${stmtId}/pay`,
      { paid_amount: paidAmount }
    )
    return data
  },
}
