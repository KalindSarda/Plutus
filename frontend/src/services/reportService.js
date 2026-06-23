import api from './api'

export const reportService = {
  async summary(year, month) {
    const { data } = await api.get('/api/reports/summary', { params: { year, month } })
    return data
  },

  async categories(year, month) {
    const { data } = await api.get('/api/reports/categories', { params: { year, month } })
    return data
  },

  async trends(months = 6) {
    const { data } = await api.get('/api/reports/trends', { params: { months } })
    return data
  },

  async netWorth() {
    const { data } = await api.get('/api/reports/net-worth')
    return data
  },

  async projection() {
    const { data } = await api.get('/api/reports/projection')
    return data
  },

  async exportTransactions() {
    const response = await api.get('/api/reports/export', { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'plutus_transactions.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },
}
