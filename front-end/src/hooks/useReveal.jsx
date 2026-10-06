import { useEffect, useRef } from 'react'

/**
 * Adds scroll-reveal behavior to any element.
 * Usage: const ref = useReveal(); <div ref={ref} className="reveal"> ...
 */
export function useReveal() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add('reveal-visible')
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}

/**
 * Reveal component wrapper.
 */
export function Reveal({ as: Tag = 'div', children, className = '', stagger = false, ...props }) {
  const ref = useReveal()
  const cls = `reveal ${stagger ? 'reveal-stagger' : ''} ${className}`.trim()
  return (
    <Tag ref={ref} className={cls} {...props}>
      {children}
    </Tag>
  )
}
