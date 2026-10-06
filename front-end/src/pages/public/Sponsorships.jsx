// Impact/ledger page for /sponsorships/provided — shows completed/verified sponsorship records.
// This is the "Sponsorships Provided / Transparent Impact" page.
// The hub page (/sponsorships) is at src/pages/public/SponsorshipsHub.jsx

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import PageHero from '../../components/common/PageHero.jsx'
import SearchBar from '../../components/common/SearchBar.jsx'
import FilterBar from '../../components/common/FilterBar.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import StatusBadge from '../../components/admin/StatusBadge.jsx'
import { useAdminPaymentRecords } from '@/hooks/use-firestore'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { Reveal } from '../../hooks/useReveal.jsx'

export default function SponsorshipsImpact() {
  const navigate = useNavigate()
  const { data: recordsData, isLoading, isError } = useAdminPaymentRecords()
  const { content } = usePageContent('sponsorships-provided')
  const [view, setView] = useState('cards')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const debouncedSearch = useDebouncedValue(search, 300)

  const records = useMemo(() => {
    const all = (recordsData ?? []).map((r) => ({
      id: r.id,
      athlete: r.entity?.kind === 'sponsorApplication' ? 'Application' : r.customer?.name ?? 'Unknown',
      sport: 'Boxing',
      sponsorName: r.customer?.name ?? 'Unknown',
      amount: r.amount ?? 0,
      date: r.createdAt ?? '',
      event: r.entity?.title ?? 'Sponsorship',
      type: r.purpose === 'SPONSORSHIP' ? 'Sponsorship' : 'General',
      status: r.paymentStatus,
      purpose: r.customer?.name ?? 'Customer',
    }))
    return all.filter((r) => {
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        if (!r.athlete.toLowerCase().includes(q) && !r.purpose.toLowerCase().includes(q)) return false
      }
      if (status !== 'all' && r.status !== status) return false
      return true
    })
  }, [recordsData, debouncedSearch, status])

  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={renderRichText(content.heroTitle)}
        subtitle={content.heroSubtitle}
        image="https://images.unsplash.com/photo-1517963879433-6ad2b056d712?q=80&w=1600&auto=format&fit=crop"
      />

      <section className="section section-light">
        <div className="container">
          <div className="table-toolbar" style={{ marginBottom: 'var(--space-6)' }}>
            <SearchBar value={search} onChange={setSearch} placeholder={content.searchPlaceholder} />
            <div className="table-toolbar__right">
              <FilterBar
                filters={[
                  {
                    key: 'status',
                    label: content.statusLabel,
                    value: status,
                    options: [
                      { value: 'all', label: content.allStatusesLabel },
                      { value: 'ACTIVE', label: content.statusActiveLabel },
                      { value: 'FAILED', label: content.statusFailedLabel },
                      { value: 'REFUNDED', label: content.statusRefundedLabel },
                    ],
                  },
                ]}
                onFilterChange={(key, value) => setStatus(value)}
              />
              <div className="view-toggle" role="tablist" aria-label="View preference">
                <button
                  className={`btn btn-sm ${view === 'cards' ? 'btn-outline-red' : 'btn-secondary-dark'}`}
                  onClick={() => setView('cards')}
                >
                  {content.viewCardsLabel}
                </button>
                <button
                  className={`btn btn-sm ${view === 'table' ? 'btn-outline-red' : 'btn-secondary-dark'}`}
                  onClick={() => setView('table')}
                >
                  {content.viewTableLabel}
                </button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <LoadingState label={content.loadingLabel} />
          ) : isError ? (
            <EmptyState title={content.errorTitle} description={content.errorDescription} />
          ) : records.length === 0 ? (
            <EmptyState
              title={content.emptyTitle}
              description={content.emptyDescription}
            />
          ) : view === 'cards' ? (
            <Reveal stagger className="sponsorships-grid">
              {records.map((r) => (
                <article
                  className="sponsor-record"
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${r.athlete}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/sponsorships/athlete/${r.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/sponsorships/athlete/${r.id}`)
                    }
                  }}
                >
                  <div className="sponsor-record__head">
                    <div>
                      <h3>{r.athlete}</h3>
                      <p>{r.sport} • {r.sponsorName}</p>
                    </div>
                  </div>
                  <div className="sponsor-record__rows">
                    <div className="sponsor-record__row">
                      <span>{content.amountLabel}</span>
                      <span style={{ color: 'var(--primary-red)', fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
                        ₹{r.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="sponsor-record__row">
                      <span>{content.dateLabel}</span>
                      <span>{new Date(r.date).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="sponsor-record__row">
                      <span>{content.eventLabel}</span>
                      <span>{r.event}</span>
                    </div>
                    <div className="sponsor-record__row">
                      <span>{content.typeLabel}</span>
                      <span>{r.type}</span>
                    </div>
                    <div className="sponsor-record__row">
                      <span>{content.statusRowLabel}</span>
                      <span><StatusBadge status={r.status} /></span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-light-muted)', lineHeight: 1.6 }}>
                    <TrendingUp size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                    {r.purpose}
                  </p>
                </article>
              ))}
            </Reveal>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{content.colDonor}</th>
                    <th>{content.colFighter}</th>
                    <th>{content.colAmount}</th>
                    <th>{content.colDate}</th>
                    <th>{content.colEvent}</th>
                    <th>{content.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/sponsorships/athlete/${r.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate(`/sponsorships/athlete/${r.id}`)
                        }
                      }}
                    >
                      <td>
                        <span>{r.sponsorName}</span>
                      </td>
                      <td>
                        <span>{r.athlete}</span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--primary-red)' }}>₹{r.amount.toLocaleString('en-IN')}</td>
                      <td>{new Date(r.date).toLocaleDateString('en-IN')}</td>
                      <td>{r.event}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  )
}