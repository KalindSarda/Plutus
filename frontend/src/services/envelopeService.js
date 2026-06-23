import api from './api'

export const envelopeService = {
  async list() {
    const { data } = await api.get('/api/envelopes')
    return data
  },

  async upsert(payload) {
    // payload: { category_id, account_id?, credit_card_id? }
    const { data } = await api.post('/api/envelopes', payload)
    return data
  },

  async remove(categoryId) {
    await api.delete(`/api/envelopes/${categoryId}`)
  },
}
