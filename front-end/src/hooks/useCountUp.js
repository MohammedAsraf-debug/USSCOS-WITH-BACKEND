import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from 0 to target, triggered the first time the
 * element scrolls into view. Uses IntersectionObserver so it fires
 * only once per page load and never restarts on scroll up/down.
 *
 * Returns a ref to attach to the element being observed, and the
 * current animated value (0 until the element becomes visible).
 */
export function useCountUp(target, duration = 1800) {
  const ref = useRef(null)
  const [value, setValue] = useState(0)
  const [started, setStarted] = useState(false)

  const numericTarget = parseInt(target, 10) || 0

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      // Fallback: start immediately if observer unsupported.
      setStarted(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStarted(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.2 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    let raf
    const start = performance.now()

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * numericTarget))
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [started, numericTarget, duration])

  return { ref, value }
}
