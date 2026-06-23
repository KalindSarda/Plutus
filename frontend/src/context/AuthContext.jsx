import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { authService } from '../services/authService'
import { setTokenAccessors } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  const [loading, setLoading] = useState(true)
  // Expose setter so the Axios interceptor can update the token
  const tokenRef = useRef(null)

  useEffect(() => {
    tokenRef.current = accessToken
  }, [accessToken])

  // Wire up Axios interceptor so every request carries the current token
  useEffect(() => {
    setTokenAccessors(
      () => tokenRef.current,
      (token) => setAccessToken(token),
    )
  }, [])

  // On mount, try to restore session via refresh cookie
  useEffect(() => {
    refreshAuth().finally(() => setLoading(false))
  }, [])

  async function refreshAuth() {
    try {
      const { access_token } = await authService.refresh()
      setAccessToken(access_token)
      const me = await authService.me(access_token)
      setUser(me)
      return access_token
    } catch {
      setUser(null)
      setAccessToken(null)
      return null
    }
  }

  async function login(email, password) {
    const { access_token } = await authService.login(email, password)
    setAccessToken(access_token)
    const me = await authService.me(access_token)
    setUser(me)
    setLoading(false)
  }

  async function register(name, email, password, inviteCode) {
    await authService.register(name, email, password, inviteCode)
  }

  async function logout() {
    try {
      await authService.logout()
    } catch { /* swallow */ }
    setUser(null)
    setAccessToken(null)
    if ('caches' in window) {
      await caches.delete('api-cache')
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, accessToken, setAccessToken, loading, login, register, logout, refreshAuth, tokenRef }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
