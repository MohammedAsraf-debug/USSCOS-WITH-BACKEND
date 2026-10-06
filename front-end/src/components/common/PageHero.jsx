import { Reveal } from '../../hooks/useReveal.jsx'

export default function PageHero({ eyebrow, title, subtitle, image }) {
  return (
    <section className="page-hero" aria-label={title}>
      <div className="page-hero__bg">
        {image && <img src={image} alt="" aria-hidden="true" />}
        <div className="page-hero__overlay"></div>
      </div>
      <div className="container page-hero__container">
        <Reveal>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </Reveal>
      </div>
    </section>
  )
}