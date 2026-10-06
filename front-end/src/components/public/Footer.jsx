import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin } from 'lucide-react'
import { FacebookIcon, InstagramIcon, TwitterIcon, LinkedinIcon, YoutubeIcon } from '../common/SocialIcons.jsx'
import { siteContent } from '../../data/siteContent.js'
import { useContentBlock } from '@/hooks/use-firestore'

const QUICK_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/athletes', label: 'Fighters' },
  { to: '/seeking-sponsorship', label: 'Get Involved' },
  { to: '/sponsorships', label: 'Sponsors' },
  { to: '/events', label: 'Events' },
  { to: '/contact', label: 'Contact' },
]

const GET_INVOLVED = [
  { to: '/sponsorships/sponsor', label: 'Sponsor a Fighter' },
  { to: '/seeking-sponsorship', label: 'Volunteer' },
  { to: '/donate', label: 'Donate' },
  { to: '/donate', label: 'Fundraise' },
  { to: '/contact', label: 'Partner With Us' },
  { to: '/contact', label: 'Contact Us' },
]

const RESOURCES = [
  { to: '/faq', label: 'FAQ' },
  { to: '/news', label: 'Impact Stories' },
  { to: '/news', label: 'News & Updates' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms & Conditions' },
]

const SOCIALS = [
  { label: 'Facebook', Icon: FacebookIcon },
  { label: 'Instagram', Icon: InstagramIcon },
  { label: 'Twitter', Icon: TwitterIcon },
  { label: 'LinkedIn', Icon: LinkedinIcon },
  { label: 'YouTube', Icon: YoutubeIcon },
]

export default function Footer() {
  const { data: contactBlock } = useContentBlock('contact')
  const contact = { ...siteContent.contact, ...(contactBlock ?? {}) }

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <Link to="/" className="navbar__brand footer__brand-logo">
              <img className="navbar__logo-img" src="/logo.png" alt="USSCOS logo" />
              <span className="navbar__logo">U<span className="navbar__logo-accent">S</span>SCOS</span>
              <span className="navbar__logo-sub">Combat Sports Trust</span>
            </Link>
            <p className="footer__desc">
              Empowering fighters through sponsorship, training, and competition.
              Building champions on and off the ring.
            </p>
            <div className="footer__socials">
              {SOCIALS.map(({ label, Icon }) => (
                <span key={label} className="footer__social" aria-hidden="true">
                  <Icon size={18} />
                </span>
              ))}
            </div>
          </div>

          <div className="footer__col">
            <h4>Quick Links</h4>
            <ul>
              {QUICK_LINKS.map((l) => (
                <li key={l.label}>
                  <Link to={l.to}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer__col">
            <h4>Get Involved</h4>
            <ul>
              {GET_INVOLVED.map((l) => (
                <li key={l.label}>
                  <Link to={l.to}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer__col">
            <h4>Resources</h4>
            <ul>
              {RESOURCES.map((l) => (
                <li key={l.label}>
                  <Link to={l.to}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer__col footer__contact">
            <h4>Contact Us</h4>
            <ul>
              <li>
                <MapPin size={16} />
                <span>{contact.address}</span>
              </li>
              <li>
                <Phone size={16} />
                <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>
              </li>
              <li>
                <Mail size={16} />
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} USSCOS Trust. All rights reserved.</span>
          <nav className="footer__legal" aria-label="Legal">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
