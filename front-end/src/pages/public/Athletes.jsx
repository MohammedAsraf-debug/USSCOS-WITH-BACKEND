import { useMemo, useState } from 'react'
import PageHero from '../../components/common/PageHero.jsx'
import SearchBar from '../../components/common/SearchBar.jsx'
import FilterBar from '../../components/common/FilterBar.jsx'
import LoadingState from '../../components/common/LoadingState.jsx'
import EmptyState from '../../components/common/EmptyState.jsx'
import AthleteCard from '../../components/public/AthleteCard.jsx'
import { usePublicAthletes } from '@/hooks/use-firestore'
import { usePageContent } from '@/hooks/use-page-content'
import { renderRichText } from '../../utils/contentText.jsx'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { Reveal } from '../../hooks/useReveal.jsx'

export default function Athletes() {
  const { data: athletesData, isLoading, isError } = usePublicAthletes()
  const { content } = usePageContent('athletes')
  const [search, setSearch] = useState('')
  const [sport, setSport] = useState('all')
  const [location, setLocation] = useState('all')
  const debouncedSearch = useDebouncedValue(search, 300)

  const allAthletes = useMemo(() => (athletesData ?? []).map((a) => ({
    id: a.slug,
    name: a.fullName,
    sport: a.sport,
    image: a.profileImageUrl,
    location: '',
  })), [athletesData])

  const sports = useMemo(() => [...new Set(allAthletes.map((a) => a.sport).filter(Boolean))], [allAthletes])
  const locations = useMemo(() => [...new Set(allAthletes.map((a) => a.location).filter(Boolean))], [allAthletes])

  const athletes = useMemo(() => {
    return allAthletes.filter((a) => {
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        if (!a.name.toLowerCase().includes(q) && !a.sport.toLowerCase().includes(q)) return false
      }
      if (sport !== 'all' && a.sport !== sport) return false
      if (location !== 'all' && a.location !== location) return false
      return true
    })
  }, [allAthletes, debouncedSearch, sport, location])

  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={renderRichText(content.heroTitle)}
        subtitle={content.heroSubtitle}
        image="https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=1600&auto=format&fit=crop"
      />

      <section className="section section-light">
        <div className="container">
          <div className="table-toolbar" style={{ marginBottom: 'var(--space-6)' }}>
            <SearchBar value={search} onChange={setSearch} placeholder={content.searchPlaceholder} />
            <FilterBar
              filters={[
                {
                  key: 'sport',
                  label: content.disciplineLabel,
                  value: sport,
                  options: [
                    { value: 'all', label: content.allDisciplinesLabel },
                    ...sports.map((s) => ({ value: s, label: s })),
                  ],
                },
                {
                  key: 'location',
                  label: content.locationLabel,
                  value: location,
                  options: [
                    { value: 'all', label: content.allLocationsLabel },
                    ...locations.map((l) => ({ value: l, label: l })),
                  ],
                },
              ]}
              onFilterChange={(key, value) => {
                if (key === 'sport') setSport(value)
                if (key === 'location') setLocation(value)
              }}
            />
          </div>

          {isLoading ? (
            <LoadingState label={content.loadingLabel} />
          ) : isError ? (
            <EmptyState title={content.errorTitle} description={content.errorDescription} />
          ) : athletes.length === 0 ? (
            <EmptyState title={content.emptyTitle} description={content.emptyDescription} />
          ) : (
            <Reveal className="athletes-grid">
              {athletes.map((athlete) => (
                <AthleteCard key={athlete.id} athlete={athlete} compact />
              ))}
            </Reveal>
          )}
        </div>
      </section>
    </>
  )
}