import { Reveal } from '../../hooks/useReveal.jsx'

export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = 'left',
  dark = false,
  accentWord = null,
}) {
  const alignClass = align === 'center' ? 'eyebrow-center header-center' : ''

  return (
    <Reveal className={`section-header ${alignClass}`}>
      {eyebrow && <span className={`eyebrow ${align === 'center' ? 'eyebrow-center' : ''}`}>{eyebrow}</span>}
      {title && (
        <h2 className={`section-header__title ${dark ? 'color-white' : ''}`}>
          {title}
        </h2>
      )}
      {subtitle && (
        <p className={`section-header__subtitle ${dark ? 'text-muted' : 'text-light-muted'}`}>
          {subtitle}
        </p>
      )}
    </Reveal>
  )
}
