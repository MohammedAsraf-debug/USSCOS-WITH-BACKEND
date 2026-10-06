import { Link } from 'react-router-dom'
import { ShieldCheck, ClipboardList, ArrowRight } from 'lucide-react'
import PageHeader from '../../components/admin/PageHeader.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'

export default function AdminDocuments() {
  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Supporting documents and verification records attached to sponsorship applications."
      />

      <div
        className="admin-card"
        style={{ maxWidth: '820px', padding: 'var(--space-5, 20px)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3, 12px)' }}>
          <div
            style={{
              color: 'var(--primary, #e63946)',
              paddingTop: '3px',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 var(--space-2, 8px) 0', fontSize: '1rem', fontWeight: 600 }}>
              How supporting documents are handled
            </h4>
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: 'var(--text-muted, #8b949e)',
                lineHeight: 1.6,
              }}
            >
              Sponsorship applications can record supporting documents (proof of identity,
              achievement certificates, medical fitness certificate). Those records are private to the
              application and are reviewed inline while processing the request. The current USSCOS
              requirements and data model do not define a standalone document library, so this page
              replaces that placeholder with an accurate overview instead.
            </p>
          </div>
        </div>

        <ul
          style={{
            margin: 'var(--space-4, 16px) 0 var(--space-3, 12px) 0',
            paddingLeft: 'var(--space-4, 16px)',
            fontSize: '0.875rem',
            color: 'var(--text-muted, #8b949e)',
            lineHeight: 1.6,
          }}
        >
          <li style={{ marginBottom: 'var(--space-2, 8px)' }}>
            <strong>Review documents:</strong> attached files for each application are listed under
            &ldquo;Supporting Documents&rdquo; in the application detail view at{' '}
            <Link to="/admin/applications" style={{ color: 'var(--primary, #e63946)' }}>
              Admin &rarr; Applications
            </Link>
            .
          </li>
          <li style={{ marginBottom: 'var(--space-2, 8px)' }}>
            <strong>No standalone uploads:</strong> applicant documents are private records. The current
            media upload path (Cloudinary unsigned uploads) delivers public, image/video-only URLs, so
            it is deliberately not used for private documents. Private document upload would require
            signed/authenticated storage and is kept out of scope rather than weakening that boundary.
          </li>
          <li>
            <strong>No Firestore changes:</strong> the data model has no <code>documents</code>{' '}
            collection; document metadata stays on the application record it belongs to.
          </li>
        </ul>

        <div style={{ padding: 'var(--space-2, 8px) 0 0' }}>
          <div className="admin-card" aria-hidden="true">
            <EmptyState
              title="No standalone document library"
              description="Documents are reviewed as part of application processing."
            />
          </div>
        </div>

        <Link
          to="/admin/applications"
          className="btn btn-sm btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <ClipboardList size={16} />
          <span>Open Applications</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </>
  )
}