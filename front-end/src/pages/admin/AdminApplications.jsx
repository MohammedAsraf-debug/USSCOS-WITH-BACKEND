import { useState, useEffect, useRef } from 'react'
import { Eye, FileText } from 'lucide-react'
import PageHeader from '../../components/admin/PageHeader.jsx'
import SearchBar from '../../components/common/SearchBar.jsx'
import FilterBar from '../../components/common/FilterBar.jsx'
import Modal from '../../components/common/Modal.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import StatusBadge from '../../components/admin/StatusBadge.jsx'
import { useInbox, useAdminSponsorshipRequest } from '@/hooks/use-firestore'
import { useAdminWorkflow } from '@/hooks/use-admin-workflow'
import { useToast } from '../../context/ToastContext.jsx'
import { fetchPrivateDocument, canAccessPrivateDocuments } from '@/services/private-documents'

const STATUSES = ['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED']

const REQUEST_TYPE_LABELS = {
  athlete: 'INDIVIDUAL FIGHTER',
  group: 'ACADEMY / TRAINING CENTER',
}

function typeLabel(type) {
  return REQUEST_TYPE_LABELS[type] ?? String(type ?? '—').toUpperCase()
}

function DetailBlock({ title, children }) {
  return (
    <section className="app-detail__card">
      <h4 className="app-detail__section-title">{title}</h4>
      {children}
    </section>
  )
}

function Keyword({ label, value, wide = false, mono = false }) {
  return (
    <div className={wide ? 'app-detail__field app-detail__field--wide' : 'app-detail__field'}>
      <dt className="app-detail__label">{label}</dt>
      <dd className={mono ? 'app-detail__value app-detail__id' : 'app-detail__value'}>{value || '—'}</dd>
    </div>
  )
}

const SOCIAL_LABELS = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  other: 'Other',
}

const SECURE_NOT_CONFIGURED = 'Secure access not configured'

function formatSubmitted(value) {
  return value ? new Date(value).toLocaleDateString('en-IN') : 'Not provided'
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return null
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} bytes`
}

function formatMoney(value) {
  if (value === null || value === undefined) return null
  return `₹${Number(value).toLocaleString('en-IN')}`
}

function valueOrNotProvided(value) {
  if (value === null || value === undefined) return 'Not provided'
  if (typeof value === 'string' && value.trim() === '') return 'Not provided'
  return value
}

function socialMediaText(socialMedia) {
  const entries = Object.entries(socialMedia ?? {})
  if (entries.length === 0) return 'Not provided'
  return entries
    .map(([key, value]) => `${SOCIAL_LABELS[key] ?? key}: ${value}`)
    .join(' · ')
}

function secureAccessState(doc, canAccess) {
  if (doc && (doc.storageRef || doc.fileUrl)) {
    return canAccess ? 'Secure access available' : null
  }
  return 'Document unavailable — applicant must re-upload.'
}

function FullRequestDetail({ record, canAccessDocs }) {
  return (
    <>
      {record.type === 'group' ? (
        <DetailBlock title="Academy / Training Center">
          <dl className="app-detail__grid">
            <Keyword label="Group Name" value={valueOrNotProvided(record.groupName)} />
            <Keyword label="Established Year" value={valueOrNotProvided(record.establishedYear)} />
            <Keyword label="Member Count" value={valueOrNotProvided(record.memberCount)} />
            <Keyword label="Coach Count" value={valueOrNotProvided(record.coachCount)} />
            <Keyword label="Contact Role" value={valueOrNotProvided(record.contactRole)} />
          </dl>
        </DetailBlock>
      ) : (
        <DetailBlock title="Fighter">
          <dl className="app-detail__grid">
            <Keyword label="Full Name" value={valueOrNotProvided(record.fullName)} />
            <Keyword label="Date of Birth" value={valueOrNotProvided(record.dateOfBirth)} />
            <Keyword label="Sport" value={valueOrNotProvided(record.sport)} />
            <Keyword label="Level" value={valueOrNotProvided(record.level)} />
            <Keyword label="Location" value={valueOrNotProvided(record.location)} />
          </dl>
        </DetailBlock>
      )}

      <DetailBlock title="Contact">
        <dl className="app-detail__grid">
          <Keyword label="Contact Person" value={valueOrNotProvided(record.contactPerson)} />
          <Keyword label="Email" value={valueOrNotProvided(record.email)} />
          <Keyword label="Phone" value={valueOrNotProvided(record.phone)} />
          <Keyword label="Organization" value={valueOrNotProvided(record.organization)} />
          <Keyword label="Social Media" value={socialMediaText(record.socialMedia)} wide />
        </dl>
      </DetailBlock>

      <DetailBlock title="Sport / Competition">
        {record.type === 'group' ? (
          <dl className="app-detail__grid">
            <Keyword label="Sport" value={valueOrNotProvided(record.sport)} />
            <Keyword label="Level" value={valueOrNotProvided(record.level)} />
            <Keyword label="Location" value={valueOrNotProvided(record.location)} />
            <Keyword label="Members" value={valueOrNotProvided(record.memberCount)} />
            <Keyword label="Coaches" value={valueOrNotProvided(record.coaches)} wide />
            <Keyword label="Competitions" value={valueOrNotProvided(record.competitions)} wide />
            <Keyword label="Website" value={valueOrNotProvided(record.website)} />
          </dl>
        ) : (
          <dl className="app-detail__grid">
            <Keyword label="Sport" value={valueOrNotProvided(record.sport)} />
            <Keyword label="Level" value={valueOrNotProvided(record.level)} />
            <Keyword label="Current Ranking" value={valueOrNotProvided(record.currentRanking)} />
            <Keyword label="Coach" value={valueOrNotProvided(record.coach)} />
            <Keyword label="Academy" value={valueOrNotProvided(record.academy)} />
            <Keyword label="Achievements" value={valueOrNotProvided(record.majorAchievements)} wide />
            <Keyword label="Upcoming Competitions" value={valueOrNotProvided(record.upcomingCompetitions)} wide />
          </dl>
        )}
      </DetailBlock>

      <DetailBlock title="Sponsorship">
        <dl className="app-detail__grid">
          <Keyword label="Story / Purpose" value={valueOrNotProvided(record.story)} wide />
          <Keyword label="Sponsorship Needs" value={valueOrNotProvided(record.sponsorshipNeeds)} wide />
          <Keyword label="Support Amount Requested" value={formatMoney(record.amountRequested) ?? 'Not provided'} />
        </dl>
      </DetailBlock>

      <DocumentsBlock documents={record.documents} canAccessDocs={canAccessDocs} />
    </>
  )
}

/**
 * Secure, authenticated [VIEW] / [DOWNLOAD] actions for a private applicant
 * document. Both go through `fetchPrivateDocument`, which fetches an
 * authenticated blob - the PHP backend URL is never placed into an `src` /
 * `href` directly and never shown to the caller.
 */
function DocumentActions({ doc }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  const pendingObjectUrl = useRef(null)

  useEffect(() => {
    return () => {
      if (pendingObjectUrl.current) URL.revokeObjectURL(pendingObjectUrl.current)
    }
  }, [])

  const open = async (mode) => {
    setBusy(mode)
    setError(null)
    try {
      const result = await fetchPrivateDocument(doc.storageRef, {
        download: mode === 'download',
      })
      if (!result.ok) {
        setError(result.message || 'Unable to load document')
        return
      }
      const url = URL.createObjectURL(result.blob)
      if (mode === 'download') {
        const a = document.createElement('a')
        a.href = url
        a.download = result.fileName || 'document'
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 0)
      } else {
        pendingObjectUrl.current = url
        setPreview({
          url,
          pdf: (result.contentType || '').toLowerCase() === 'application/pdf' || /\.pdf$/i.test(result.fileName || ''),
        })
      }
    } catch {
      setError('Unable to load document')
    } finally {
      setBusy(null)
    }
  }

  const closePreview = () => {
    if (pendingObjectUrl.current) {
      URL.revokeObjectURL(pendingObjectUrl.current)
      pendingObjectUrl.current = null
    }
    setPreview(null)
  }

  const handlePreviewBackdrop = (e) => {
    if (e.target === e.currentTarget) closePreview()
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={busy !== null}
          onClick={() => open('view')}
        >
          VIEW
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={busy !== null}
          onClick={() => open('download')}
        >
          DOWNLOAD
        </button>
      </div>
      {busy !== null && (
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: '0.85rem', color: 'var(--text-muted, #6c757d)' }}>
          Loading document…
        </p>
      )}
      {error && (
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: '0.85rem', color: 'var(--danger, #e63946)' }} role="alert">
          {error}
        </p>
      )}
      {preview && (
        <div
          className="doc-preview-backdrop"
          role="presentation"
          onClick={handlePreviewBackdrop}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: 'rgba(0,0,0,0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '92vh',
              width: '100%',
              background: '#fff',
              borderRadius: 'var(--radius-sm, 8px)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-1)' }}>
              <button type="button" className="btn btn-sm btn-secondary" onClick={closePreview} aria-label="Close preview">
                Close
              </button>
            </div>
            {preview.pdf ? (
              <iframe
                title={`Preview ${doc.fileName || 'document'}`}
                src={preview.url}
                style={{ width: '100%', height: '78vh', border: 0, background: '#fff' }}
              />
            ) : (
              <img
                src={preview.url}
                alt={`Preview ${doc.fileName || 'document'}`}
                style={{ width: '100%', height: '78vh', objectFit: 'contain', background: '#fff' }}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

function DocumentsBlock({ documents, canAccessDocs }) {
  const docs = documents ?? []
  return (
    <DetailBlock title="Supporting Documents">
      {docs.length > 0 ? (
        <ul className="app-detail__file-list">
          {docs.map((doc, idx) => {
            const secureText = secureAccessState(doc, canAccessDocs)
            const canOpen = Boolean(doc.storageRef) && canAccessDocs
            return (
              <li
                key={`${doc.fileName ?? 'doc'}-${idx}`}
                className="app-detail__file"
                style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}
              >
                <FileText size={16} style={{ color: 'var(--primary-red, #d71920)', marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div className="app-detail__file-name">{doc.fileName || 'Unnamed document'}</div>
                  <dl className="app-detail__grid" style={{ marginTop: '10px' }}>
                    <Keyword label="Category" value={valueOrNotProvided(doc.documentCategory)} />
                    <Keyword label="Document Type" value={valueOrNotProvided(doc.documentType)} />
                    <Keyword label="File Size" value={formatBytes(doc.fileSizeBytes) ?? 'Not provided'} />
                    {secureText ? <Keyword label="Secure Access" value={secureText} /> : null}
                  </dl>
                  {canOpen && <DocumentActions doc={doc} />}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="app-detail__muted">
          No supporting documents attached to this application.
        </p>
      )}
    </DetailBlock>
  )
}

export default function AdminApplications() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [detail, setDetail] = useState(null)
  const { showToast } = useToast()
  const { data: inboxItems, isLoading } = useInbox()
  const { data: fullRecord, refetch: refetchRequest } = useAdminSponsorshipRequest(detail?.id)
  const { run, isAdmin, isPending, actor } = useAdminWorkflow()

  const allRequests = (inboxItems ?? []).filter((i) => i.kind === 'request')

  const applications = allRequests.filter((item) => {
    const matchesSearch =
      !search ||
      item.summary?.toLowerCase().includes(search.toLowerCase()) ||
      typeLabel(item.type).toLowerCase().includes(search.toLowerCase())
    const matchesStatus = status === 'all' || item.status === status
    return matchesSearch && matchesStatus
  })

  const openDetail = (item) => {
    setDetail(item)
  }

  const canAccessDocs = canAccessPrivateDocuments(actor?.role ?? null)

  const changeStatus = async (item, action) => {
    const result = await run({ type: 'request-transition', id: item.id, action })
    if (result.ok) {
      showToast(`Status transitioned: ${action}`, 'success')
      const nextStatus = action === 'review' ? 'REVIEWING' : action === 'approve' ? 'APPROVED' : 'REJECTED'
      setDetail((prev) => (prev && prev.id === item.id ? { ...prev, status: nextStatus } : prev))
      refetchRequest()
    } else {
      showToast(`Transition failed: ${result.reason || 'unauthorized'}`, 'error')
    }
  }

  return (
    <>
      <PageHeader title="Applications" subtitle="Review and manage sponsorship applications." />

      <div className="table-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search applications..." />
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
        <LoadingState label="Loading applications" />
      ) : applications.length === 0 ? (
        <EmptyState title="No applications found" />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Summary</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="data-table__row--clickable" onClick={() => openDetail(app)}>
                  <td style={{ fontWeight: 600 }}>{typeLabel(app.type)}</td>
                  <td><StatusBadge status={app.status ?? 'PENDING'} /></td>
                  <td>{app.summary}</td>
                  <td>{app.createdAt ? new Date(app.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="action-btn" onClick={() => openDetail(app)} aria-label="View application">
                      <Eye size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Application — ${typeLabel(detail.type)}` : ''}
        dark
        className="app-detail-modal"
        footer={
          <PrimaryButton onClick={() => setDetail(null)}>CLOSE</PrimaryButton>
        }
      >
        {detail && (
          <div className="app-detail">
            <section className="app-detail__card" aria-label="Application overview">
              <h4 className="app-detail__section-title">Application</h4>
              <dl className="app-detail__grid">
                <div className="app-detail__field">
                  <dt className="app-detail__label">Application ID</dt>
                  <dd className="app-detail__value app-detail__id">{fullRecord?.id ?? detail.id}</dd>
                </div>
                <div className="app-detail__field">
                  <dt className="app-detail__label">Type</dt>
                  <dd className="app-detail__value">{typeLabel(fullRecord?.type ?? detail.type)}</dd>
                </div>
                <div className="app-detail__field">
                  <dt className="app-detail__label">Status</dt>
                  <dd className="app-detail__value"><StatusBadge status={(fullRecord?.status ?? detail.status) ?? 'PENDING'} /></dd>
                </div>
                <div className="app-detail__field">
                  <dt className="app-detail__label">Submitted</dt>
                  <dd className="app-detail__value">{formatSubmitted(fullRecord?.createdAt ?? detail.createdAt)}</dd>
                </div>
              </dl>
            </section>

            {fullRecord ? (
              <FullRequestDetail record={fullRecord} canAccessDocs={canAccessDocs} />
            ) : (
              <>
                <DetailBlock title="Summary">
                  <p className="app-detail__value" style={{ lineHeight: 1.7 }}>
                    {detail.summary || 'No summary available'}
                  </p>
                </DetailBlock>

                <DetailBlock title="Supporting Documents">
                  {detail.documents && detail.documents.length > 0 ? (
                    <ul className="app-detail__file-list">
                      {detail.documents.map((doc, idx) => (
                        <li
                          key={`${doc}-${idx}`}
                          className="app-detail__file"
                          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                        >
                          <FileText size={16} style={{ color: 'var(--primary-red, #d71920)' }} />
                          <span className="app-detail__file-name">{doc}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="app-detail__muted">
                      No supporting documents attached to this application.
                    </p>
                  )}
                </DetailBlock>
              </>
            )}

            {isAdmin && (
              <DetailBlock title="Actions">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={isPending || (detail.status ?? 'PENDING') === 'REVIEWING' || (detail.status ?? 'PENDING') === 'APPROVED' || (detail.status ?? 'PENDING') === 'REJECTED'}
                    onClick={() => changeStatus(detail, 'review')}
                  >
                    Start Review
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={isPending || (detail.status ?? '') !== 'REVIEWING'}
                    onClick={() => changeStatus(detail, 'approve')}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-sm btn-secondary"
                    disabled={isPending || (detail.status ?? 'PENDING') === 'APPROVED' || (detail.status ?? 'PENDING') === 'REJECTED'}
                    onClick={() => changeStatus(detail, 'reject')}
                  >
                    Reject
                  </button>
                </div>
              </DetailBlock>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
