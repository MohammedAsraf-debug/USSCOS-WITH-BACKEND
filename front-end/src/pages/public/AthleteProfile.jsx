import { useParams } from 'react-router-dom'
import {
  Calendar,
  Medal,
  Trophy,
  Dumbbell,
  ArrowRight,
  CheckCircle,
} from 'lucide-react'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import SectionHeader from '../../components/common/SectionHeader.jsx'
import { usePublicAthlete } from '@/hooks/use-firestore'
import { Reveal } from '../../hooks/useReveal.jsx'

export default function AthleteProfile() {
  const { id } = useParams()
  const { data: athlete, isLoading } = usePublicAthlete(id ?? '')

  if (isLoading) {
    return (
      <section className="section section-dark">
        <LoadingState label="Loading fighter profile" />
      </section>
    )
  }

  const sponsorUrl = `/sponsorships/sponsor?type=athlete&athlete=${encodeURIComponent(id)}`

  if (!athlete) {
    return (
      <section className="section section-light">
        <div className="container">
          <EmptyState
            title="Fighter not found"
            description="The fighter you're looking for doesn't exist or has been removed."
          />
          <div style={{ textAlign: 'center' }}>
            <SecondaryButton to="/athletes" dark>
              BACK TO FIGHTERS
            </SecondaryButton>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      {/* Hero */}
      <section className="athlete-profile-hero">
        <div className="athlete-profile-hero__bg">
          <img src={athlete.profileImageUrl ?? ''} alt="" aria-hidden="true" />
        </div>
        <div className="container athlete-profile-hero__content">
          <span className="athlete-profile-hero__sport-tag">{athlete.sport}</span>
          <h1>{athlete.fullName}</h1>
          <div className="athlete-profile-hero__meta">
            {athlete.record && (
              <span className="athlete-profile-hero__meta-item">
                <Trophy size={18} /> {athlete.record}
              </span>
            )}
            {athlete.level && (
              <span className="athlete-profile-hero__meta-item">
                <Medal size={18} /> {athlete.level}
              </span>
            )}
          </div>
          <div className="hero__buttons">
            <PrimaryButton to={sponsorUrl} size="lg">
              SUPPORT THIS FIGHTER
            </PrimaryButton>
            <SecondaryButton to="/seeking-sponsorship" size="lg">
              SPONSORSHIP DETAILS
            </SecondaryButton>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="section section-light">
        <div className="container">
          <SectionHeader
            eyebrow="About"
            title={
              <>
                The Journey of <span className="accent">{athlete.fullName}</span>
              </>
            }
          />
          <div className="info-row">
            <div className="info-block">
              <h3>Biography</h3>
              <p style={{ lineHeight: '1.75', color: 'var(--text-light-muted)' }}>{athlete.biography ?? 'No biography available.'}</p>
            </div>
            <div className="info-block">
              <h3>Discipline Details</h3>
              <ul>
                <li>
                  <Dumbbell size={18} /> {athlete.sport}
                </li>
                {athlete.level && (
                  <li>
                    <Trophy size={18} /> {athlete.level}
                  </li>
                )}
                {athlete.record && (
                  <li>
                    <Medal size={18} /> Record: {athlete.record}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ACHIEVEMENTS + UPCOMING EVENTS */}
      <section className="section section-dark">
        <div className="container">
          <div className="section-intro">
            <div style={{ width: '100%' }}>
              <SectionHeader
                dark
                eyebrow="Achievements"
                title={
                  <>
                    Major <span className="accent">Wins</span>
                  </>
                }
              />
              <ul className="achievement-list">
                {(athlete.achievements ?? []).map((a, i) => (
                  <li key={a.title ?? i}>
                    <Medal size={20} />
                    <span>{a.title}{a.year ? ` (${a.year})` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ width: '100%' }}>
              <SectionHeader
                dark
                eyebrow="Competition History"
                title={
                  <>
                    Past <span className="accent">Competitions</span>
                  </>
                }
              />
              <ul className="competition-list">
                {(athlete.competitionHistory ?? []).map((c, i) => (
                  <li key={c.event ?? i}>
                    <Calendar size={20} />
                    <div>
                      <strong>{c.event ?? 'Competition'}</strong>
                      <span>{c.result ?? ''}{c.date ? ` — ${c.date}` : ''}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SPONSORSHIP REQUIREMENTS */}
      <section className="section section-light">
        <div className="container">
          <SectionHeader
            eyebrow="Sponsorship Requirements"
            title={
              <>
                How Support <span className="accent">Helps {athlete.fullName.split(' ')[0]}</span>
              </>
            }
          />
          <div className="info-row">
            <div className="info-block">
              <h3>Funding Requirements</h3>
              <ul>
                {(athlete.sponsorshipNeeds ?? []).map((need, i) => (
                  <li key={need.kind ?? i}>
                    <CheckCircle size={18} /> {need.kind}{need.amount ? ` — ₹${need.amount}` : ''}
                  </li>
                ))}
                {(!athlete.sponsorshipNeeds || athlete.sponsorshipNeeds.length === 0) && (
                  <li><CheckCircle size={18} /> General sponsorship support</li>
                )}
              </ul>
            </div>
            <div className="info-block">
              <h3>Current Ask</h3>
              <p style={{ color: 'var(--text-light-muted)', lineHeight: 1.6 }}>{athlete.sponsorshipPurpose ?? 'Support this fighter\'s journey.'}</p>
              <span className="spacer-sm"></span>
              <PrimaryButton to={sponsorUrl}>
                SUPPORT THIS FIGHTER <ArrowRight size={18} />
              </PrimaryButton>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta section">
        <div className="final-cta__bg">
          <img src={athlete.profileImageUrl ?? ''} alt="" aria-hidden="true" />
          <div className="final-cta__overlay"></div>
        </div>
        <div className="container final-cta__container">
          <Reveal>
            <h2>
              Be Part of <span className="accent">{athlete.fullName.split(' ')[0]}&rsquo;s Story.</span>
            </h2>
            <p>Your sponsorship directly funds training, equipment, and competition â€” turning ambition into victory.</p>
            <div className="final-cta__buttons">
              <PrimaryButton to={sponsorUrl} size="lg">
                SPONSOR NOW <ArrowRight size={18} />
              </PrimaryButton>
              <SecondaryButton to="/athletes" size="lg">
                BACK TO FIGHTERS
              </SecondaryButton>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}