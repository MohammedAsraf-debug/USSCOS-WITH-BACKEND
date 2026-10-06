import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  ClipboardList,
  HandCoins,
  Handshake,
  Mail,
  Newspaper,
  Images,
  FolderOpen,
  LayoutTemplate,
  Settings,
  LogOut,
  X,
} from 'lucide-react'
import { doSignOut as logout } from '@/services/auth'

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/athletes', label: 'Fighters', icon: Users },
  { to: '/admin/groups', label: 'Groups', icon: Building2 },
  { to: '/admin/events', label: 'Events', icon: CalendarDays },
  { to: '/admin/applications', label: 'Applications', icon: ClipboardList },
  { to: '/admin/sponsorships', label: 'Sponsorships', icon: HandCoins },
  { to: '/admin/partners', label: 'Partners', icon: Handshake },
  { to: '/admin/enquiries', label: 'Enquiries', icon: Mail },
  { to: '/admin/news', label: 'News', icon: Newspaper },
  { to: '/admin/gallery', label: 'Gallery', icon: Images },
  { to: '/admin/documents', label: 'Documents', icon: FolderOpen },
  { to: '/admin/content', label: 'Website Content', icon: LayoutTemplate },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminSidebar({ open, onClose, onLogout }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    onLogout?.()
    navigate('/admin/login')
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div className={`admin-sidebar-overlay ${open ? 'admin-sidebar-overlay--open' : ''}`} onClick={onClose}></div>
      <aside className={`admin-sidebar ${open ? 'admin-sidebar--open' : ''}`}>
        <div className="admin-sidebar__header">
          <NavLink to="/admin/dashboard" className="navbar__brand" onClick={onClose}>
            <img className="navbar__logo-img" src="/logo.png" alt="USSCOS logo" />
            <span className="navbar__logo">U<span className="navbar__logo-accent">S</span>SCOS</span>
            <span className="navbar__logo-sub">Combat Sports Trust</span>
          </NavLink>
          <button className="admin-sidebar__close" onClick={onClose} aria-label="Close sidebar">
            <X size={22} />
          </button>
        </div>

        <p className="admin-sidebar__section-label">Menu</p>
        <nav className="admin-sidebar__nav" aria-label="Admin">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) => `admin-sidebar__link ${isActive ? 'admin-sidebar__link--active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          <button className="admin-sidebar__link admin-sidebar__link--logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}