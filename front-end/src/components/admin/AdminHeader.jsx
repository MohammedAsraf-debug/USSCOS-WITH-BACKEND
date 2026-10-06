import { useEffect, useRef, useState } from 'react'
import { Menu, ChevronDown, ExternalLink, LogOut, Settings } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { doSignOut as logout } from '@/services/auth'

export default function AdminHeader({ onMenuClick, adminName, adminEmail }) {
  const [accountOpen, setAccountOpen] = useState(false)
  const navigate = useNavigate()

  const toggleAccount = (e) => {
    e.stopPropagation()
    setAccountOpen((o) => !o)
  }

  const accountRef = useRef(null)

  useEffect(() => {
    const handleOutside = (e) => {
      if (accountRef.current && accountRef.current.contains(e.target)) return
      setAccountOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [])

  const initials = (adminName || 'Admin User')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="admin-header">
      <div className="admin-header__left">
        <button className="admin-header__menu-btn" onClick={onMenuClick} aria-label="Open sidebar">
          <Menu size={22} />
        </button>
      </div>
      <div className="admin-header__right">
        <Link to="/" className="admin-header__icon-link" aria-label="View public website">
          <ExternalLink size={18} />
          <span className="admin-header__icon-link-label">View Site</span>
        </Link>

        <div style={{ position: 'relative' }} ref={accountRef}>
          <div className="admin-header__user" onClick={toggleAccount}>
            <span className="admin-header__avatar">{initials}</span>
            <div className="admin-header__user-info">
              <strong>{adminName || 'Admin User'}</strong>
              <span>Administrator</span>
            </div>
            <ChevronDown size={16} className="admin-header__chevron" />
          </div>
          {accountOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 12px)',
                width: 220,
                background: 'var(--white)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
                zIndex: 1500,
              }}
            >
              <div
                style={{
                  padding: 'var(--space-4) var(--space-5)',
                  borderBottom: '1px solid var(--border-light)',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{adminName || 'Admin User'}</div>
                {adminEmail ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-light-muted)' }}>{adminEmail}</div>
                ) : null}
              </div>
              <ul style={{ margin: 0, padding: 'var(--space-2)', listStyle: 'none' }}>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/settings')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      width: '100%',
                      padding: '10px var(--space-4)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-dark)',
                      fontSize: '0.9rem',
                      background: 'transparent',
                      transition: 'background var(--t-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-light)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Settings size={16} /> Settings
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={async () => {
                      await logout()
                      navigate('/admin/login')
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      width: '100%',
                      padding: '10px var(--space-4)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--primary-red)',
                      fontSize: '0.9rem',
                      background: 'transparent',
                      transition: 'background var(--t-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-light)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}