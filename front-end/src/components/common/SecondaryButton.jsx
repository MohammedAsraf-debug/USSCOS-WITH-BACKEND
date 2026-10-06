import { Link } from 'react-router-dom'

export default function SecondaryButton({
  to,
  onClick,
  children,
  type = 'button',
  size = 'md',
  dark = false,
  full = false,
  disabled = false,
  className = '',
}) {
  const variant = dark ? 'btn-secondary-dark' : 'btn-secondary'
  const classes = `btn ${variant} btn-${size} ${full ? 'btn-full' : ''} ${className}`

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} className={classes} disabled={disabled}>
      {children}
    </button>
  )
}
