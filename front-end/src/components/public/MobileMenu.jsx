import { useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'

// Allow the sidebar closing animation to fully play before navigating.
const CLOSE_MS = 430

export default function MobileMenu({ open, onClose, links, showDonate }) {
  const navigate = useNavigate()
  const timerRef = useRef(null)

  const handleNav = (e, to) => {
    e.preventDefault()
    onClose()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => navigate(to), CLOSE_MS)
  }

  const handleClose = () => {
    onClose()
    clearTimeout(timerRef.current)
  }

  return (
    <div className={`mobile-menu ${open ? 'mobile-menu--open' : ''}`} aria-hidden={!open}>
      <div className="mobile-menu__overlay" onClick={handleClose}></div>
      <div className="mobile-menu__panel">
        <div className="mobile-menu__header">
          <img className="navbar__logo-img" src="/logo.png" alt="USSCOS logo" />
          <span className="navbar__logo">U<span className="navbar__logo-accent">S</span>SCOS</span>
          <button className="mobile-menu__close" onClick={handleClose} aria-label="Close menu">
            <X size={24} />
          </button>
        </div>
        <nav className="mobile-menu__nav" aria-label="Mobile">
          {links.map((link, i) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={(e) => handleNav(e, link.to)}
              end={link.to === '/'}
              className={({ isActive }) => `mobile-menu__link ${isActive ? 'mobile-menu__link--active' : ''}`}
              style={{ transitionDelay: open ? `${i * 40 + 80}ms` : '0ms' }}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="mobile-menu__footer">
          <NavLink to="/seeking-sponsorship" className="btn btn-secondary btn-full" onClick={(e) => handleNav(e, '/seeking-sponsorship')}>
            Apply for Sponsorship
          </NavLink>
          {showDonate && (
            <NavLink to="/donate" className="btn btn-primary btn-full" onClick={(e) => handleNav(e, '/donate')}>
              Donate Now
            </NavLink>
          )}
        </div>
      </div>
    </div>
  )
}
