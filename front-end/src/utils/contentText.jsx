import { Fragment } from 'react'

/**
 * Renders page copy that may contain a tiny formatting convention:
 *   `**word**` → `<span className="accent">word</span>`
 *   `\n`       → line break
 *
 * Used by the public page heroes so editors can keep the existing two-tone
 * headline styling without storing JSX.
 */
export function renderRichText(text, accentClass = 'accent') {
  if (typeof text !== 'string' || text.length === 0) return null
  const lines = text.split('\n')
  return lines.map((line, index) => (
    <Fragment key={index}>
      {index > 0 && <br />}
      {renderAccent(line, accentClass)}
    </Fragment>
  ))
}

function renderAccent(line, accentClass) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <span key={index} className={accentClass}>
          {part.slice(2, -2)}
        </span>
      )
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}
