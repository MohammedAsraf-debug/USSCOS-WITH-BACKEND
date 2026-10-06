import { Link } from 'react-router-dom'

export default function PrimaryButton({
  to,
  onClick,
  children,
  type = 'button',
  size = 'md',
  full = false,
  disabled = false,
  className = '',
}) {
  const classes = `btn btn-primary btn-${size} ${full ? 'btn-full' : ''} ${className}`

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
