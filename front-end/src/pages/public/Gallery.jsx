import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import PageHero from '../../components/common/PageHero.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import { usePublicGallery } from '@/hooks/use-firestore'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'
import { Reveal } from '../../hooks/useReveal.jsx'
import { isVideoUrl } from '../../lib/media'

const SWIPE_THRESHOLD = 48
const SLIDE_DURATION_MS = 380

export default function Gallery() {
  const { data: galleryData, isLoading, isError } = usePublicGallery()
  const { content } = usePageContent('gallery')
  const [searchParams] = useSearchParams()
  const eventFilter = searchParams.get('event') || null
  const [category, setCategory] = useState('All')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [leaving, setLeaving] = useState(null)
  const [direction, setDirection] = useState(null)
  const touchStartX = useRef(null)
  const slideTimer = useRef(null)
  const animatingRef = useRef(false)

  const allItems = useMemo(() => (galleryData ?? []).map((g) => ({
    id: g.id,
    image: g.publicUrl ?? '',
    title: g.title ?? g.altText ?? '',
    category: g.category ?? '',
    eventId: g.eventId ?? null,
    video: isVideoUrl(g.publicUrl),
  })), [galleryData])

  const CATEGORIES = useMemo(() => ['All', ...new Set(allItems.map((i) => i.category).filter(Boolean))], [allItems])

  const items = useMemo(() => {
    let list = allItems
    if (eventFilter) list = list.filter((i) => i.eventId === eventFilter)
    if (category !== 'All') list = list.filter((i) => i.category === category)
    return list
  }, [allItems, category, eventFilter])

  const closeLightbox = useCallback(() => {
    if (slideTimer.current) {
      clearTimeout(slideTimer.current)
      slideTimer.current = null
    }
    animatingRef.current = false
    setLeaving(null)
    setDirection(null)
    setLightboxIndex(null)
  }, [])

  // Animate to the adjacent slide. `animatingRef` ignores rapid input until the
  // current 380ms transition finishes, so slides never overlap or break.
  const runTransition = useCallback((dir) => {
    if (animatingRef.current || lightboxIndex === null || items.length < 2) return

    const target = dir === 'next'
      ? (lightboxIndex === items.length - 1 ? 0 : lightboxIndex + 1)
      : (lightboxIndex === 0 ? items.length - 1 : lightboxIndex - 1)
    if (target === lightboxIndex) return

    animatingRef.current = true
    setDirection(dir)
    setLeaving(items[lightboxIndex])
    setLightboxIndex(target)

    if (slideTimer.current) clearTimeout(slideTimer.current)
    slideTimer.current = setTimeout(() => {
      setLeaving(null)
      setDirection(null)
      animatingRef.current = false
      slideTimer.current = null
    }, SLIDE_DURATION_MS)
  }, [items, lightboxIndex])

  const goPrev = useCallback(() => runTransition('prev'), [runTransition])
  const goNext = useCallback(() => runTransition('next'), [runTransition])

  const openLightbox = useCallback((index) => setLightboxIndex(index), [])

  useEffect(() => () => {
    if (slideTimer.current) clearTimeout(slideTimer.current)
  }, [])

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX < 0) goNext()
      else goPrev()
    }
  }

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

  const current = lightboxIndex !== null ? items[lightboxIndex] : null
  const incomingClass = direction === 'next'
    ? 'lightbox__slide--from-right'
    : direction === 'prev'
      ? 'lightbox__slide--from-left'
      : ''
  const outgoingClass = direction === 'next'
    ? 'lightbox__slide--to-left'
    : 'lightbox__slide--to-right'

  const renderLightboxMedia = (item, isLeaving) => {
    if (!item) return null
    if (item.video) {
      return isLeaving ? (
        <video src={item.image} muted playsInline preload="metadata" className="lightbox__media" />
      ) : (
        <video src={item.image} controls autoPlay playsInline className="lightbox__media" />
      )
    }
    return <img src={item.image} alt={isLeaving ? '' : item.title} />
  }

  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={renderRichText(content.heroTitle)}
        subtitle={content.heroSubtitle}
        image="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1600&auto=format&fit=crop"
      />

      <section className="section section-light gallery-section">
        <div className="container">
          {eventFilter && (
            <p className="gallery-event-note">
              {content.eventNote}{' '}
              <Link to="/gallery" className="gallery-event-note__link">{content.viewAllMediaLabel}</Link>
            </p>
          )}
          <div className="gallery-tags">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`gallery-tag ${category === c ? 'gallery-tag--active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c === 'All' ? content.allCategoryLabel : c}
              </button>
            ))}
          </div>

          {isLoading ? (
            <LoadingState label={content.loadingLabel} />
          ) : isError ? (
            <EmptyState title={content.errorTitle} description={content.errorDescription} />
          ) : items.length === 0 ? (
            <EmptyState
              title={eventFilter ? content.emptyEventTitle : content.emptyTitle}
              description={eventFilter ? content.emptyEventDescription : content.emptyDescription}
            />
          ) : (
            <Reveal className={`gallery-grid ${items.length === 1 ? 'gallery-grid--featured' : ''}`}>
              {items.map((item, index) => (
                <figure
                  className="gallery-item"
                  key={item.id}
                  onClick={() => openLightbox(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openLightbox(index)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={item.title || 'Open media'}
                >
                  <img src={item.image} alt={item.title} loading="lazy" />
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
          )}
        </div>
      </section>

{current && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
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
            <div className="lightbox__stage">
              {leaving && (
                <div
                  key={`leaving-${leaving.id}`}
                  className={`lightbox__slide lightbox__slide--leaving ${outgoingClass}`}
                  aria-hidden="true"
                >
                  {renderLightboxMedia(leaving, true)}
                </div>
              )}
              <div
                key={`current-${lightboxIndex}`}
                className={`lightbox__slide ${incomingClass}`}
              >
                {renderLightboxMedia(current, false)}
              </div>
            </div>
            <div className="lightbox__caption">
              <div>
                <h3>{current.title}</h3>
                {current.category && <p>{current.category}</p>}
              </div>
              {items.length > 1 && (
                <span className="lightbox__counter">{lightboxIndex + 1} / {items.length}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}