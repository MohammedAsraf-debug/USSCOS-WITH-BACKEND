import { useMemo } from 'react'
import PageHero from '../../components/common/PageHero.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import EventCard from '../../components/public/EventCard.jsx'
import { usePublicEvents } from '@/hooks/use-firestore'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'
import { Reveal } from '../../hooks/useReveal.jsx'

export default function EventsPage() {
  const { data: eventsData, isLoading, isError } = usePublicEvents()
  const { content } = usePageContent('events')

  const events = useMemo(
    () =>
      (eventsData ?? []).map((e) => {
        const d = new Date(e.date)
        const validDate = !Number.isNaN(d.getTime())
        return {
          id: e.id,
          day: validDate ? String(d.getDate()) : content.dayTbaLabel,
          month: validDate
            ? d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
            : content.monthTbaLabel,
          title: e.title,
          location: e.location ?? '',
          date: validDate
            ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
            : content.dateUnknownLabel,
        }
      }),
    [eventsData, content],
  )

  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={renderRichText(content.heroTitle)}
        subtitle={content.heroSubtitle}
        image="https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=1600&auto=format&fit=crop"
      />

      <section className="section section-light">
        <div className="container">
          {isLoading ? (
            <LoadingState label={content.loadingLabel} />
          ) : isError ? (
            <EmptyState
              title={content.errorTitle}
              description={content.errorDescription}
            />
          ) : events.length === 0 ? (
            <EmptyState
              title={content.emptyTitle}
              description={content.emptyDescription}
            />
          ) : (
            <Reveal stagger className="events-grid">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </Reveal>
          )}
        </div>
      </section>
    </>
  )
}