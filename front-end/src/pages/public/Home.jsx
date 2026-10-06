import { Link } from 'react-router-dom'
import {
  Users,
  Globe,
  Trophy,
  Handshake,
  HeartPulse,
  Target,
  Eye,
  Shield,
  Dumbbell,
  Utensils,
  Backpack,
  Plane,
  GraduationCap,
  ArrowRight,
  Heart,
} from 'lucide-react'
import { Reveal } from '../../hooks/useReveal.jsx'
import HeroSlideshow from '../../components/public/HeroSlideshow.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import SectionHeader from '../../components/common/SectionHeader.jsx'
import StatCard from '../../components/public/StatCard.jsx'
import AthleteCard from '../../components/public/AthleteCard.jsx'
import EventCard from '../../components/public/EventCard.jsx'
import NewsCard from '../../components/public/NewsCard.jsx'
import TestimonialCard from '../../components/public/TestimonialCard.jsx'
import { testimonials as defaultTestimonials } from '../../data/siteContent.js'
import { usePublicAthletes, usePublicStories, usePublicEvents, usePublicPartners } from '@/hooks/use-firestore'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'

const supportIconList = [Dumbbell, Utensils, Backpack, Plane, GraduationCap]
const valueIcons = [Target, Eye, Shield]

const testimonialAvatars = defaultTestimonials.reduce((acc, item) => {
  acc[item.name] = item.avatar
  return acc
}, {})
const fallbackAvatar = defaultTestimonials[0]?.avatar ?? ''

export default function Home() {
  const { data: athletesData } = usePublicAthletes()
  const { data: eventsData } = usePublicEvents()
  const { data: storiesData } = usePublicStories()
  const { data: partnersData } = usePublicPartners()
  const { content: hero } = usePageContent('homepage')
  const { content: aboutPreview } = usePageContent('home-about')
  const { content: sections } = usePageContent('home-sections')
  const { content: finalCta } = usePageContent('home-final-cta')
  const { content: statsNow } = usePageContent('stats')

  const statItems = [
    { value: statsNow.livesImpacted, label: 'Lives Impacted', icon: Heart },
    { value: statsNow.athletesSupported, label: 'Fighters Supported', icon: Users },
    { value: statsNow.countriesReached, label: 'Countries Reached', icon: Globe },
    { value: statsNow.eventsOrganized, label: 'Events Organized', icon: Trophy },
    { value: statsNow.activeSponsors, label: 'Active Sponsors', icon: Handshake },
  ]

  const impactStats = [
    { value: statsNow.livesImpacted, label: 'Lives Impacted', icon: Heart },
    { value: statsNow.volunteers, label: 'Volunteers', icon: Users },
    { value: statsNow.projects, label: 'Projects', icon: Target },
    { value: statsNow.communities, label: 'Communities', icon: Globe },
  ]

  const athletes = (athletesData ?? []).slice(0, 4).map((a) => ({
    id: a.slug,
    name: a.fullName,
    sport: a.sport,
    image: a.profileImageUrl,
    location: '',
  }))

  const upcomingEvts = (eventsData ?? []).filter((e) => e.status === 'upcoming').map((e) => {
    const d = new Date(e.date)
    return {
      id: e.id,
      day: String(d.getDate()),
      month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      title: e.title,
      location: e.location ?? '',
      date: d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
    }
  })

  const latestNews = (storiesData ?? []).slice(0, 3).map((s) => ({
    id: s.slug,
    title: s.title,
    excerpt: s.excerpt ?? '',
    image: s.coverImageUrl ?? '',
    category: s.tags?.[0] ?? 'News',
    date: s.publishedAt ?? '',
  }))

  const partnerNames = (partnersData ?? []).map((p) => p.name).filter(Boolean)

  return (
    <>
      {/* SECTION 1: HERO */}
      <section className="hero" aria-label="Hero">
        <HeroSlideshow />

        <div className="container hero__container">
          <div>
            <Reveal>
              <span className="hero__eyebrow">
                <span className="hero__eyebrow-line"></span>
                {hero.heroEyebrow}
              </span>
              <h1 className="hero__title">{renderRichText(hero.heroTitle)}</h1>
              <p className="hero__subtitle">{hero.heroParagraph}</p>
              <div className="hero__buttons">
                <PrimaryButton to="/donate" size="lg">
                  {hero.heroPrimaryCta}
                </PrimaryButton>
                <SecondaryButton to="/athletes" size="lg">
                  {hero.heroSecondaryCta}
                </SecondaryButton>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* SECTION 2: STATISTICS BAR */}
      <section className="stats-bar" aria-label="Statistics">
        <div className="container">
          <div className="stats-bar__grid">
            {statItems.map((stat) => (
              <StatCard key={stat.label} value={stat.value} label={stat.label} icon={stat.icon} dark />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: ABOUT PREVIEW */}
      <section className="section section-light">
        <div className="container">
          <Reveal className="about-preview">
            <div>
              <span className="eyebrow">{aboutPreview.aboutEyebrow}</span>
              <h2 className="about-preview__heading">{renderRichText(aboutPreview.aboutTitle)}</h2>
              <p className="about-preview__text">{aboutPreview.aboutText}</p>
              <SecondaryButton to="/about" dark>
                {aboutPreview.aboutCtaLabel} <ArrowRight size={18} />
              </SecondaryButton>
            </div>
            <div className="value-cards">
              {aboutPreview.valueCards.map((card, index) => {
                const Icon = valueIcons[index] ?? valueIcons[valueIcons.length - 1]
                return (
                  <div className="value-card" key={`${card.title}-${index}`}>
                    <div className="value-card__icon">
                      <Icon size={24} />
                    </div>
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
                  </div>
                )
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 4: RISING STARS */}
      <section className="section section-dark">
        <div className="container">
          <div className="section-intro">
            <SectionHeader
              dark
              eyebrow={sections.risingEyebrow}
              title={renderRichText(sections.risingTitle)}
            />
            <Reveal style={{ textAlign: 'right' }}>
              <Link to="/athletes" className="link-arrow-dark">
                {sections.risingLinkLabel} <ArrowRight size={18} />
              </Link>
            </Reveal>
          </div>
          <Reveal stagger className="athletes-grid">
            {athletes.map((athlete) => (
              <AthleteCard key={athlete.id} athlete={athlete} compact />
            ))}
          </Reveal>
        </div>
      </section>

      {/* SECTION 5: OUR IMPACT */}
      <section className="section section-light">
        <div className="container">
          <SectionHeader
            center
            eyebrow={sections.impactEyebrow}
            title={renderRichText(sections.impactTitle)}
          />
          <Reveal stagger className="impact-grid">
            {impactStats.map((stat) => (
              <StatCard key={stat.label} value={stat.value} label={stat.label} icon={stat.icon} light />
            ))}
          </Reveal>
        </div>
      </section>

      {/* SECTION 6: HOW YOUR SUPPORT HELPS */}
      <section className="section section-white">
        <div className="container">
          <SectionHeader
            eyebrow={sections.supportEyebrow}
            title={renderRichText(sections.supportTitle)}
            subtitle={sections.supportSubtitle}
          />
          <Reveal stagger className="support-grid">
            {sections.supportCategories.map((cat, index) => {
              const Icon = supportIconList[index] ?? Target
              return (
                <div className="support-card" key={`${cat.title}-${index}`}>
                  <div className="support-card__icon">
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3>{cat.title}</h3>
                    <p>{cat.description}</p>
                  </div>
                </div>
              )
            })}
          </Reveal>
        </div>
      </section>

      {/* SECTION 7: UPCOMING EVENTS */}
      <section className="section section-dark">
        <div className="container">
          <SectionHeader
            dark
            eyebrow={sections.eventsEyebrow}
            title={renderRichText(sections.eventsTitle)}
            subtitle={sections.eventsSubtitle}
          />
          <Reveal stagger className="events-grid">
            {upcomingEvts.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </Reveal>
        </div>
      </section>

      {/* SECTION 8: OUR SPONSORS */}
      <section className="section section-light">
        <div className="container">
          <SectionHeader
            center
            eyebrow={sections.sponsorsEyebrow}
            title={renderRichText(sections.sponsorsTitle)}
          />
          <Reveal stagger className="sponsors-grid">
            {partnerNames.map((name) => (
              <div className="sponsor-card" key={name}>
                {name}
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* SECTION 9: TESTIMONIALS */}
      <section className="section section-light">
        <div className="container">
          <SectionHeader
            center
            eyebrow={sections.testimonialsEyebrow}
            title={renderRichText(sections.testimonialsTitle)}
          />
          <Reveal stagger className="testimonials-grid">
            {sections.testimonials.map((testimonial, index) => (
              <TestimonialCard
                key={`${testimonial.name}-${index}`}
                testimonial={{
                  ...testimonial,
                  avatar: testimonialAvatars[testimonial.name] ?? fallbackAvatar,
                }}
              />
            ))}
          </Reveal>
        </div>
      </section>

      {/* SECTION 10: FINAL CTA */}
      <section className="final-cta section">
        <div className="final-cta__bg">
          <img
            src="https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=1600&auto=format&fit=crop"
            alt=""
            aria-hidden="true"
          />
          <div className="final-cta__overlay"></div>
        </div>
        <div className="container final-cta__container">
          <Reveal>
            <h2>{renderRichText(finalCta.finalCtaTitle)}</h2>
            <p>{finalCta.finalCtaParagraph}</p>
            <div className="final-cta__buttons">
              <PrimaryButton to="/donate" size="lg">
                {finalCta.finalCtaPrimaryCta} <ArrowRight size={18} />
              </PrimaryButton>
              <SecondaryButton to="/seeking-sponsorship" size="lg">
                {finalCta.finalCtaSecondaryCta}
              </SecondaryButton>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION 11: LATEST NEWS (bonus link to news) */}
      <section className="section section-dark">
        <div className="container">
          <div className="section-intro">
            <SectionHeader
              dark
              eyebrow={sections.newsEyebrow}
              title={renderRichText(sections.newsTitle)}
            />
            <Reveal style={{ textAlign: 'right' }}>
              <Link to="/news" className="link-arrow-dark">
                {sections.newsLinkLabel} <ArrowRight size={18} />
              </Link>
            </Reveal>
          </div>
          <Reveal stagger className="news-grid">
            {latestNews.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </Reveal>
        </div>
      </section>
    </>
  )
}