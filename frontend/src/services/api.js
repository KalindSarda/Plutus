import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,  // send httpOnly refresh cookie automatically
})

// Will be set by AuthProvider after mount
let _getToken = () => null
let _setToken = () => {}
let _refreshing = null

export function setTokenAccessors(getToken, setToken) {
  _getToken = getToken
  _setToken = setToken
}

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = _getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401: refresh once, retry (skip retry for auth endpoints to avoid loops)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const isAuthEndpoint = original.url?.includes('/api/auth/')
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true
      try {
        if (!_refreshing) {
          _refreshing = api.post('/api/auth/refresh').finally(() => { _refreshing = null })
        }
        const { data } = await _refreshing
        _setToken(data.access_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch {
        _setToken(null)
        // Let the ProtectedRoute handle the redirect — avoid hard page reload
      }
    }
    return Promise.reject(error)
  }
)

export default api
