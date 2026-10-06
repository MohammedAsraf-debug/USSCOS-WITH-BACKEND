import { Search } from 'lucide-react'

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  dark = false,
}) {
  return (
    <div className={`searchbar ${dark ? 'searchbar--dark' : ''}`}>
      <Search size={18} className="searchbar__icon" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  )
}
