import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu } from 'lucide-react'
import MobileMenu from './MobileMenu.jsx'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/athletes', label: 'Fighters' },
  { to: '/sponsorships', label: 'Sponsorships' },
  { to: '/news', label: 'News' },
  { to: '/events', label: 'Events' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/contact', label: 'Contact' },
]

const MOBILE_BP = 1024
const INNER_GAP = 16 // var(--space-4) between brand and actions
const ACTIONS_GAP = 12 // var(--space-3) between cta and hamburger

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [ctaHidden, setCtaHidden] = useState(false)
  const innerRef = useRef(null)
  const brandRef = useRef(null)
  const ctaRef = useRef(null)
  const hamburgerRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const checkSpace = () => {
      if (window.innerWidth > MOBILE_BP) {
        setCtaHidden(false)
        return
      }
      const inner = innerRef.current
      const brand = brandRef.current
      const cta = ctaRef.current
      const hamburger = hamburgerRef.current
      if (!inner || !brand || !cta || !hamburger) return

      // Natural widths are stable because the brand never shrinks (flex-shrink: 0)
      // and the hidden CTA is positioned out of flow but still rendered.
      const brandW = brand.offsetWidth
      const ctaW = cta.offsetWidth
      const hamburgerW = hamburger.offsetWidth
      const innerW = inner.offsetWidth
      const needed = brandW + INNER_GAP + ctaW + ACTIONS_GAP + hamburgerW

      setCtaHidden(needed > innerW)
    }
    checkSpace()
    window.addEventListener('resize', checkSpace)
    window.addEventListener('load', checkSpace)
    return () => {
      window.removeEventListener('resize', checkSpace)
      window.removeEventListener('load', checkSpace)
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <>
      <header className={`navbar ${scrolled ? 'navbar--scrolled' : ''} ${ctaHidden ? 'navbar--cta-hidden' : ''}`}>
        <div className="container navbar__inner" ref={innerRef}>
          <Link to="/" className="navbar__brand" ref={brandRef} aria-label="USSCOS Trust home">
            <img className="navbar__logo-img" src="/logo.png" alt="USSCOS logo" />
            <span className="navbar__logo">U<span className="navbar__logo-accent">S</span>SCOS</span>
          </Link>

          <nav className="navbar__links" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
                end={link.to === '/'}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="navbar__actions">
            <Link to="/donate" className="btn btn-primary btn-sm navbar__cta" ref={ctaRef}>
              Donate
            </Link>
            <button
              ref={hamburgerRef}
              className="navbar__hamburger"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <Menu size={26} />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} links={NAV_LINKS} showDonate={ctaHidden} />
    </>
  )
}
