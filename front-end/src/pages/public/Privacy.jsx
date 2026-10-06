import PageHero from '../../components/common/PageHero.jsx'
import SectionHeader from '../../components/common/SectionHeader.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'
import { Reveal } from '../../hooks/useReveal.jsx'

export default function Privacy() {
  const { content } = usePageContent('privacy')
  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={renderRichText(content.heroTitle)}
        subtitle={content.heroSubtitle}
        image="https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=1600&auto=format&fit=crop"
      />

      <section className="section section-light">
        <div className="container">
          <div style={{ maxWidth: 800 }}>
            {content.sections.map((section, index) => (
              <Reveal
                key={`${section.heading}-${index}`}
                className="step-form__card"
                style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-6)', boxShadow: 'var(--shadow-sm)' }}
              >
                <h3 className="section-header__title" style={{ fontSize: '1.25rem', marginBottom: 'var(--space-3)' }}>
                  {section.heading}
                </h3>
                <p style={{ color: 'var(--text-light-muted)', lineHeight: 1.7, fontSize: '0.98rem' }}>
                  {section.body}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-dark">
        <div className="container">
          <SectionHeader
            dark
            eyebrow={content.lastUpdatedEyebrow}
            title={renderRichText(content.lastUpdatedTitle)}
            subtitle={content.lastUpdatedSubtitle}
          />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <SecondaryButton to="/contact" size="lg">
              {content.closingCta}
            </SecondaryButton>
          </div>
        </div>
      </section>
    </>
  )
}
