/**
 * Entity → route builders. Single place for parametric routes,
 * avoids string drift across the codebase (PROJECT_STRUCTURE §2).
 * Only builders for registered App.jsx routes live here.
 */

export function galleryEventRoute(eventId: string): string {
  return `/gallery?event=${encodeURIComponent(eventId)}`;
}
