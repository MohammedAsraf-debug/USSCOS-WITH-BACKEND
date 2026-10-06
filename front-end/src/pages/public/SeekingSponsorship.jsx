import {
  FileText,
  CheckCircle,
  ClipboardCheck,
  BadgeCheck,
  HeartHandshake,
  UserCheck,
  Calendar,
  Wallet,
  User,
  GraduationCap,
  ArrowRight,
} from 'lucide-react'
import PageHero from '../../components/common/PageHero.jsx'
import SectionHeader from '../../components/common/SectionHeader.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'
import { Reveal } from '../../hooks/useReveal.jsx'

const stepIcons = [FileText, ClipboardCheck, BadgeCheck, HeartHandshake]
const eligibilityIcons = [UserCheck, Calendar, Wallet, BadgeCheck]

export default function SeekingSponsorship() {
  const { content } = usePageContent('seeking-sponsorship')
  const { content: eligibilityContent } = usePageContent('seeking-sponsorship-eligibility')
  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={renderRichText(content.heroTitle)}
        subtitle={content.heroSubtitle}
        image="https://images.unsplash.com/photo-1517466787929-bc90951d0974?q=80&w=1600&auto=format&fit=crop"
      />

      {/* Choose your application — the two application paths */}
      <section className="section section-light">
        <div className="container">
          <SectionHeader
            eyebrow={content.applyEyebrow}
            title={renderRichText(content.applyTitle)}
            subtitle={content.applySubtitle}
          />
          <div className="support-grid">
            <div className="support-card">
              <span className="support-card__icon">
                <User size={26} />
              </span>
              <div>
                <h3>{content.fighterCardTitle}</h3>
                <p>{content.fighterCardText}</p>
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <PrimaryButton to="/apply" size="lg">
                    {content.fighterCardCta} <ArrowRight size={18} />
                  </PrimaryButton>
                </div>
              </div>
            </div>
            <div className="support-card">
              <span className="support-card__icon">
                <GraduationCap size={26} />
              </span>
              <div>
                <h3>{content.academyCardTitle}</h3>
                <p>{content.academyCardText}</p>
                <div style={{ marginTop: 'var(--space-4)' }}>
                  <PrimaryButton to="/apply/academy" size="lg">
                    {content.academyCardCta} <ArrowRight size={18} />
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How the process works — dark */}
      <section className="section section-dark">
        <div className="container">
          <SectionHeader
            dark
            eyebrow={content.processEyebrow}
            title={renderRichText(content.processTitle)}
            subtitle={content.processSubtitle}
          />
          <div className="steps-grid">
            {content.steps.map((step, index) => {
              const Icon = stepIcons[index] ?? FileText
              return (
                <div className="step-card" key={`${step.title}-${index}`}>
                  <div className="step-card__number">{String(index + 1).padStart(2, '0')}</div>
                  <span className="step-card__icon">
                    <Icon size={24} />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Eligibility â€” light */}
      <section className="section section-light">
        <div className="container">
          <SectionHeader
            eyebrow={eligibilityContent.eligibilityEyebrow}
            title={renderRichText(eligibilityContent.eligibilityTitle)}
            subtitle={eligibilityContent.eligibilitySubtitle}
          />
          <div className="impact-grid">
            {eligibilityContent.eligibility.map((item, index) => {
              const Icon = eligibilityIcons[index] ?? BadgeCheck
              return (
                <div className="value-card" key={`${item.title}-${index}`}>
                  <div className="value-card__icon">
                    <Icon size={24} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              )
            })}
          </div>

          <div className="spacer-md"></div>

          <SectionHeader
            eyebrow={eligibilityContent.docsEyebrow}
            title={renderRichText(eligibilityContent.docsTitle)}
          />
          <ul className="doc-list">
            {eligibilityContent.requiredDocs.map((doc, index) => (
              <li key={`${doc.title}-${index}`}>
                <CheckCircle size={20} />
                <div>
                  <strong>{doc.title}</strong>
                  <span>{doc.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="final-cta section">
        <div className="final-cta__bg">
          <img
            src="https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=1600&auto=format&fit=crop"
            alt=""
            aria-hidden="true"
          />
          <div className="final-cta__overlay"></div>
        </div>
        <div className="container final-cta__container">
          <Reveal>
            <h2>{renderRichText(eligibilityContent.ctaTitle)}</h2>
            <p>{eligibilityContent.ctaText}</p>
            <div className="final-cta__buttons">
              <PrimaryButton to="/apply" size="lg">
                {eligibilityContent.ctaFighterCta}
              </PrimaryButton>
              <PrimaryButton to="/apply/academy" size="lg">
                {eligibilityContent.ctaAcademyCta}
              </PrimaryButton>
              <SecondaryButton to="/contact" size="lg" dark>
                {eligibilityContent.ctaAskCta}
              </SecondaryButton>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}