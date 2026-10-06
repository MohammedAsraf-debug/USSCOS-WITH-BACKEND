import React from 'react'
import { Edit, Trash2 } from 'lucide-react'

function formatStatus(status) {
  if (!status) return '—'
  return String(status).charAt(0).toUpperCase() + String(status).slice(1)
}

function formatJoined(createdAt) {
  if (!createdAt) return '—'
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return String(createdAt)
  return date.toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

const AdminList = ({ admins, onEdit, onDelete }) => {
  if (!admins || admins.length === 0) {
    return null
  }

  return (
    <div className="admin-list-wrapper" style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
        <thead>
          <tr>
            <th
              style={{
                padding: 'var(--space-4)',
                textAlign: 'left',
                fontSize: '0.74rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-light-muted)',
                borderBottom: '1px solid var(--border-light)',
                whiteSpace: 'nowrap',
              }}
            >
              Name
            </th>
            <th
              style={{
                padding: 'var(--space-4)',
                textAlign: 'left',
                fontSize: '0.74rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-light-muted)',
                borderBottom: '1px solid var(--border-light)',
                whiteSpace: 'nowrap',
              }}
            >
              Email
            </th>
            <th
              style={{
                padding: 'var(--space-4)',
                textAlign: 'left',
                fontSize: '0.74rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-light-muted)',
                borderBottom: '1px solid var(--border-light)',
                whiteSpace: 'nowrap',
              }}
            >
              Role
            </th>
            <th
              style={{
                padding: 'var(--space-4)',
                textAlign: 'left',
                fontSize: '0.74rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-light-muted)',
                borderBottom: '1px solid var(--border-light)',
                whiteSpace: 'nowrap',
              }}
            >
              Status
            </th>
            <th
              style={{
                padding: 'var(--space-4)',
                textAlign: 'left',
                fontSize: '0.74rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-light-muted)',
                borderBottom: '1px solid var(--border-light)',
                whiteSpace: 'nowrap',
              }}
            >
              Joined
            </th>
            <th
              style={{
                padding: 'var(--space-4)',
                textAlign: 'center',
                fontSize: '0.74rem',
                whiteSpace: 'nowrap',
              }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {admins.map((admin) => (
            <tr key={admin.id}>
              <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{admin.name}</td>
              <td>{admin.email}</td>
            <td>
              <span className="status-badge status-badge--active">{admin.role}</span>
            </td>
            <td style={{ whiteSpace: 'nowrap' }}>{formatStatus(admin.status)}</td>
            <td style={{ whiteSpace: 'nowrap' }}>{formatJoined(admin.createdAt)}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <div className="table-actions">
                  <button
                    className="action-btn"
                    onClick={() => onEdit(admin)}
                    aria-label="Edit admin"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    className="action-btn action-btn--danger"
                    onClick={() => onDelete(admin.id, admin.name)}
                    aria-label="Delete admin"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AdminList