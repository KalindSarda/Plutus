import api from './api'

export const categoryService = {
  async list() {
    const { data } = await api.get('/api/categories')
    return data
  },

  async create(data) {
    const { data: created } = await api.post('/api/categories', data)
    return created
  },

  async update(id, data) {
    const { data: updated } = await api.put(`/api/categories/${id}`, data)
    return updated
  },

  async delete(id) {
    await api.delete(`/api/categories/${id}`)
  },
}
