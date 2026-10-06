import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import PageHero from '../../components/common/PageHero.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import { usePublicOpportunities } from '@/hooks/use-firestore'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'
import { Reveal } from '../../hooks/useReveal.jsx'

export default function SponsorshipOpportunities() {
  const navigate = useNavigate()
  const { data: opportunities, isLoading, isError } = usePublicOpportunities()
  const { content } = usePageContent('sponsorship-opportunities')

  const handleNavigate = (opp) => {
    if (opp.primaryRef?.kind === 'athlete' && opp.primaryRef?.id) {
      navigate(`/athletes/${opp.primaryRef.id}`)
    } else if (opp.primaryRef?.kind === 'group' && opp.primaryRef?.id) {
      navigate(`/sponsorships/academy/${opp.primaryRef.id}`)
    }
  }

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
          {isLoading ? (
            <LoadingState label={content.loadingLabel} />
          ) : isError ? (
            <EmptyState title={content.errorTitle} description={content.errorDescription} />
          ) : !opportunities || opportunities.length === 0 ? (
            <EmptyState
              title={content.emptyTitle}
              description={content.emptyDescription}
            />
          ) : (
            <Reveal stagger className="sponsorships-grid">
              {opportunities.map((opp) => (
                <article
                  className="sponsor-record"
                  key={opp.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${opp.title}`}
                  style={{ cursor: opp.primaryRef ? 'pointer' : 'default' }}
                  onClick={() => handleNavigate(opp)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleNavigate(opp)
                    }
                  }}
                >
                  <div className="sponsor-record__head">
                    <div>
                      <h3>{opp.title}</h3>
                      <p>{opp.type === 'athlete' ? content.typeFighterLabel : opp.type === 'group' ? content.typeGroupLabel : opp.type === 'event' ? content.typeEventLabel : content.typeGeneralLabel}</p>
                    </div>
                    {opp.primaryRef?.name && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-light-muted)' }}>
                        {opp.primaryRef.name}
                      </span>
                    )}
                  </div>
                  <div className="sponsor-record__rows">
                    {opp.needs && opp.needs.length > 0 && opp.needs.map((need) => (
                      <div className="sponsor-record__row" key={need.kind}>
                        <span>{need.kind}</span>
                        <span style={{ color: 'var(--primary-red)', fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
                          {need.amount || content.anyAmountLabel}
                        </span>
                      </div>
                    ))}
                    {opp.closesAt && (
                      <div className="sponsor-record__row">
                        <span>{content.closesLabel}</span>
                        <span>{new Date(opp.closesAt).toLocaleDateString('en-IN')}</span>
                      </div>
                    )}
                  </div>
                  {opp.description && (
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-light-muted)', lineHeight: 1.6 }}>
                      <ExternalLink size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                      {opp.description.length > 120 ? opp.description.slice(0, 120) + '...' : opp.description}
                    </p>
                  )}
                </article>
              ))}
            </Reveal>
          )}
        </div>
      </section>
    </>
  )
}
