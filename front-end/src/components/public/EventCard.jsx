import { Link } from 'react-router-dom'
import { MapPin, Calendar, ArrowRight } from 'lucide-react'

export default function EventCard({ event }) {
  return (
    <article className="event-card">
      <div className="event-card__date">
        <span className="event-card__day">{event.day}</span>
        <span className="event-card__month">{event.month}</span>
      </div>
      <div className="event-card__body">
        <h3>{event.title}</h3>
        <p className="event-card__meta">
          <MapPin size={15} /> {event.location}
        </p>
        <p className="event-card__date-line">
          <Calendar size={15} /> {event.date}
        </p>
        <Link to={`/events/${event.id}`} className="event-card__link">
          View Details <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  )
}