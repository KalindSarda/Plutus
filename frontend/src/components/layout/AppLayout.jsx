import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import PlutusChat from '../plutus-chat/PlutusChat'

const NAV_ITEMS = [
  { label: 'Dashboard',    path: '/',             icon: '🏠' },
  { label: 'Transactions', path: '/transactions', icon: '💳' },
  { label: 'Accounts',     path: '/accounts',     icon: '🏦' },
  { label: 'Credit Cards', path: '/credit-cards', icon: '💴' },
  { label: 'Budgets',      path: '/budgets',      icon: '🎯' },
  { label: 'Recurring',    path: '/recurring',    icon: '🔁' },
  { label: 'Categories',   path: '/categories',   icon: '🗂️' },
  { label: 'Reports',      path: '/reports',      icon: '📊' },
  { label: 'Import',       path: '/import',       icon: '📥' },
  { label: 'Settings',     path: '/settings',     icon: '⚙️' },
]

// Bottom nav shows the 5 most-used items on mobile
const MOBILE_NAV = [
  { label: 'Home',     path: '/',             icon: '🏠' },
  { label: 'Txns',     path: '/transactions', icon: '💳' },
  { label: 'Reports',  path: '/reports',      icon: '📊' },
  { label: 'Budgets',  path: '/budgets',      icon: '🎯' },
  { label: 'Settings', path: '/settings',     icon: '⚙️' },
]

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    function handle() { setWidth(window.innerWidth) }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])
  return width
}

export default function AppLayout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const width = useWindowWidth()
  const isMobile = width <= 768

  function isActive(path) {
    return path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  }

  if (isMobile) {
    return (
      <div style={styles.mobileWrapper}>
        <div style={styles.mobileContent}>
          {children}
        </div>
        <nav style={styles.bottomBar}>
          {MOBILE_NAV.map(({ label, path, icon }) => (
            <Link
              key={path}
              to={path}
              style={{
                ...styles.bottomNavItem,
                color: isActive(path) ? 'var(--color-gold)' : 'var(--color-text-muted)',
              }}
            >
              <span style={styles.bottomNavIcon}>{icon}</span>
              <span style={styles.bottomNavLabel}>{label}</span>
            </Link>
          ))}
        </nav>
        <PlutusChat />
      </div>
    )
  }

  return (
    <div style={styles.desktopWrapper}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarTop}>
          <div style={styles.brand}>
            <span style={styles.brandName}>Plutus</span>
            <span style={styles.brandTagline}>Your wealth, understood.</span>
          </div>
          <nav style={styles.sidebarNav}>
            {NAV_ITEMS.map(({ label, path, icon }) => (
              <Link
                key={path}
                to={path}
                style={{
                  ...styles.sidebarNavItem,
                  borderLeft: isActive(path)
                    ? '3px solid var(--color-gold)'
                    : '3px solid transparent',
                  color: isActive(path) ? 'var(--color-gold)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive(path) ? 'rgba(200,168,75,0.06)' : 'transparent',
                }}
              >
                <span style={styles.sidebarNavIcon}>{icon}</span>
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div style={styles.sidebarBottom}>
          <div style={styles.userInfo}>
            <span style={styles.userName}>{user?.name || 'User'}</span>
            <span style={styles.userEmail}>{user?.email || ''}</span>
          </div>
          <button onClick={logout} style={styles.signOutBtn}>Sign out</button>
        </div>
      </aside>
      <main style={styles.desktopContent}>
        {children}
      </main>
      <PlutusChat />
    </div>
  )
}

const styles = {
  desktopWrapper: { display: 'flex', minHeight: '100dvh' },
  sidebar: {
    position: 'fixed',
    top: 0, left: 0, bottom: 0,
    width: 220,
    backgroundColor: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    zIndex: 100,
    overflowY: 'auto',
  },
  sidebarTop: { display: 'flex', flexDirection: 'column' },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem 1.25rem 1.25rem',
    borderBottom: '1px solid var(--color-border)',
  },
  brandName: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 24, fontWeight: 500,
    color: 'var(--color-gold)',
    lineHeight: 1.2,
  },
  brandTagline: { fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 },
  sidebarNav: { display: 'flex', flexDirection: 'column', padding: '0.5rem 0' },
  sidebarNavItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '0.55rem 1.25rem',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 400,
    transition: 'color 0.15s, background-color 0.15s',
  },
  sidebarNavIcon: { fontSize: 15, lineHeight: 1 },
  sidebarBottom: {
    padding: '1rem 1.25rem',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  userInfo: { display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' },
  userName: { fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userEmail: { fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  signOutBtn: { backgroundColor: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-secondary)', fontSize: 12, padding: '0.375rem 0.75rem', cursor: 'pointer', textAlign: 'left' },
  desktopContent: { marginLeft: 220, minHeight: '100dvh', backgroundColor: 'var(--color-base)', padding: '1.5rem', flex: 1 },

  mobileWrapper: { display: 'flex', flexDirection: 'column', minHeight: '100dvh' },
  mobileContent: { flex: 1, backgroundColor: 'var(--color-base)', padding: '1rem', paddingBottom: 72 },
  bottomBar: {
    position: 'fixed',
    bottom: 0, left: 0, right: 0,
    height: 60,
    backgroundColor: 'var(--color-surface)',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 100,
  },
  bottomNavItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    textDecoration: 'none',
    flex: 1,
    height: '100%',
  },
  bottomNavIcon: { fontSize: 20, lineHeight: 1 },
  bottomNavLabel: { fontSize: 10, lineHeight: 1 },
}
