/**
 * Media-type inference for the gallery. The gallery media structure links a
 * single `publicUrl` (photo or video served by an external host/CDN). Videos
 * are identified by their URL; no separate field/type is required.
 */
export function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v|m3u8)(\?[^#]*)?$/i.test(url) || /\/video\//i.test(url);
}