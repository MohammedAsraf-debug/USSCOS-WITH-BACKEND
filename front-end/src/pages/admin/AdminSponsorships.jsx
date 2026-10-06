import { useState } from 'react'
import { Eye, RotateCcw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/admin/PageHeader.jsx'
import SearchBar from '../../components/common/SearchBar.jsx'
import FilterBar from '../../components/common/FilterBar.jsx'
import StatusBadge from '../../components/admin/StatusBadge.jsx'
import Modal from '../../components/common/Modal.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import { useAdminSponsorApplications, useAdminPaymentRecords } from '@/hooks/use-firestore'
import { getIdToken } from '@/services/auth'
import { requestRefund } from '@/services/payments/payment-platform'
import { paymentsConfigured } from '@/lib/config'
import { useToast } from '../../context/ToastContext.jsx'

const PAYMENT_STATUSES = ['INITIATED', 'PAID', 'FAILED', 'REFUNDED']

const byDateDesc = (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')

function DetailBlock({ title, children }) {
  return (
    <div className="review-section">
      <h4>{title}</h4>
      {children}
    </div>
  )
}

function Keyword({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  )
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '—'
}

function formatAmount(value) {
  return typeof value === 'number'
    ? `₹${value.toLocaleString('en-IN')}`
    : value || '—'
}

function SectionDivider({ label }) {
  return (
    <div className="table-toolbar" style={{ marginTop: 'var(--space-6)' }}>
      <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{label}</h3>
    </div>
  )
}

export default function AdminSponsorships() {
  const [search, setSearch] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [detail, setDetail] = useState(null)
  const [refundTarget, setRefundTarget] = useState(null)
  const [refunding, setRefunding] = useState(false)
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const {
    data: applications,
    isLoading: applicationsLoading,
  } = useAdminSponsorApplications()
  const {
    data: records,
    isLoading: recordsLoading,
  } = useAdminPaymentRecords()

  const list = applications ?? []
  const ledger = records ?? []

  const handleRefund = async () => {
    if (!refundTarget) return
    setRefunding(true)
    try {
      const idToken = await getIdToken()
      if (!idToken) {
        showToast('You need to be signed in as an admin to refund payments.', 'error')
        return
      }
      const result = await requestRefund({ recordId: refundTarget.id, idToken })
      if (result.ok) {
        showToast(
          result.status === 'REFUNDED'
            ? `Refund initiated for ${refundTarget.id}.`
            : `Refund requested for ${refundTarget.id} (${result.refundId}).`,
          'success',
        )
        queryClient.invalidateQueries({ queryKey: ['admin', 'payment-records'] })
        queryClient.invalidateQueries({ queryKey: ['admin', 'sponsor-applications'] })
      } else {
        showToast(result.message ?? 'Refund failed. Please try again.', 'error')
      }
    } catch {
      showToast('Refund failed. Please try again.', 'error')
    } finally {
      setRefunding(false)
      setRefundTarget(null)
    }
  }

  const filtered = list.filter((item) => {
    const athleteName = item.athlete?.name?.toLowerCase() ?? ''
    const matchesSearch =
      !search ||
      item.contactName?.toLowerCase().includes(search.toLowerCase()) ||
      item.orgName?.toLowerCase().includes(search.toLowerCase()) ||
      item.email?.toLowerCase().includes(search.toLowerCase()) ||
      athleteName.includes(search.toLowerCase())
    const matchesStatus = paymentStatus === 'all' || item.paymentStatus === paymentStatus
    return matchesSearch && matchesStatus
  })

  return (
    <>
      <PageHeader
        title="Sponsorships"
        subtitle="Monitor fighter sponsorship payments. Sponsors support fighters directly — no approval needed."
      />

      {applicationsLoading ? (
        <LoadingState label="Loading sponsorships" />
      ) : (
        <>
          <div className="table-toolbar">
            <SearchBar value={search} onChange={setSearch} placeholder="Search sponsor, email or fighter..." />
            <FilterBar
              filters={[
                {
                  key: 'paymentStatus',
                  label: 'Payment Status',
                  value: paymentStatus,
                  options: [
                    { value: 'all', label: 'All Payment Statuses' },
                    ...PAYMENT_STATUSES.map((s) => ({ value: s, label: s })),
                  ],
                },
              ]}
              onFilterChange={(key, value) => setPaymentStatus(value)}
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No sponsorships found" subtitle="Sponsorships appear here once a sponsor submits support from a fighter profile." />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sponsor</th>
                    <th>Email</th>
                    <th>Fighter</th>
                    <th>Sport</th>
                    <th>Amount</th>
                    <th>Payment Status</th>
                    <th>Provider</th>
                    <th>Payment ID</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filtered].sort(byDateDesc).map((app) => (
                    <tr key={app.id} className="data-table__row--clickable" onClick={() => setDetail(app)}>
                      <td style={{ fontWeight: 600 }}>
                        {app.contactName}
                        {app.orgName ? <span style={{ display: 'block', fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-light-muted)' }}>{app.orgName}</span> : null}
                      </td>
                      <td>{app.email}</td>
                      <td>{app.athlete?.name ?? '—'}</td>
                      <td>{app.athlete?.sport ?? '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatAmount(app.amount)}</td>
                      <td><StatusBadge status={app.paymentStatus} /></td>
                      <td>{app.paymentProvider ?? '—'}</td>
                      <td>{app.paymentId ?? '—'}</td>
                      <td>{formatDate(app.createdAt)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="table-actions">
                          <button className="action-btn" onClick={() => setDetail(app)} aria-label="View sponsorship">
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

          <SectionDivider label="Payment Ledger" />

          {recordsLoading ? (
            <LoadingState label="Loading payment records" />
          ) : ledger.length === 0 ? (
            <EmptyState
              title={paymentsConfigured ? 'No payment records yet' : 'Payments are not configured yet'}
              subtitle={
                paymentsConfigured
                  ? 'Server-verified payments appear here once a checkout is completed.'
                  : 'Set VITE_BACKEND_URL and the unified Node backend to start accepting payments.'
              }
            />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Purpose</th>
                    <th>Donor</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Order ID</th>
                    <th>Payment ID</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...ledger].sort(byDateDesc).map((record) => (
                    <tr key={record.id}>
                      <td style={{ fontWeight: 600 }}>{record.purpose}</td>
                      <td>
                        {record.customer.name}
                        {record.customer.email ? <span style={{ display: 'block', fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-light-muted)' }}>{record.customer.email}</span> : null}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatAmount(record.amount)}</td>
                      <td><StatusBadge status={record.paymentStatus} /></td>
                      <td>{record.orderId || '—'}</td>
                      <td>{record.paymentId ?? '—'}</td>
                      <td>{formatDate(record.createdAt)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="table-actions">
                          {paymentsConfigured && record.paymentStatus === 'PAID' && (
                            <button
                              className="action-btn"
                              onClick={() => setRefundTarget(record)}
                              aria-label="Refund payment"
                              title="Refund payment"
                            >
                              <RotateCcw size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* View-only sponsorship modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Sponsorship — ${detail.paymentStatus}` : ''}
        dark
        footer={<PrimaryButton onClick={() => setDetail(null)}>CLOSE</PrimaryButton>}
      >
        {detail && (
          <>
            <DetailBlock title="Sponsor">
              <dl>
                <Keyword label="Contact" value={detail.contactName} />
                <Keyword label="Organization" value={detail.orgName} />
                <Keyword label="Email" value={detail.email} />
                <Keyword label="Phone" value={detail.phone} />
                <Keyword label="Website" value={detail.website} />
                <Keyword label="Support Level" value={detail.supportKind} />
                <Keyword label="Application Status" value={detail.status} />
                <Keyword label="Submitted" value={formatDate(detail.createdAt)} />
              </dl>
            </DetailBlock>

            <DetailBlock title="Payment">
              <dl>
                <Keyword label="Amount" value={formatAmount(detail.amount)} />
                <Keyword label="Currency" value={detail.currency} />
                <Keyword label="Payment Status" value={detail.paymentStatus} />
                <Keyword label="Provider" value={detail.paymentProvider} />
                <Keyword label="Payment ID" value={detail.paymentId} />
                <Keyword label="Order ID" value={detail.orderId} />
              </dl>
              {detail.paymentStatus === 'INITIATED' ? (
                <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem' }}>
                  Payment initiated — it will move to PAID after the Razorpay payment is verified server-side.
                </p>
              ) : null}
            </DetailBlock>

            {detail.athlete && (
              <DetailBlock title="Fighter Requested">
                <dl>
                  <Keyword label="Fighter" value={detail.athlete.name} />
                  <Keyword label="Sport" value={detail.athlete.sport} />
                  <Keyword label="Fighter ID" value={detail.athlete.id} />
                </dl>
              </DetailBlock>
            )}

            <DetailBlock title="Message">
              <p style={{ lineHeight: 1.7, background: 'var(--bg-light)', color: 'var(--text-dark)', padding: 'var(--space-4)', borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap' }}>
                {detail.message || 'No message provided'}
              </p>
            </DetailBlock>
          </>
        )}
      </Modal>

      {/* Refund confirmation */}
      <Modal
        open={!!refundTarget}
        onClose={() => { if (!refunding) setRefundTarget(null) }}
        title={refundTarget ? 'Confirm refund' : ''}
        dark
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRefundTarget(null)}
              disabled={refunding}
            >
              CANCEL
            </button>
            <PrimaryButton onClick={() => void handleRefund()} disabled={refunding}>
              {refunding ? 'PROCESSING...' : 'CONFIRM REFUND'}
            </PrimaryButton>
          </>
        }
      >
        {refundTarget && (
          <p>
            Refund <strong>₹{refundTarget.amount.toLocaleString('en-IN')}</strong> for{' '}
            <strong>{refundTarget.customer.name} ({refundTarget.customer.email})</strong> — order{' '}
            <strong>{refundTarget.orderId}</strong>? The payment will be reversed through Razorpay.
          </p>
        )}
      </Modal>
    </>
  )
}