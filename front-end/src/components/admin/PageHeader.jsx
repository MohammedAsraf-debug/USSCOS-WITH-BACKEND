export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="admin-page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="admin-page-header__actions">{actions}</div>}
    </div>
  )
}