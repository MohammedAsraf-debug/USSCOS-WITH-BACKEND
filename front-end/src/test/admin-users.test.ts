/**
 * Admin user creation client — calls POST /api/admin/users with the staff
 * ID token. The password travels only in the request body to the backend
 * (which forwards it to Firebase Auth); nothing here stores credentials.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConfig = vi.hoisted(() => ({ backendUrl: "https://admin.usscos.test" }));
const mockAuth = vi.hoisted(() => ({ getIdToken: vi.fn() }));

vi.mock("@/lib/config", () => mockConfig);
vi.mock("@/services/auth", () => mockAuth);

import { createAdminUser } from "@/services/admin-users";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAuth.getIdToken.mockReset();
  mockConfig.backendUrl = "https://admin.usscos.test";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createAdminUser", () => {
  it("posts name/email/password/role with a Bearer token and returns the created user", async () => {
    mockAuth.getIdToken.mockResolvedValue("staff-token");
    fetchMock.mockResolvedValue(
      jsonResponse({
        ok: true,
        user: {
          uid: "admin-uid-1",
          name: "New Admin",
          email: "new.admin@example.com",
          role: "ADMIN",
          status: "active",
          createdAt: "2026-09-24T10:00:00.000Z",
        },
      }),
    );

    const result = await createAdminUser({
      name: "New Admin",
      email: "new.admin@example.com",
      password: "TempPass123",
      role: "ADMIN",
    });

    expect(result).toEqual({
      ok: true,
      user: expect.objectContaining({ uid: "admin-uid-1", role: "ADMIN" }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://admin.usscos.test/api/admin/users");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer staff-token");
    expect(JSON.parse(String(init.body))).toMatchObject({
      name: "New Admin",
      email: "new.admin@example.com",
      role: "ADMIN",
    });
  });

  it("fails safe when the backend is not configured (no network)", async () => {
    mockConfig.backendUrl = "";
    const result = await createAdminUser({
      name: "New Admin",
      email: "new.admin@example.com",
      password: "TempPass123",
      role: "ADMIN",
    });
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a signed-in staff session", async () => {
    mockAuth.getIdToken.mockResolvedValue(null);
    const result = await createAdminUser({
      name: "New Admin",
      email: "new.admin@example.com",
      password: "TempPass123",
      role: "ADMIN",
    });
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces the backend's safe error message on failure", async () => {
    mockAuth.getIdToken.mockResolvedValue("staff-token");
    fetchMock.mockResolvedValue(jsonResponse({ code: "FORBIDDEN", message: "Only SUPER_ADMIN accounts can create admins." }, 403));
    const result = await createAdminUser({
      name: "New Admin",
      email: "new.admin@example.com",
      password: "TempPass123",
      role: "ADMIN",
    });
    expect(result).toEqual({ ok: false, message: "Only SUPER_ADMIN accounts can create admins." });
  });

  it("handles network failure without throwing", async () => {
    mockAuth.getIdToken.mockResolvedValue("staff-token");
    fetchMock.mockRejectedValue(new Error("offline"));
    const result = await createAdminUser({
      name: "New Admin",
      email: "new.admin@example.com",
      password: "TempPass123",
      role: "CONTENT_MANAGER",
    });
    expect(result.ok).toBe(false);
  });
});
