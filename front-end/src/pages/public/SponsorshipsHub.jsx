import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { Reveal } from '../../hooks/useReveal.jsx'
import SectionHeader from '../../components/common/SectionHeader.jsx'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'
import {
  Users,
  HeartHandshake,
  ChevronRight,
  Shield,
  HandCoins,
  Dumbbell,
  Plane,
  Target,
  ArrowUpRight,
} from 'lucide-react'

const HERO_IMG =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1600&auto=format&fit=crop'
const CTA_IMG =
  'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?q=80&w=1600&auto=format&fit=crop'

const SUPPORT_WAY_META = [
  { index: '01', icon: HandCoins, to: '/sponsorships/sponsor' },
  { index: '02', icon: Dumbbell, to: '/seeking-sponsorship' },
  { index: '03', icon: HeartHandshake, to: '/donate' },
]
const SUPPORT_AREA_ICONS = [Dumbbell, Shield, Plane, Target, Users, HandCoins]
const BENEFIT_ICONS = [HandCoins, Users, HeartHandshake]

export default function SponsorshipsHub() {
  const navigate = useNavigate()
  const { content } = usePageContent('sponsorships')
  const { content: how } = usePageContent('sponsorships-how')

  const go = (path) => () => navigate(path)

  const supportWays = content.supportWays.map((item, index) => {
    const meta = SUPPORT_WAY_META[index] ?? SUPPORT_WAY_META[SUPPORT_WAY_META.length - 1];
    // Destinations stay pinned to registered routes: CMS copy (title/text/
    // linkLabel) is honored, but a stored `to` must never override where a
    // panel navigates (staff-editable content must not create dead or
    // external navigation targets).
    const copy = item !== null && typeof item === 'object' ? item : {};
    return {
      title: copy.title,
      text: copy.text,
      linkLabel: copy.linkLabel,
      index: meta.index,
      icon: meta.icon,
      to: meta.to,
    };
  })

  const process = how.process.map((step, index) => ({
    num: String(index + 1).padStart(2, '0'),
    ...step,
  }))

  const supportAreas = how.supportAreas.map((item, index) => ({
    icon: SUPPORT_AREA_ICONS[index] ?? Target,
    ...item,
  }))

  const benefits = how.benefits.map((item, index) => ({
    icon: BENEFIT_ICONS[index] ?? HandCoins,
    ...item,
  }))

  return (
    <>
      {/* HERO */}
      <section className="page-hero sponsorships-hero">
        <div className="page-hero__bg">
          <img src={HERO_IMG} alt="" aria-hidden="true" />
          <div className="page-hero__overlay"></div>
        </div>
        <div className="container page-hero__container">
          <Reveal>
            <span className="eyebrow">{content.heroEyebrow}</span>
            <h1>{renderRichText(content.heroTitle, 'accent-light')}</h1>
            <p className="sponsorships-hero__lead">{content.heroSubtitle}</p>
            <div className="sponsorships-hero__actions">
              <button onClick={go('/sponsorships/sponsor')} className="btn btn-primary btn-lg">
                {content.heroSponsorCta}
                <ChevronRight size={20} />
              </button>
              <button
                onClick={go('/seeking-sponsorship')}
                className="btn btn-secondary btn-lg"
              >
                {content.heroSeekCta}
                <ChevronRight size={20} />
              </button>
              <button onClick={go('/donate')} className="btn btn-outline-red btn-lg">
                {content.heroDonateCta}
                <ChevronRight size={20} />
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* WAYS TO SUPPORT */}
      <section className="section section-light">
        <div className="container">
          <SectionHeader
            align="center"
            eyebrow={content.waysEyebrow}
            title={renderRichText(content.waysTitle)}
            subtitle={content.waysSubtitle}
          />
          <div className="sponsorships-panels">
            {supportWays.map((item) => {
              const Icon = item.icon
              return (
                <article className="sponsorships-panel" key={item.title}>
                  <div className="sponsorships-panel__top">
                    <span className="sponsorships-panel__icon">
                      <Icon size={24} />
                    </span>
                    <span className="sponsorships-panel__index">{item.index}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <button className="sponsorships-panel__link" onClick={go(item.to)}>
                    {item.linkLabel}
                    <ArrowUpRight size={18} />
                  </button>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section section-dark">
        <div className="container">
          <SectionHeader
            dark
            align="center"
            eyebrow={how.howEyebrow}
            title={renderRichText(how.howTitle, 'accent-light')}
            subtitle={how.howSubtitle}
          />
          <div className="sponsorships-process">
            {process.map((step, i) => {
              const { num, title, text } = step
              return (
                <Fragment key={num}>
                  {i > 0 && (
                    <span className="sponsorships-process__arrow" aria-hidden="true">
                      <ChevronRight size={26} />
                    </span>
                  )}
                  <article className="sponsorships-process__step">
                    <span className="sponsorships-process__num">{num}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </article>
                </Fragment>
              )
            })}
          </div>
        </div>
      </section>

      {/* WHERE YOUR SUPPORT GOES */}
      <section className="section section-light">
        <div className="container">
          <SectionHeader
            align="center"
            eyebrow={how.goesEyebrow}
            title={renderRichText(how.goesTitle)}
            subtitle={how.goesSubtitle}
          />
          <div className="sponsorships-support">
            {supportAreas.map((item) => {
              const Icon = item.icon
              return (
                <article className="sponsorships-support__item" key={item.title}>
                  <span className="sponsorships-support__icon">
                    <Icon size={20} />
                  </span>
                  <div className="sponsorships-support__text">
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* WHY SPONSOR USSCOS */}
      <section className="section section-dark">
        <div className="container">
          <div className="sponsorships-split">
            <Reveal className="sponsorships-split__statement">
              <span className="eyebrow">{how.whyEyebrow}</span>
              <h2>{renderRichText(how.whyTitle, 'accent-light')}</h2>
              <p>{how.whyText}</p>
            </Reveal>
            <div className="sponsorships-split__benefits">
              {benefits.map((item) => {
                const Icon = item.icon
                return (
                  <article className="sponsorships-split__benefit" key={item.title}>
                    <span className="sponsorships-split__icon">
                      <Icon size={22} />
                    </span>
                    <div className="sponsorships-split__text">
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-cta">
        <div className="final-cta__bg">
          <img src={CTA_IMG} alt="" aria-hidden="true" />
          <div className="final-cta__overlay"></div>
        </div>
        <div className="container final-cta__container">
          <Reveal>
            <span className="eyebrow eyebrow-center">{how.ctaEyebrow}</span>
            <h2>{renderRichText(how.ctaTitle, 'accent-light')}</h2>
            <p>{how.ctaText}</p>
            <div className="final-cta__buttons">
              <button onClick={go('/sponsorships/sponsor')} className="btn btn-primary btn-lg">
                {how.ctaSponsorCta}
                <ChevronRight size={20} />
              </button>
              <button onClick={go('/seeking-sponsorship')} className="btn btn-secondary btn-lg">
                {how.ctaSeekCta}
                <ChevronRight size={20} />
              </button>
              <button onClick={go('/donate')} className="btn btn-outline-red btn-lg">
                {how.ctaDonateCta}
                <ChevronRight size={20} />
              </button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}