// @vitest-environment jsdom
/**
 * Admin session lifecycle.
 *
 * Loading never redirects prematurely; logout clears the session and lands
 * on login; an active session survives in-app navigation. Backend
 * authorization stays authoritative — these tests pin UX behavior only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, configure } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/App.jsx";

const authMocks = vi.hoisted(() => ({
  watchAuthState: vi.fn(),
  doSignOut: vi.fn(),
}));

vi.mock("@/services/auth", () => ({
  watchAuthState: authMocks.watchAuthState,
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  getIdToken: vi.fn(),
  doSignOut: authMocks.doSignOut,
}));

type SessionCb = (s: unknown) => void;

// Full-App renders under parallel-suite load can exceed the 1s default.
configure({ asyncUtilTimeout: 15000 });

// Minimal in-test auth service: one shared session broadcast to every
// subscriber, mirroring watchAuthState/doSignOut semantics.
let currentSession: unknown = null;
const subscribers = new Set<SessionCb>();

function setSession(session: unknown) {
  currentSession = session;
  for (const cb of [...subscribers]) cb(session);
}

function renderAppAt(path: string) {
  window.history.pushState({}, "", path);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
  authMocks.doSignOut.mockReset();
  authMocks.doSignOut.mockImplementation(async () => {
    setSession(null);
  });
  authMocks.watchAuthState.mockImplementation((cb: SessionCb) => {
    subscribers.add(cb);
    cb(currentSession);
    return () => {
      subscribers.delete(cb);
    };
  });
  currentSession = null;
  subscribers.clear();
  stubObservers();
});

const ADMIN_SESSION = { uid: "admin-1", email: "admin@example.com", role: "ADMIN" };

describe("admin session lifecycle", () => {
  it("shows loading with no redirect while auth state is unknown", async () => {
    authMocks.watchAuthState.mockImplementation(() => () => undefined);
    const reset = renderAppAt("/admin/dashboard");
    try {
      await waitFor(() => expect(screen.getByRole("status", { name: /Loading/i })).toBeInTheDocument());
      // Neither the login form nor the dashboard may render prematurely.
      expect(screen.queryByRole("button", { name: /SIGN IN WITH GOOGLE/i })).not.toBeInTheDocument();
      expect(window.location.pathname).toBe("/admin/dashboard");
    } finally {
      reset();
    }
  });

  it("logout clears the session and lands on the login page", async () => {
    await act(async () => {
      setSession({ ...ADMIN_SESSION });
    });
    const reset = renderAppAt("/admin/dashboard");
    try {
      await waitFor(() =>
        expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1),
      );
      fireEvent.click(screen.getByRole("button", { name: /^Logout$/i }));
      await waitFor(() => expect(authMocks.doSignOut).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /SIGN IN WITH GOOGLE/i })).toBeInTheDocument(),
      );
      expect(window.location.pathname).toBe("/admin/login");
    } finally {
      reset();
    }
  });

  it("active session survives in-app navigation between admin routes", async () => {
    await act(async () => {
      setSession({ ...ADMIN_SESSION });
    });
    const reset = renderAppAt("/admin/dashboard");
    try {
      await waitFor(() =>
        expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1),
      );
      fireEvent.click(screen.getByRole("link", { name: /Settings/i }));
      await waitFor(() => expect(screen.getByText(/Manage your profile/i)).toBeInTheDocument());
      expect(window.location.pathname).toBe("/admin/settings");
    } finally {
      reset();
    }
  });
});
