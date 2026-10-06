import { Shield, Heart, Users, Trophy, Globe, Compass, Target } from 'lucide-react'
import PageHero from '../../components/common/PageHero.jsx'
import SectionHeader from '../../components/common/SectionHeader.jsx'
import PrimaryButton from '../../components/common/PrimaryButton.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import { Reveal } from '../../hooks/useReveal.jsx'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'

const valueIcons = [Shield, Heart, Target, Users]
const impactIcons = [Heart, Users, Trophy, Globe]

export default function About() {
  const { content } = usePageContent('about')
  const { content: mission } = usePageContent('about-mission')
  const { content: story } = usePageContent('about-story')
  const { content: teamBlock } = usePageContent('about-team')

  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={renderRichText(content.heroTitle)}
        subtitle={content.heroSubtitle}
        image="https://images.unsplash.com/photo-1519861531473-9200262188bf?q=80&w=1600&auto=format&fit=crop"
      />

      {/* About introduction â€” light */}
      <section className="section section-light">
        <div className="container">
          <div className="section-intro">
            <Reveal>
              <span className="eyebrow">{content.whoEyebrow}</span>
              <h2 className="about-preview__heading">{renderRichText(content.whoTitle)}</h2>
            </Reveal>
            <Reveal>
              <p className="about-preview__text">{content.intro}</p>
              <p className="about-preview__text">{content.whoParagraph2}</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Mission / Vision â€” dark */}
      <section className="section section-dark">
        <div className="container">
          <div className="about-preview">
            <Reveal>
              <span className="eyebrow">{mission.missionEyebrow}</span>
              <h2 className="about-preview__heading">{renderRichText(mission.missionTitle)}</h2>
              <p className="about-preview__text">{mission.missionText}</p>
            </Reveal>
            <Reveal>
              <span className="eyebrow">{mission.visionEyebrow}</span>
              <h2 className="about-preview__heading">{renderRichText(mission.visionTitle)}</h2>
              <p className="about-preview__text">{mission.visionText}</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Our Values â€” light */}
      <section className="section section-light">
        <div className="container">
          <SectionHeader
            center
            eyebrow={mission.valuesEyebrow}
            title={renderRichText(mission.valuesTitle)}
          />
          <div className="impact-grid">
            {mission.values.map((v, index) => {
              const Icon = valueIcons[index] ?? Shield
              return (
                <div className="value-card" key={`${v.title}-${index}`}>
                  <div className="value-card__icon">
                    <Icon size={24} />
                  </div>
                  <h3>{v.title}</h3>
                  <p>{v.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Our Story â€” dark */}
      <section className="section section-dark">
        <div className="container">
          <div className="about-preview">
            <div>
              <SectionHeader
                dark
                eyebrow={story.storyEyebrow}
                title={renderRichText(story.storyTitle)}
              />
              <Reveal>
                <div className="timeline">
                  {story.timeline.map((t, i) => (
                    <div className="timeline__item" key={`${t.year}-${i}`}>
                      <span className="timeline__dot"></span>
                      <strong>{t.year}</strong>
                      <p>{t.text}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
            <Reveal>
              <div className="about-coaching-card">
                <Compass size={40} />
                <h3>{story.purposeTitle}</h3>
                <p>{story.purposeText}</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Our Impact â€” light */}
      <section className="section section-light">
        <div className="container">
          <SectionHeader
            center
            eyebrow={story.impactEyebrow}
            title={renderRichText(story.impactTitle)}
          />
          <div className="impact-grid">
            {story.impactNumbers.map((item, index) => {
              const Icon = impactIcons[index] ?? Heart
              return (
                <div className="value-card" key={`${item.value}-${index}`}>
                  <div className="value-card__icon"><Icon size={24} /></div>
                  <h3>{item.value}</h3>
                  <p>{item.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Leadership â€” white */}
      <section className="section section-white">
        <div className="container">
          <SectionHeader
            center
            eyebrow={teamBlock.teamEyebrow}
            title={renderRichText(teamBlock.teamTitle)}
            subtitle={teamBlock.teamSubtitle}
          />
          <div className="team-grid">
            {teamBlock.team.map((member, index) => (
              <div className="team-card" key={`${member.name}-${index}`}>
                <div className="team-card__avatar">{member.initials}</div>
                <h3>{member.name}</h3>
                <p>{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA â€” dark */}
      <section className="final-cta section">
        <div className="final-cta__bg">
          <img
            src="https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1600&auto=format&fit=crop"
            alt=""
            aria-hidden="true"
          />
          <div className="final-cta__overlay"></div>
        </div>
        <div className="container final-cta__container">
          <Reveal>
            <h2>{renderRichText(teamBlock.ctaTitle)}</h2>
            <p>{teamBlock.ctaText}</p>
            <div className="final-cta__buttons">
              <PrimaryButton to="/contact" size="lg">
                {teamBlock.ctaPrimaryCta}
              </PrimaryButton>
              <SecondaryButton to="/seeking-sponsorship" size="lg">
                {teamBlock.ctaSecondaryCta}
              </SecondaryButton>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}