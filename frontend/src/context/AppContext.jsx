import { createContext, useContext, useState } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [theme, setTheme] = useState('dark')
  const [refreshKey, setRefreshKey] = useState(0)

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next === 'light' ? 'light' : '')
  }

  function bumpRefreshKey() {
    setRefreshKey(k => k + 1)
  }

  return (
    <AppContext.Provider value={{ theme, toggleTheme, refreshKey, bumpRefreshKey }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
