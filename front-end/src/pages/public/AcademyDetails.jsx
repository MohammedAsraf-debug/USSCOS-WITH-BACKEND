import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { GraduationCap, MapPin, ArrowRight } from 'lucide-react'
import PageHero from '../../components/common/PageHero.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import { usePublicGroups } from '@/hooks/use-firestore'
import { Reveal } from '../../hooks/useReveal.jsx'

export default function AcademyDetails() {
  const { academyId } = useParams()
  const { data: groupsData, isLoading } = usePublicGroups()

  const academy = useMemo(() => {
    if (!groupsData) return null
    return groupsData.find((g) => g.slug === academyId && g.groupType === 'academy') ?? null
  }, [groupsData, academyId])

  if (isLoading) {
    return (
      <section className="section section-light">
        <LoadingState label="Loading academy details" />
      </section>
    )
  }

  if (!academy) {
    return (
      <section className="section section-light">
        <div className="container">
          <EmptyState
            title="Academy not found"
            description="The academy you're looking for doesn't exist or has been removed."
          />
          <div style={{ textAlign: 'center' }}>
            <SecondaryButton to="/sponsorships" dark>
              BACK TO SPONSORSHIPS
            </SecondaryButton>
          </div>
        </div>
      </section>
    )
  }

  const sport = (academy.sports ?? []).join(', ')

  return (
    <>
      <PageHero
        eyebrow="Academy Details"
        title={
          <>
            <span className="accent">{academy.groupName}</span>
          </>
        }
        subtitle={`${sport || 'Various combat sports'} — training the next generation of champions.`}
        image="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1600&auto=format&fit=crop"
      />

      <section className="section section-light">
        <div className="container">
          <div className="info-row">
            <div className="info-block">
              <h3>Academy</h3>
              <ul>
                <li>
                  <GraduationCap size={18} /> {academy.groupName}
                </li>
                {academy.location ? (
                  <li>
                    <MapPin size={18} /> {academy.location}
                  </li>
                ) : null}
                <li>
                  <span></span> Disciplines: {sport}
                </li>
                {academy.memberCount != null && (
                  <li>
                    <span></span> Members: {academy.memberCount}
                  </li>
                )}
              </ul>
            </div>
            <div className="info-block">
              <h3>Sponsor This Academy</h3>
              <p style={{ color: 'var(--text-light-muted)', lineHeight: 1.6 }}>
                {academy.description ?? 'Support the training, equipment, and competition needs of the fighters at this academy.'}
              </p>
              <span className="spacer-sm"></span>
              <PrimaryButton to={`/sponsorships/sponsor?type=academy&academy=${encodeURIComponent(academy.groupName)}`}>
                SPONSOR THIS ACADEMY <ArrowRight size={18} />
              </PrimaryButton>
            </div>
          </div>

          {(academy.sponsorshipNeeds ?? []).length > 0 && (
            <Reveal style={{ marginTop: 'var(--space-8)' }}>
              <h3 style={{ marginBottom: 'var(--space-4)' }}>Sponsorship Needs</h3>
              <ul>
                {academy.sponsorshipNeeds.map((need, i) => (
                  <li key={i}>
                    {need.kind}{need.amount ? ` — ₹${need.amount}` : ''}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          <Reveal style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
            <Link to="/sponsorships" style={{ color: 'var(--primary-red)', fontWeight: 600 }}>
              ← Back to Sponsorships
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  )
}
