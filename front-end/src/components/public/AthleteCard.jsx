import { Link } from 'react-router-dom'
import { MapPin, Star } from 'lucide-react'

export default function AthleteCard({ athlete, compact = false }) {
  return (
    <Link to={`/athletes/${athlete.id}`} className={`athlete-card ${compact ? 'athlete-card--compact' : ''}`}>
      <div className="athlete-card__media">
        <img src={athlete.image} alt={`${athlete.name} — ${athlete.sport}`} loading="lazy" />
        <div className="athlete-card__overlay"></div>
        <span className="athlete-card__sport">{athlete.sport}</span>
        <span className="athlete-card__fav" aria-label="Favorite">
          <Star size={16} />
        </span>
        <span className="athlete-card__view">View Profile</span>
      </div>
      <div className="athlete-card__body">
        <h3>{athlete.name}</h3>
        <p className="athlete-card__meta">
          <MapPin size={14} /> {athlete.location}
        </p>
      </div>
    </Link>
  )
}
