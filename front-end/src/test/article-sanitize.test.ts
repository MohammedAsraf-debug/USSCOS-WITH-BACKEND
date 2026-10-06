/**
 * Article HTML sanitizer — the single gate before dangerouslySetInnerHTML.
 */
import { describe, expect, it } from "vitest";
import { sanitizeArticleHtml } from "@/lib/sanitize";

describe("sanitizeArticleHtml", () => {
  it("strips script elements while keeping formatting", () => {
    const out = sanitizeArticleHtml('<p>Hello <strong>world</strong></p><script>alert(1)</script>');
    expect(out).toContain("<strong>world</strong>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
  });

  it("strips event-handler attributes", () => {
    const out = sanitizeArticleHtml('<img src="x" onerror="alert(1)"><p>ok</p>');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("<p>ok</p>");
  });

  it("strips javascript: links but keeps safe anchors", () => {
    const out = sanitizeArticleHtml(
      '<a href="javascript:alert(1)">evil</a><a href="https://example.com">good</a>',
    );
    expect(out).not.toContain("javascript:");
    expect(out).toContain('href="https://example.com"');
  });

  it("strips svg/onload, iframes, and data-URL documents", () => {
    const out = sanitizeArticleHtml(
      '"><svg/onload=alert(1)><iframe src="https://evil.example"></iframe>' +
        '<a href="data:text/html,<script>alert(1)</script>">x</a><p>safe</p>',
    );
    expect(out).not.toContain("<svg");
    expect(out).not.toContain("onload");
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("data:text/html");
    expect(out).toContain("<p>safe</p>");
  });

  it("returns empty string for non-string or empty input", () => {
    expect(sanitizeArticleHtml("")).toBe("");
    expect(sanitizeArticleHtml(null)).toBe("");
    expect(sanitizeArticleHtml(undefined)).toBe("");
    expect(sanitizeArticleHtml(42)).toBe("");
  });
});
