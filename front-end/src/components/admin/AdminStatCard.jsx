export default function AdminStatCard({ label, value, trend, icon: Icon, accent = 'red' }) {
  return (
    <div className="admin-stat">
      <div className={`admin-stat__icon admin-stat__icon--${accent}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="admin-stat__value">{value}</div>
        <div className="admin-stat__label">{label}</div>
        {trend && <div className="admin-stat__trend">{trend}</div>}
      </div>
    </div>
  )
}