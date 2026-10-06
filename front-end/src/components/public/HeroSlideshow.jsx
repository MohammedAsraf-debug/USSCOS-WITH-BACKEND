import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const SLIDES = [
  {
    src: 'https://images.unsplash.com/photo-1599058917765-a780eda07a3e?q=80&w=1600&auto=format&fit=crop',
  },
  {
    src: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=1600&auto=format&fit=crop',
  },
  {
    src: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1600&auto=format&fit=crop',
  },
  {
    src: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=1600&auto=format&fit=crop',
  },
]

const AUTO_MS = 6000

export default function HeroSlideshow() {
  const [index, setIndex] = useState(0)
  const timerRef = useRef(null)

  const goTo = (i) => {
    setIndex(((i % SLIDES.length) + SLIDES.length) % SLIDES.length)
    restartTimer()
  }

  const next = () => goTo(index + 1)
  const prev = () => goTo(index - 1)

  function restartTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % SLIDES.length)
    }, AUTO_MS)
  }

  useEffect(() => {
    restartTimer()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className="hero-slideshow" aria-hidden="true">
        {SLIDES.map((slide, i) => (
          <img
            key={slide.src}
            src={slide.src}
            alt=""
            className={`hero-slideshow__slide ${i === index ? 'is-active' : ''}`}
          />
        ))}
        <div className="hero__gradient"></div>
        <div className="hero__gradient-vertical"></div>
      </div>

      <div className="hero-slideshow__controls">
        <button
          type="button"
          className="hero-slideshow__arrow hero-slideshow__arrow--prev"
          onClick={prev}
          aria-label="Previous slide"
        >
          <ChevronLeft size={26} />
        </button>
        <button
          type="button"
          className="hero-slideshow__arrow hero-slideshow__arrow--next"
          onClick={next}
          aria-label="Next slide"
        >
          <ChevronRight size={26} />
        </button>
        <div className="hero-slideshow__dots" role="tablist" aria-label="Slideshow navigation">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              className={`hero-slideshow__dot ${i === index ? 'is-active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </>
  )
}
