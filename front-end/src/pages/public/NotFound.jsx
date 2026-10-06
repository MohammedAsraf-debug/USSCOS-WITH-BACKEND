import PageHero from '../../components/common/PageHero.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'

export default function NotFound() {
  const { content } = usePageContent('not-found')

  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={renderRichText(content.heroTitle)}
        subtitle={content.heroSubtitle}
        image="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1600&auto=format&fit=crop"
      />
      <section className="section section-light">
        <div className="container">
          <div className="success-screen">
            <h2 style={{ fontSize: '3rem', fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--primary-red)' }}>
              {content.code}
            </h2>
            <p>{content.message}</p>
            <div className="hero__buttons" style={{ justifyContent: 'center' }}>
              <PrimaryButton to="/">{content.primaryCta}</PrimaryButton>
              <SecondaryButton to="/athletes" dark>
                {content.secondaryCta}
              </SecondaryButton>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
