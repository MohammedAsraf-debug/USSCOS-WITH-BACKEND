import DOMPurify from "dompurify";

/**
 * Sanitizes staff-authored article HTML before it reaches
 * `dangerouslySetInnerHTML` (NewsDetail).
 *
 * Article bodies are written through a plain textarea by any staff role with
 * story-write permission (including CONTENT_MANAGER), so the markup is
 * untrusted input rendered to every public visitor. Only basic formatting
 * survives; scripts, event handlers, iframes/objects, styles, and
 * non-http(s)/mailto links are stripped. Plain-text bodies never reach
 * here (the caller renders those as escaped paragraphs).
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
];

const ALLOWED_ATTR = ["href", "title", "target"];

export function sanitizeArticleHtml(dirty: unknown): string {
  if (typeof dirty !== "string" || dirty.length === 0) return "";
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}
