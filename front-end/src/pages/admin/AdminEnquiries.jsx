import { useState } from 'react'
import { Eye } from 'lucide-react'
import PageHeader from '../../components/admin/PageHeader.jsx'
import SearchBar from '../../components/common/SearchBar.jsx'
import FilterBar from '../../components/common/FilterBar.jsx'
import Modal from '../../components/common/Modal.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import { useInbox } from '@/hooks/use-firestore'
import { useToast } from '../../context/ToastContext.jsx'

const STATUSES = ['NEW', 'READ']

export default function AdminEnquiries() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [detail, setDetail] = useState(null)
  const { showToast } = useToast()
  const { data: inboxItems, isLoading } = useInbox()

  const allContacts = (inboxItems ?? []).filter((i) => i.kind === 'contact')

  const enquiries = allContacts.map((item, i) => ({
    ...item,
    name: item.summary?.split(' — ')[0] || 'Unknown',
    email: item.email || '',
    subject: item.type || 'Contact',
    phone: item.phone || '',
    date: item.createdAt,
    status: 'NEW',
    message: item.message || item.summary || '',
  })).filter((enq) => {
    const matchesSearch = !search || enq.name?.toLowerCase().includes(search.toLowerCase()) || enq.subject?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = status === 'all' || enq.status === status
    return matchesSearch && matchesStatus
  })

  const openDetail = (enq) => {
    setDetail(enq)
  }

  return (
    <>
      <PageHeader title="Enquiries" subtitle="Manage messages received from the public." />

      <div className="table-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search enquiries..." />
        <FilterBar
          filters={[
            {
              key: 'status',
              label: 'Status',
              value: status,
              options: [
                { value: 'all', label: 'All Statuses' },
                ...STATUSES.map((s) => ({ value: s, label: s })),
              ],
            },
          ]}
          onFilterChange={(key, value) => setStatus(value)}
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading enquiries" />
      ) : enquiries.length === 0 ? (
        <EmptyState title="No enquiries found" />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Subject</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.map((enq) => (
                <tr key={enq.id}>
                  <td style={{ fontWeight: 600 }}>{enq.name}</td>
                  <td>{enq.subject}</td>
                  <td>{enq.date ? new Date(enq.date).toLocaleDateString('en-IN') : '—'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="action-btn" onClick={() => openDetail(enq)} aria-label="View enquiry">
                        <Eye size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Enquiry — ${detail.subject}` : ''}
        footer={
          <PrimaryButton onClick={() => setDetail(null)}>CLOSE</PrimaryButton>
        }
      >
        {detail && (
          <>
            <div className="review-section">
              <h4>Details</h4>
              <dl>
                <div><dt>Name</dt><dd>{detail.name}</dd></div>
                <div><dt>Email</dt><dd>{detail.email ? <a href={`mailto:${detail.email}`}>{detail.email}</a> : '—'}</dd></div>
                <div><dt>Phone</dt><dd>{detail.phone || '—'}</dd></div>
                <div><dt>Date</dt><dd>{detail.date ? new Date(detail.date).toLocaleDateString('en-IN') : '—'}</dd></div>
              </dl>
            </div>
            <div className="review-section">
              <h4>Message</h4>
              <p style={{ lineHeight: 1.7, background: 'var(--bg-light)', padding: 'var(--space-4)', borderRadius: 'var(--radius-sm)' }}>
                {detail.message || detail.summary}
              </p>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}