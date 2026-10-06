import { ArrowRight, ExternalLink, LayoutTemplate, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/admin/PageHeader.jsx'
import { CONTENT_PAGES } from '../../features/admin/content-pages.js'

export default function AdminContent() {
  return (
    <>
      <PageHeader
        title="Website Content"
        subtitle="Choose a public page to edit its page-level copy. Changes go live immediately."
      />

      <div className="content-pages-grid">
        {CONTENT_PAGES.map((page) => (
          <div className="content-page-card" key={page.id}>
            <div className="content-page-card__head">
              <span className="content-page-card__icon" aria-hidden="true">
                <LayoutTemplate size={18} />
              </span>
              <div>
                <h3>{page.label}</h3>
                <span className="content-page-card__route">{page.route}</span>
              </div>
            </div>

            <p className="content-page-card__desc">{page.description}</p>

            <div className="content-page-card__tags">
              {page.blocks.map((block) => (
                <span className="content-page-card__tag" key={block.id}>
                  {block.title}
                </span>
              ))}
            </div>

            <div className="content-page-card__actions">
              <Link className="content-page-card__edit" to={`/admin/content/${page.id}`}>
                <Pencil size={15} /> Edit content <ArrowRight size={15} />
              </Link>
              <a
                className="content-page-card__view"
                href={page.route}
                target="_blank"
                rel="noreferrer"
              >
                View page <ExternalLink size={14} />
              </a>
            </div>

            {page.manage?.length > 0 && (
              <div className="content-page-card__manage">
                {page.manage.map((link) => (
                  <Link key={link.to} to={link.to} className="content-page-card__manage-link">
                    {link.label} <ArrowRight size={13} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
