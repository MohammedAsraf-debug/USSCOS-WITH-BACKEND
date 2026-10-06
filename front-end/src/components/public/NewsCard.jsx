import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function NewsCard({ article, featured = false }) {
  return (
    <article className={`news-card ${featured ? 'news-card--featured' : ''}`}>
      <Link to={`/news/${article.id}`} className="news-card__media">
        <img src={article.image} alt={article.title} loading="lazy" />
      </Link>
      <div className="news-card__body">
        <span className="news-card__category">{article.category}</span>
        <span className="news-card__date">{new Date(article.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <h3>
          <Link to={`/news/${article.id}`}>{article.title}</Link>
        </h3>
        <p>{article.excerpt}</p>
        <Link to={`/news/${article.id}`} className="news-card__more">
          Read More <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  )
}
