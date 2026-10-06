import { useParams, Link } from 'react-router-dom'
import { TrendingUp, ArrowRight } from 'lucide-react'
import PageHero from '../../components/common/PageHero.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'

export default function AthleteSponsorship() {
  const { id } = useParams()

  return (
    <>
      <PageHero
        eyebrow="Fighter Details"
        title={
          <>
            Sponsorship Record: <span className="accent">{id}</span>
          </>
        }
        subtitle="Detailed sponsorship information for this fighter."
        image="https://images.unsplash.com/photo-1517963879433-6ad2b056d712?q=80&w=1600&auto=format&fit=crop"
      />

      <section className="section section-light">
        <div className="container">
          <div className="success-screen">
            <h2>Sponsorship Details Coming Soon</h2>
            <p style={{ color: 'var(--text-light-muted)', lineHeight: 1.6, maxWidth: 520, margin: '0 auto' }}>
              Detailed sponsorship records for fighters are being built. Check back soon for transparent impact data.
            </p>
            <div className="hero__buttons" style={{ justifyContent: 'center', marginTop: 'var(--space-6)' }}>
              <PrimaryButton to="/sponsorships" size="lg">
                BACK TO SPONSORSHIPS
              </PrimaryButton>
              <SecondaryButton to="/seeking-sponsorship" size="lg">
                SPONSOR A FIGHTER <ArrowRight size={18} />
              </SecondaryButton>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
