import { useCountUp } from '../../hooks/useCountUp.js'

export default function StatCard({ value, label, icon: Icon, dark = false }) {
  const numeric = String(value).replace(/[^0-9]/g, '')
  const suffix = String(value).replace(/[0-9]/g, '')
  const { ref, value: animatedValue } = useCountUp(numeric)
  const animated = numeric ? `${animatedValue}${suffix}` : value

  return (
    <div className={`stat-card ${dark ? 'stat-card--dark' : ''}`} ref={ref}>
      <div className="stat-card__icon">
        <Icon size={24} />
      </div>
      <div className="stat-card__value">{animated}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  )
}
