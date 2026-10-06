import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Calendar, Clock, MapPin, ArrowLeft, ArrowRight, X, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import { usePublicEvent, usePublicGallery } from '@/hooks/use-firestore'
import { Reveal } from '../../hooks/useReveal.jsx'
import { isVideoUrl } from '../../lib/media'
import { galleryEventRoute } from '../../lib/urlFor'

function formatDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Date to be announced'
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

function galleryThumb(item) {
  return {
    id: item.id,
    title: item.title ?? item.altText ?? '',
    category: item.category ?? '',
    publicUrl: item.publicUrl ?? '',
    video: isVideoUrl(item.publicUrl),
  }
}

export default function EventDetail() {
  const { eventId } = useParams()
  const { data: event, isLoading } = usePublicEvent(eventId ?? '')
  const { data: galleryData, isLoading: galleryLoading, isError: galleryError } = usePublicGallery()

  const gallery = useMemo(
    () => (galleryData ?? [])
      .filter((g) => g.eventId && g.eventId === event?.id)
      .map(galleryThumb),
    [galleryData, event],
  )

  const [lightboxIndex, setLightboxIndex] = useState(null)

  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => {
      if (i === null || gallery.length === 0) return 0
      return (i - 1 + gallery.length) % gallery.length
    })
  }, [gallery.length])

  const goNext = useCallback(() => {
    setLightboxIndex((i) => {
      if (i === null || gallery.length === 0) return 0
      return (i + 1) % gallery.length
    })
  }, [gallery.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [lightboxIndex, closeLightbox, goPrev, goNext])

  if (isLoading) {
    return (
      <section className="section section-dark">
        <LoadingState label="Loading event" />
      </section>
    )
  }

  if (!event) {
    return (
      <section className="section section-light">
        <div className="container">
          <EmptyState
            title="Event not found"
            description="This event may have been removed, or the link you followed is invalid."
          />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <SecondaryButton to="/events" dark>
              <ArrowLeft size={18} /> BACK TO EVENTS
            </SecondaryButton>
          </div>
        </div>
      </section>
    )
  }

  const current = lightboxIndex !== null ? gallery[lightboxIndex] : null

  return (
    <>
      <section className="section section-light" style={{ paddingTop: '140px' }}>
        <div className="container">
          <article className="news-detail">
            <header className="news-detail__header">
              <span className="news-detail__category">
                {event.status === 'upcoming' ? 'Upcoming' : 'Past'} Event
              </span>
              <h1>{event.title}</h1>
              <div className="news-detail__meta">
                <span>
                  <Calendar size={16} /> {formatDate(event.date)}
                </span>
                {event.time && (
                  <span>
                    <Clock size={16} /> {event.time}
                    {event.endTime ? ` – ${event.endTime}` : ''}
                  </span>
                )}
                {event.location && (
                  <span>
                    <MapPin size={16} /> {event.location}
                  </span>
                )}
              </div>
            </header>

            {event.coverImageUrl && (
              <div className="news-detail__featured-img">
                <img src={event.coverImageUrl} alt={event.title} />
              </div>
            )}

            <div className="news-detail__content">
              {event.description ? (
                event.description.split('\n').filter(Boolean).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))
              ) : (
                <p>Details for this event have not been published yet.</p>
              )}
            </div>

            {event.registrationUrl && (
              <div className="hero__buttons" style={{ marginTop: 'var(--space-6)' }}>
                <a
                  href={event.registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-lg"
                >
                  REGISTER / DETAILS <ArrowRight size={18} />
                </a>
              </div>
            )}
            {event.registrationNote && (
              <p className="event-card__date-line" style={{ marginTop: 'var(--space-3)' }}>
                {event.registrationNote}
              </p>
            )}
          </article>

          <div style={{ marginTop: 'var(--space-6)' }}>
            <SecondaryButton to="/events" dark>
              <ArrowLeft size={18} /> BACK TO EVENTS
            </SecondaryButton>
          </div>
        </div>
      </section>

      <section className="section section-light event-gallery-section">
        <div className="container">
          <h2 className="section-header__title" style={{ textAlign: 'center', marginBottom: 'var(--space-7)' }}>
            Event <span className="accent">Gallery</span>
          </h2>

          {galleryLoading ? (
            <LoadingState label="Loading gallery" />
          ) : galleryError ? (
            <EmptyState title="Error loading gallery" description="Please try again later." />
          ) : gallery.length === 0 ? (
            <EmptyState
              title="No media from this event yet"
              description="Photos and videos from this event will appear here soon."
            />
          ) : (
            <>
              <Reveal className="gallery-grid">
                {gallery.map((item, index) => (
                  <figure
                    className="gallery-item"
                    key={item.id}
                    onClick={() => setLightboxIndex(index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setLightboxIndex(index)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={item.title || 'Open media'}
                  >
                    <img src={item.publicUrl} alt={item.title} loading="lazy" />
                    {item.video && (
                      <span className="gallery-item__play">
                        <span><Play size={22} fill="currentColor" /></span>
                      </span>
                    )}
                    <figcaption className="gallery-item__overlay">
                      {item.category && <span className="gallery-item__category">{item.category}</span>}
                      <h3>{item.title}</h3>
                    </figcaption>
                  </figure>
                ))}
              </Reveal>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-7)' }}>
                <SecondaryButton to={galleryEventRoute(event.id)} size="lg">
                  VIEW FULL GALLERY <ArrowRight size={18} />
                </SecondaryButton>
              </div>
            </>
          )}
        </div>
      </section>

      {current && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
        >
          <button className="lightbox__close" onClick={closeLightbox} aria-label="Close">
            <X size={24} />
          </button>
          <button className="lightbox__nav lightbox__nav--prev" onClick={goPrev} aria-label="Previous">
            <ChevronLeft size={24} />
          </button>
          <button className="lightbox__nav lightbox__nav--next" onClick={goNext} aria-label="Next">
            <ChevronRight size={24} />
          </button>
          <div className="lightbox__content">
            {current.video ? (
              <video src={current.publicUrl} controls autoPlay playsInline className="lightbox__media" />
            ) : (
              <img src={current.publicUrl} alt={current.title} />
            )}
            <div className="lightbox__caption">
              <div>
                <h3>{current.title}</h3>
                {current.category && <p>{current.category}</p>}
              </div>
              {gallery.length > 1 && (
                <span className="lightbox__counter">{lightboxIndex + 1} / {gallery.length}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}