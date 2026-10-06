import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

/**
 * Minimal jsdom polyfill for window.matchMedia (used by useMediaQuery /
 * useIsDesktop / usePrefersReducedMotion). jsdom lacks a real viewport so
 * every query returns matches:false — enough for rendering header/drawer
 * in tests. Individual tests can override per-query behaviour via
 * vi.spyOn(window, "matchMedia").
 */
const matchMediaStub = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
});
Object.defineProperty(window, "matchMedia", { writable: true, value: matchMediaStub });
