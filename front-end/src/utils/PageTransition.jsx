import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

const EXIT_MS = 400
const ENTER_MS = 600

/**
 * Route-level page transition.
 *
 * On every navigation the currently displayed page fades out over
 * `EXIT_MS`, then the new page fades in over `ENTER_MS`. The old page
 * element is held in state during the exit phase so it can animate
 * out instead of being instantly replaced by React Router — this is
 * what makes both exit and enter animations actually visible.
 *
 * Runs on every location change on desktop, tablet, and mobile. It
 * does not change routing structure, layout, or page content.
 */
export function PageTransition({ children }) {
  const location = useLocation()
  const [page, setPage] = useState({ path: location.pathname, node: children })
  const [phase, setPhase] = useState('idle')
  const enterTimer = useRef(null)

  // Exit: when the route changes, fade out the currently shown page,
  // then swap to the new page and fade it in.
  useEffect(() => {
    if (location.pathname === page.path) return

    setPhase('exit')
    const exitTimer = setTimeout(() => {
      setPage({ path: location.pathname, node: children })
      setPhase('enter')
      enterTimer.current = setTimeout(() => setPhase('idle'), ENTER_MS)
    }, EXIT_MS)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(enterTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const cls = phase === 'exit' ? 'page-exit' : phase === 'enter' ? 'page-enter' : ''

  return <div className={`page-transition ${cls}`}>{page.node}</div>
}
