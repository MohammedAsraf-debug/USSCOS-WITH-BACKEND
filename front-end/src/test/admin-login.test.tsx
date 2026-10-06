// @vitest-environment jsdom
/**
 * Admin login flows.
 *
 * Google sign-in (existing) and email/password sign-in (for accounts
 * provisioned via POST /api/admin/users) both resolve through the same
 * session/role machinery: a session navigates to the dashboard, anything
 * else stays on the login page with a safe error. Passwords are never
 * asserted on, logged, or retained.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@/context/ToastContext.jsx";
import AdminLogin from "@/pages/admin/AdminLogin.jsx";

const mocks = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  watchAuthState: vi.fn(),
}));

vi.mock("@/services/auth", () => ({
  signInWithGoogle: mocks.signInWithGoogle,
  signInWithEmail: mocks.signInWithEmail,
  watchAuthState: mocks.watchAuthState,
}));

function renderLogin() {
  render(
    <MemoryRouter initialEntries={["/admin/login"]}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<div>DASHBOARD STUB</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.signInWithGoogle.mockReset();
  mocks.signInWithEmail.mockReset();
  mocks.watchAuthState.mockReset();
  // Signed-out by default: session callback receives null.
  mocks.watchAuthState.mockImplementation(() => () => undefined);
});

describe("AdminLogin", () => {
  it("Google sign-in navigates to the dashboard on an authorized session", async () => {
    mocks.signInWithGoogle.mockResolvedValue({ uid: "sa-1", email: "sa@example.com", role: "SUPER_ADMIN" });
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: /SIGN IN WITH GOOGLE/i }));
    await waitFor(() => expect(screen.getByText("DASHBOARD STUB")).toBeInTheDocument());
    expect(mocks.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it("Google sign-in stays on login with an error when unauthorized", async () => {
    mocks.signInWithGoogle.mockResolvedValue(null);
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: /SIGN IN WITH GOOGLE/i }));
    await waitFor(() => expect(mocks.signInWithGoogle).toHaveBeenCalled());
    expect(screen.queryByText("DASHBOARD STUB")).not.toBeInTheDocument();
    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
  });

  it("email sign-in calls the service with entered credentials and navigates on session", async () => {
    mocks.signInWithEmail.mockResolvedValue({ uid: "admin-1", email: "new.admin@example.com", role: "ADMIN" });
    renderLogin();

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "new.admin@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "TempPass123" } });
    fireEvent.click(screen.getByRole("button", { name: /^SIGN IN WITH EMAIL$/i }));

    await waitFor(() => expect(mocks.signInWithEmail).toHaveBeenCalledWith("new.admin@example.com", "TempPass123"));
    await waitFor(() => expect(screen.getByText("DASHBOARD STUB")).toBeInTheDocument());
  });

  it("email sign-in failure stays on login, shows a safe error, and clears the password", async () => {
    const err = new Error("Firebase: Error (auth/invalid-credential).");
    (err as unknown as Record<string, string>).code = "auth/invalid-credential";
    mocks.signInWithEmail.mockRejectedValue(err);
    renderLogin();

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "new.admin@example.com" } });
    const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: "TempPass123" } });
    fireEvent.click(screen.getByRole("button", { name: /^SIGN IN WITH EMAIL$/i }));

    await waitFor(() => expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument());
    expect(screen.queryByText("DASHBOARD STUB")).not.toBeInTheDocument();
    // Password must not be retained after the attempt.
    expect((screen.getByLabelText(/Password/i) as HTMLInputElement).value).toBe("");
    // No credential material in the visible error.
    expect(screen.queryByText(/TempPass123/)).not.toBeInTheDocument();
  });

  it("unauthorized account (null session) stays on login with an error", async () => {
    mocks.signInWithEmail.mockResolvedValue(null);
    renderLogin();

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "someone@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "TempPass123" } });
    fireEvent.click(screen.getByRole("button", { name: /^SIGN IN WITH EMAIL$/i }));

    await waitFor(() => expect(screen.getByText(/not authorized/i)).toBeInTheDocument());
    expect(screen.queryByText("DASHBOARD STUB")).not.toBeInTheDocument();
  });

  it("signed-out visitor stays on the login page", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: /SIGN IN WITH GOOGLE/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^SIGN IN WITH EMAIL$/i })).toBeInTheDocument();
    expect(screen.queryByText("DASHBOARD STUB")).not.toBeInTheDocument();
  });
});
