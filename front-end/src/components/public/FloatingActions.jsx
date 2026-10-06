import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'

export default function FloatingActions() {
  const [closed, setClosed] = useState(false)

  if (closed) return null

  const handleClose = () => {
    setClosed(true)
  }

  return (
    <div className="floating-actions" role="complementary" aria-label="Quick actions">
      <button
        type="button"
        className="floating-actions__close"
        onClick={handleClose}
        aria-label="Close quick actions"
      >
        <X size={16} />
      </button>
      <Link to="/sponsorships" className="floating-actions__btn floating-actions__btn--primary">
        Become a Sponsor
      </Link>
      <Link to="/seeking-sponsorship" className="floating-actions__btn">
        Seeking Sponsorship
      </Link>
    </div>
  )
}
