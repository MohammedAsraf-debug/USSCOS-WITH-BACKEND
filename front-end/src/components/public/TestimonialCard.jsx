import { Quote } from 'lucide-react'

export default function TestimonialCard({ testimonial }) {
  return (
    <figure className="testimonial-card">
      <Quote className="testimonial-card__quote-icon" size={32} />
      <blockquote>"{testimonial.quote}"</blockquote>
      <figcaption className="testimonial-card__person">
        <img src={testimonial.avatar} alt={testimonial.name} />
        <div>
          <strong>{testimonial.name}</strong>
          <span>{testimonial.role}</span>
        </div>
      </figcaption>
    </figure>
  )
}