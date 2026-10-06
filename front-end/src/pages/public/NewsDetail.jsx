import { useParams } from 'react-router-dom'
import { Calendar, User, ArrowLeft, ArrowRight } from 'lucide-react'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import SecondaryButton from '../../components/common/SecondaryButton.jsx'
import NewsCard from '../../components/public/NewsCard.jsx'
import { usePublicStory, usePublicStories } from '@/hooks/use-firestore'
import { Reveal } from '../../hooks/useReveal.jsx'
import { sanitizeArticleHtml } from '@/lib/sanitize'

export default function NewsDetail() {
  const { id } = useParams()
  const { data: article, isLoading } = usePublicStory(id ?? '')
  const { data: allStories } = usePublicStories()

  const related = (allStories ?? [])
    .filter((s) => s.slug !== id)
    .slice(0, 3)
    .map((s) => ({
      id: s.slug,
      title: s.title,
      excerpt: s.excerpt ?? '',
      image: s.coverImageUrl ?? '',
      category: s.tags?.[0] ?? 'News',
      date: s.publishedAt ?? '',
    }))

  if (isLoading) {
    return (
      <section className="section section-dark">
        <LoadingState label="Loading article" />
      </section>
    )
  }

  if (!article) {
    return (
      <section className="section section-light">
        <div className="container">
          <EmptyState title="Article not found" description="This article may have been removed." />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <SecondaryButton to="/news" dark>
              <ArrowLeft size={18} /> BACK TO NEWS
            </SecondaryButton>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="section section-light" style={{ paddingTop: '140px' }}>
        <div className="container">
          <article className="news-detail">
            <Reveal>
              <header className="news-detail__header">
              <span className="news-detail__category">{article.tags?.[0] ?? 'News'}</span>
              <h1>{article.title}</h1>
              <div className="news-detail__meta">
                {article.publishedAt && <span><Calendar size={16} /> {new Date(article.publishedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                {article.author && <span><User size={16} /> {article.author}</span>}
              </div>
            </header>

            {article.coverImageUrl && (
              <div className="news-detail__featured-img">
                <img src={article.coverImageUrl} alt={article.title} />
              </div>
            )}

            <div className="news-detail__content">
              {article.body ? (
                article.body.includes('<') ? (
                  <div dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(article.body) }} />
                ) : (
                  article.body.split('\n').filter(Boolean).map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))
                )
              ) : article.excerpt ? (
                <p>{article.excerpt}</p>
              ) : null}
            </div>
            </Reveal>
          </article>

          <div className="spacer-lg"></div>

          <h2 className="section-header__title" style={{ marginBottom: 'var(--space-6)' }}>
            More From <span className="accent">USSCOS</span>
          </h2>
          <Reveal stagger className="news-grid">
            {related.map((item) => (
              <NewsCard key={item.id} article={item} />
            ))}
          </Reveal>
        </div>
      </section>

      <section className="final-cta section">
        <div className="final-cta__bg">
          <img
            src="https://images.unsplash.com/photo-1517466787929-bc90951d0974?q=80&w=1600&auto=format&fit=crop"
            alt=""
            aria-hidden="true"
          />
          <div className="final-cta__overlay"></div>
        </div>
        <div className="container final-cta__container">
          <h2>
            Be Part of the <span className="accent">Next Story.</span>
          </h2>
          <div className="final-cta__buttons" style={{ justifyContent: 'center' }}>
            <SecondaryButton to="/news" size="lg">
              <ArrowLeft size={18} /> ALL NEWS
            </SecondaryButton>
            <SecondaryButton to="/donate" size="lg">
              SUPPORT US <ArrowRight size={18} />
            </SecondaryButton>
          </div>
        </div>
      </section>
    </>
  )
}