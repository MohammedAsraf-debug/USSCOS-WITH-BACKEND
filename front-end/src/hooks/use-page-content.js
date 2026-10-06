import { useContentBlock } from '@/hooks/use-firestore'
import { PAGE_CONTENT } from '../data/pageContent.js'

/** Parse a stored JSON array; fall back to the built-in defaults on any issue. */
function parseList(value, fallback) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // Malformed stored JSON — keep the safe defaults.
    }
  }
  return fallback
}

/**
 * Reads the `contentBlocks/{blockId}` document for a public page section and
 * merges the stored values over the section's built-in defaults.
 *
 * Returns the underlying TanStack Query result (for loading/error states) plus
 * a `content` object where every default key is resolved. Repeated content
 * (arrays stored as JSON strings) is parsed back into arrays.
 */
export function usePageContent(blockId) {
  const query = useContentBlock(blockId)
  const defaults = PAGE_CONTENT[blockId] ?? {}
  const remote = query.data && typeof query.data === 'object' ? query.data : {}

  const content = { ...defaults }
  for (const key of Object.keys(defaults)) {
    if (Array.isArray(defaults[key])) {
      content[key] = parseList(remote[key], defaults[key])
    } else if (typeof remote[key] === 'string') {
      content[key] = remote[key]
    }
  }

  return { ...query, content }
}
