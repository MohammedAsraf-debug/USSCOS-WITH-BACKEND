import { ClipboardList, HandCoins, Wallet, TrendingUp, ArrowRight, Calendar } from 'lucide-react'
import PageHeader from '../../components/admin/PageHeader.jsx'
import AdminStatCard from '../../components/admin/AdminStatCard.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import StatusBadge from '../../components/admin/StatusBadge.jsx'
import { useAdminEvents, useAdminSponsorApplications } from '@/hooks/use-firestore'

const byDateDesc = (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
const byDateAsc = (a, b) => (a.date ?? '').localeCompare(b.date ?? '')

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN') : '—'

const formatAmount = (value) =>
  typeof value === 'number' ? `₹${value.toLocaleString('en-IN')}` : '—'

export default function AdminDashboard() {
  const { data: applications, isLoading: applicationsLoading } = useAdminSponsorApplications()
  const { data: events, isLoading: eventsLoading } = useAdminEvents()

  if (applicationsLoading || eventsLoading) {
    return <LoadingState label="Loading dashboard" />
  }

  const applicationsList = applications ?? []
  const initiatedCount = applicationsList.filter((a) => a.paymentStatus === 'INITIATED').length
  const paidCount = applicationsList.filter((a) => a.paymentStatus === 'PAID').length
  const totalAmount = applicationsList.reduce((sum, a) => sum + (typeof a.amount === 'number' ? a.amount : 0), 0)
  const recentPayments = [...applicationsList].sort(byDateDesc).slice(0, 5)
  const initiatedPayments = applicationsList.filter((a) => a.paymentStatus === 'INITIATED')
  const upcomingList = (events ?? [])
    .filter((ev) => ev.status === 'upcoming')
    .sort(byDateAsc)
    .slice(0, 5)

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening at USSCOS Trust."
      />

      <div className="admin-stats-grid">
        <AdminStatCard label="Sponsorships" value={applicationsList.length} icon={ClipboardList} />
        <AdminStatCard label="Payments Initiated" value={initiatedCount} icon={TrendingUp} accent="amber" />
        <AdminStatCard label="Payments Paid" value={paidCount} icon={HandCoins} accent="green" />
        <AdminStatCard label="Total Sponsorship Amount" value={formatAmount(totalAmount)} icon={Wallet} accent="blue" />
      </div>

      <div className="admin-dashboard-grid">
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h3>Recent Sponsor Payments</h3>
            <a href="/admin/sponsorships" className="link-arrow-light" style={{ fontSize: '0.8rem' }}>
              View All <ArrowRight size={15} />
            </a>
          </div>
          {recentPayments.length === 0 ? (
            <p style={{ color: 'var(--text-light-muted)', fontSize: '0.9rem', padding: 'var(--space-4)' }}>No sponsorships yet.</p>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sponsor</th>
                    <th>Fighter</th>
                    <th>Amount</th>
                    <th>Payment Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((app) => (
                    <tr key={app.id}>
                      <td style={{ fontWeight: 600 }}>{app.contactName}</td>
                      <td>{app.athlete?.name ?? '—'}</td>
                      <td>{formatAmount(app.amount)}</td>
                      <td><StatusBadge status={app.paymentStatus} /></td>
                      <td>{formatDate(app.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="admin-card" style={{ marginBottom: 'var(--space-5)' }}>
            <h3>Initiated Payments</h3>
            {initiatedPayments.length === 0 ? (
              <p style={{ color: 'var(--text-light-muted)', fontSize: '0.9rem', padding: 'var(--space-4)' }}>No initiated payments.</p>
            ) : (
              <div className="activity-feed">
                {initiatedPayments.slice(0, 5).map((app) => (
                  <div className="activity-item" key={app.id}>
                    <span className="activity-item__dot"></span>
                    <p>
                      <strong>{app.contactName}</strong>
                      {app.athlete?.name ? ` — ${app.athlete.name}` : ''}
                      <br />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-light-muted)' }}>{formatDate(app.createdAt)}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
            <a href="/admin/sponsorships" className="link-arrow-light" style={{ fontSize: '0.8rem' }}>
              Monitor Sponsorships <ArrowRight size={15} />
            </a>
          </div>

          <div className="admin-card">
            <h3>Upcoming Events</h3>
            {upcomingList.length === 0 ? (
              <p style={{ color: 'var(--text-light-muted)', fontSize: '0.9rem', padding: 'var(--space-4)' }}>No upcoming events.</p>
            ) : (
              <div className="activity-feed">
                {upcomingList.map((evt) => (
                  <div className="activity-item" key={evt.id}>
                    <span className="activity-item__dot" style={{ background: 'transparent', border: '2px solid var(--primary-red)' }}></span>
                    <p><strong>{evt.title}</strong><br />{formatDate(evt.date)}</p>
                    <Calendar size={16} style={{ color: 'var(--text-light-muted)' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}