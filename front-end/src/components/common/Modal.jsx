import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, footer, dark = false, className = '' }) {
  useEffect(() => {
    if (!open) return

    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
    >
      <div className={`modal ${dark ? 'modal--dark' : ''}${className ? ` ${className}` : ''}`}>
        <div className="modal__header">
          <h3>{title}</h3>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  )
}
