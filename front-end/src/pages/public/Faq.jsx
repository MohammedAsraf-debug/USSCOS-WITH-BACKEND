import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import PageHero from '../../components/common/PageHero.jsx'
import SectionHeader from '../../components/common/SectionHeader.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'
import { Reveal } from '../../hooks/useReveal.jsx'

function AccordionItem({ q, a }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          padding: 'var(--space-5) var(--space-6)',
          background: 'transparent',
          color: 'var(--text-dark)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '1.02rem',
          textAlign: 'left',
          letterSpacing: '-0.01em',
          cursor: 'pointer',
        }}
      >
        <span>{q}</span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: open ? 'var(--primary-red)' : 'var(--bg-light)',
          color: open ? 'var(--white)' : 'var(--text-light-muted)',
          flexShrink: 0,
          transition: 'background var(--t-fast), color var(--t-fast)',
        }}>
          <ChevronDown
            size={18}
            style={{ transition: 'transform var(--t-med) var(--ease-out)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </span>
      </button>
      <div style={{
        maxHeight: open ? 400 : 0,
        overflow: 'hidden',
        transition: 'max-height var(--t-med) var(--ease-out)',
      }}>
        <p style={{
          padding: '0 var(--space-6) var(--space-5)',
          color: 'var(--text-light-muted)',
          lineHeight: 1.7,
          fontSize: '0.95rem',
        }}>
          {a}
        </p>
      </div>
    </div>
  )
}

export default function Faq() {
  const { content } = usePageContent('faq')

  const groups = content.faqs.reduce((acc, item) => {
    let group = acc.find((g) => g.category === item.category)
    if (!group) {
      group = { category: item.category, items: [] }
      acc.push(group)
    }
    group.items.push(item)
    return acc
  }, [])

  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={renderRichText(content.heroTitle)}
        subtitle={content.heroSubtitle}
        image="https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?q=80&w=1600&auto=format&fit=crop"
      />

      {groups.map((group) => (
        <section key={group.category} className="section section-light">
          <div className="container">
            <SectionHeader eyebrow={group.category} title={group.category} align="left" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 800 }}>
              {group.items.map((item, index) => (
                <Reveal key={`${item.q}-${index}`}>
                  <AccordionItem q={item.q} a={item.a} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="section section-dark">
        <div className="container">
          <SectionHeader
            dark
            eyebrow={content.closingEyebrow}
            title={renderRichText(content.closingTitle)}
            subtitle={content.closingSubtitle}
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
