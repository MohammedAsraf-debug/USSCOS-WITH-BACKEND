export default function FilterBar({ filters, onFilterChange }) {
  return (
    <div className="filterbar">
      {filters.map((filter) => (
        <div className="filterbar__item" key={filter.key}>
          {filter.label && <label>{filter.label}</label>}
          <select
            value={filter.value}
            onChange={(e) => onFilterChange(filter.key, e.target.value)}
            aria-label={filter.label || filter.key}
          >
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}
