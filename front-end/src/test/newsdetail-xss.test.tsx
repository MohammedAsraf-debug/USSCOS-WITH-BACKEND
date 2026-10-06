// @vitest-environment jsdom
/**
 * NewsDetail stored-XSS regression test.
 *
 * Article bodies are staff-authored (including CONTENT_MANAGER) and rendered
 * as HTML. A malicious body must reach the DOM sanitized: no script
 * elements, no event handlers, no javascript: URLs — while legitimate
 * formatting survives.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NewsDetail from "@/pages/public/NewsDetail.jsx";

vi.mock("@/hooks/use-firestore", () => ({
  usePublicStory: vi.fn(),
  usePublicStories: vi.fn(),
}));

import { usePublicStory, usePublicStories } from "@/hooks/use-firestore";

const MALICIOUS_BODY =
  '<p>Fight night report</p><script>window.__xss = 1</script>' +
  '<img src="x" onerror="window.__xss = 2">' +
  '<a href="javascript:window.__xss = 3">results</a>';

function renderArticle() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/news/evil-article"]}>
        <Routes>
          <Route path="/news/:id" element={<NewsDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    writable: true,
    configurable: true,
  });
  vi.mocked(usePublicStory).mockReturnValue({
    data: {
      slug: "evil-article",
      title: "Evil article",
      body: MALICIOUS_BODY,
      tags: ["News"],
    },
    isLoading: false,
  } as never);
  vi.mocked(usePublicStories).mockReturnValue({ data: [], isLoading: false } as never);
});

describe("NewsDetail article body", () => {
  it("renders staff HTML sanitized with no executable content", () => {
    renderArticle();
    expect(document.querySelector("script")).toBeNull();
    expect(document.body.innerHTML).not.toContain("onerror");
    expect(document.body.innerHTML).not.toContain("javascript:");
    expect(document.body.innerHTML).not.toContain("__xss");
    // Legitimate formatting survives.
    expect(screen.getByText("Fight night report")).toBeInTheDocument();
  });
});
