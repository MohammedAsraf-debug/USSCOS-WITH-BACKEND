import { Inbox } from 'lucide-react'

export default function EmptyState({ title = 'No results found', description, dark = false }) {
  return (
    <div className={`empty-state ${dark ? 'empty-state--dark' : ''}`}>
      <Inbox size={48} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  )
}
