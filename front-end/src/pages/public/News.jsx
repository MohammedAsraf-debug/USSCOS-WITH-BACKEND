import { useMemo, useState } from 'react'
import PageHero from '../../components/common/PageHero.jsx'
import FilterBar from '../../components/common/FilterBar.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import NewsCard from '../../components/public/NewsCard.jsx'
import { usePublicStories } from '@/hooks/use-firestore'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'
import { Reveal } from '../../hooks/useReveal.jsx'

export default function News() {
  const { data: storiesData, isLoading, isError } = usePublicStories()
  const { content } = usePageContent('news')
  const [category, setCategory] = useState('all')

  const articles = useMemo(() => {
    const all = (storiesData ?? []).map((s) => ({
      id: s.slug,
      title: s.title,
      excerpt: s.excerpt ?? '',
      image: s.coverImageUrl ?? '',
      category: s.tags?.[0] ?? 'News',
      date: s.publishedAt ?? '',
      author: s.author ?? '',
      tags: s.tags ?? [],
    }))
    if (category === 'all') return all
    return all.filter((a) => a.tags.includes(category) || a.category === category)
  }, [storiesData, category])

  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={renderRichText(content.heroTitle)}
        subtitle={content.heroSubtitle}
        image="https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1600&auto=format&fit=crop"
      />

      <section className="section section-light">
        <div className="container">
          <div className="table-toolbar" style={{ marginBottom: 'var(--space-6)' }}>
            <FilterBar
              filters={[
                {
                  key: 'category',
                  label: content.categoryLabel,
                  value: category,
                  options: [
                    { value: 'all', label: content.allCategoriesLabel },
                    { value: 'Announcement', label: content.categoryAnnouncementLabel },
                    { value: 'Athlete Story', label: content.categoryStoryLabel },
                    { value: 'Events', label: content.categoryEventsLabel },
                  ],
                },
              ]}
              onFilterChange={(key, value) => setCategory(value)}
            />
          </div>

          {isLoading ? (
            <LoadingState label={content.loadingLabel} />
          ) : isError ? (
            <EmptyState title={content.errorTitle} description={content.errorDescription} />
          ) : articles.length === 0 ? (
            <EmptyState title={content.emptyTitle} description={content.emptyDescription} />
          ) : (
            <Reveal className="news-grid">
              {articles.map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
            </Reveal>
          )}
        </div>
      </section>
    </>
  )
}
