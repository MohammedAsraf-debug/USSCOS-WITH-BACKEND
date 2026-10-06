// @vitest-environment jsdom
/**
 * Routing & navigation audit tests.
 *
 * The React Router tree in src/App.jsx is authoritative. These tests pin:
 * - public routes render (deep links work, not only in-app navigation),
 * - unknown paths render the intentional Not Found page,
 * - admin routes redirect unauthenticated visitors to /admin/login and admit
 *   authorized sessions without loops,
 * - /payment/success renders from a verified receipt,
 * - invalid parameterized IDs degrade to not-found empty states.
 * (CMS-driven destination pinning is covered in cms-navigation-guard.test.)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { configure, render, screen, waitFor } from "@testing-library/react";

// Full-App renders under parallel-suite load can exceed the 1s default.
configure({ asyncUtilTimeout: 15000 });

const authMocks = vi.hoisted(() => ({
  watchAuthState: vi.fn(),
}));

vi.mock("@/services/auth", () => ({
  watchAuthState: authMocks.watchAuthState,
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  getIdToken: vi.fn(),
  doSignOut: vi.fn(),
}));

import App from "@/App.jsx";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/services/query";

function renderAppAt(path: string) {
  window.history.pushState({}, "", path);
  const queryClient = createQueryClient();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
  return () => {
    result.unmount();
    queryClient.clear();
    window.history.pushState({}, "", "/");
  };
}

function stubObservers() {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  authMocks.watchAuthState.mockReset();
  // Signed-out by default: resolve immediately so the guard never hangs on loading.
  authMocks.watchAuthState.mockImplementation((cb: (s: unknown) => void) => {
    cb(null);
    return () => undefined;
  });
  stubObservers();
  sessionStorage.clear();
});

describe("public routes", () => {
  it("renders the Donate page on direct /donate access", async () => {
    const reset = renderAppAt("/donate");
    try {
      await waitFor(() => expect(screen.getByRole("button", { name: /DONATE ₹/i })).toBeInTheDocument(), {
        timeout: 15000,
      });
      expect(window.location.pathname).toBe("/donate");
    } finally {
      reset();
    }
  });

  it("renders an intentional 404 for unknown paths (never an unrelated page)", async () => {
    const reset = renderAppAt("/this-route-does-not-exist");
    try {
      await waitFor(() => expect(screen.getByRole("link", { name: /GO HOME/i })).toBeInTheDocument());
      expect(screen.getByRole("link", { name: /EXPLORE FIGHTERS/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /DONATE ₹/i })).not.toBeInTheDocument();
    } finally {
      reset();
    }
  });
});

describe("admin route protection", () => {
  it("redirects unauthenticated visitors from /admin/dashboard to /admin/login", async () => {
    const reset = renderAppAt("/admin/dashboard");
    try {
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /SIGN IN WITH GOOGLE/i })).toBeInTheDocument(),
        { timeout: 15000 },
      );
      expect(window.location.pathname).toBe("/admin/login");
    } finally {
      reset();
    }
  });

  it("admits an authorized session to /admin/dashboard without redirect loops", async () => {
    authMocks.watchAuthState.mockImplementation((cb: (s: unknown) => void) => {
      cb({ uid: "admin-1", email: "admin@example.com", role: "ADMIN" });
      return () => undefined;
    });
    const reset = renderAppAt("/admin/dashboard");
    try {
      await waitFor(() =>
        expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1),
      );
      expect(window.location.pathname).toBe("/admin/dashboard");
      expect(screen.queryByRole("button", { name: /SIGN IN WITH GOOGLE/i })).not.toBeInTheDocument();
    } finally {
      reset();
    }
  });
});

describe("payment success route", () => {
  it("renders the verified receipt on direct /payment/success access", async () => {
    sessionStorage.setItem(
      "usscos:last-paid-receipt",
      JSON.stringify({
        purpose: "DONATION",
        amount: 1000,
        currency: "INR",
        paymentId: "pay_route_1",
        orderId: "order_route_1",
        completedAt: "2026-09-20T10:30:00.000Z",
        savedAt: Date.now(),
      }),
    );
    const reset = renderAppAt("/payment/success");
    try {
      await waitFor(() => expect(screen.getByText(/pay_route_1/i)).toBeInTheDocument(), {
        timeout: 15000,
      });
      expect(screen.getByRole("link", { name: /BACK TO HOME/i })).toBeInTheDocument();
    } finally {
      reset();
    }
  });
});

describe("parameterized routes", () => {
  it("shows a not-found state for an unknown athlete id (no broken screen)", async () => {
    const reset = renderAppAt("/athletes/no-such-fighter");
    try {
      await waitFor(() => expect(screen.getByText(/Fighter not found/i)).toBeInTheDocument(), {
        timeout: 15000,
      });
    } finally {
      reset();
    }
  });
});
