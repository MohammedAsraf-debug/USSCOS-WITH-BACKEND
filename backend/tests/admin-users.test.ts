import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { FakeAdminAuth, FakeRazorpay, FakeVerifier, MemoryFirestoreGateway, testConfig } from "./fakes.js";

function setup(tokens: Record<string, string> = { "sa-token": "sa-1", "admin-token": "admin-1", "cm-token": "cm-1" }) {
  const gateway = new MemoryFirestoreGateway();
  const users = new FakeAdminAuth();
  const storagePath = testConfig().privateStoragePath;
  const app = createApp({
    config: testConfig({ privateStoragePath: storagePath }),
    gateway,
    verifier: new FakeVerifier(tokens),
    razorpay: new FakeRazorpay(),
    storagePath,
    users,
  });
  return { app, gateway, users };
}

async function seedCaller(gateway: MemoryFirestoreGateway, uid: string, role: string, status = "active") {
  await gateway.set("users", uid, { uid, name: `${role} User`, email: `${uid}@example.com`, role, status });
}

function newAdmin(overrides: Record<string, unknown> = {}) {
  return {
    name: "New Admin",
    email: "new.admin@example.com",
    password: "TempPass123",
    role: "ADMIN",
    ...overrides,
  };
}

describe("POST /api/admin/users", () => {
  let app: ReturnType<typeof createApp>;
  let gateway: MemoryFirestoreGateway;
  let users: FakeAdminAuth;
  beforeEach(() => {
    ({ app, gateway, users } = setup());
  });

  it("SUPER_ADMIN can create an ADMIN (Auth user + Firestore record)", async () => {
    await seedCaller(gateway, "sa-1", "SUPER_ADMIN");
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", "Bearer sa-token")
      .send(newAdmin());
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.user.uid).toBe("admin-uid-1");
    expect(res.body.user.role).toBe("ADMIN");
    expect(res.body.user.status).toBe("active");
    // Auth user created server-side with email + display name; no password stored.
    expect(users.created).toHaveLength(1);
    expect(users.created[0]).toMatchObject({ email: "new.admin@example.com", displayName: "New Admin" });
    // Firestore role record carries the full schema, never the password.
    const stored = await gateway.get("users", "admin-uid-1");
    expect(stored).toMatchObject({
      uid: "admin-uid-1",
      name: "New Admin",
      email: "new.admin@example.com",
      role: "ADMIN",
      status: "active",
    });
    expect(typeof stored?.createdAt).toBe("string");
    expect(typeof stored?.updatedAt).toBe("string");
    expect("password" in (stored ?? {})).toBe(false);
  });

  it("SUPER_ADMIN can create a CONTENT_MANAGER", async () => {
    await seedCaller(gateway, "sa-1", "SUPER_ADMIN");
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", "Bearer sa-token")
      .send(newAdmin({ role: "CONTENT_MANAGER", email: "cm.new@example.com" }));
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("CONTENT_MANAGER");
    expect((await gateway.get("users", res.body.user.uid))?.role).toBe("CONTENT_MANAGER");
  });

  it("ADMIN cannot create a SUPER_ADMIN (or anyone)", async () => {
    await seedCaller(gateway, "admin-1", "ADMIN");
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", "Bearer admin-token")
      .send(newAdmin({ role: "SUPER_ADMIN" }));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
    expect(users.created).toHaveLength(0);
  });

  it("CONTENT_MANAGER cannot create admins", async () => {
    await seedCaller(gateway, "cm-1", "CONTENT_MANAGER");
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", "Bearer cm-token")
      .send(newAdmin());
    expect(res.status).toBe(403);
    expect(users.created).toHaveLength(0);
  });

  it("missing token gets 401", async () => {
    const res = await request(app).post("/api/admin/users").send(newAdmin());
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
    expect(users.created).toHaveLength(0);
  });

  it("invalid token gets 401", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", "Bearer bogus-token")
      .send(newAdmin());
    expect(res.status).toBe(401);
    expect(users.created).toHaveLength(0);
  });

  it("duplicate email is handled with 409 and no Firestore write", async () => {
    await seedCaller(gateway, "sa-1", "SUPER_ADMIN");
    users.createError = { code: "auth/email-already-exists" };
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", "Bearer sa-token")
      .send(newAdmin());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EMAIL_EXISTS");
    expect(await gateway.get("users", "admin-uid-1")).toBeNull();
  });

  it("invalid role is rejected (SUPER_ADMIN cannot be created here)", async () => {
    await seedCaller(gateway, "sa-1", "SUPER_ADMIN");
    for (const role of ["SUPER_ADMIN", "EDITOR", ""]) {
      const res = await request(app)
        .post("/api/admin/users")
        .set("Authorization", "Bearer sa-token")
        .send(newAdmin({ role, email: `${role || "empty"}@example.com` }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_ROLE");
    }
    expect(users.created).toHaveLength(0);
  });

  it("invalid email is rejected", async () => {
    await seedCaller(gateway, "sa-1", "SUPER_ADMIN");
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", "Bearer sa-token")
      .send(newAdmin({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_EMAIL");
    expect(users.created).toHaveLength(0);
  });

  it("weak password is rejected", async () => {
    await seedCaller(gateway, "sa-1", "SUPER_ADMIN");
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", "Bearer sa-token")
      .send(newAdmin({ password: "123" }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("WEAK_PASSWORD");
    expect(users.created).toHaveLength(0);
  });

  it("Firebase Auth creation failure is handled without a Firestore write", async () => {
    await seedCaller(gateway, "sa-1", "SUPER_ADMIN");
    users.createError = { code: "auth/internal-error" };
    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", "Bearer sa-token")
      .send(newAdmin());
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("SERVER_ERROR");
    expect(await gateway.get("users", "admin-uid-1")).toBeNull();
  });

  it("Firestore failure triggers Auth rollback (no orphan account)", async () => {
    await seedCaller(gateway, "sa-1", "SUPER_ADMIN");
    const failing = new MemoryFirestoreGateway();
    // Seed caller on the failing gateway, then break set() for new docs.
    await failing.set("users", "sa-1", { uid: "sa-1", name: "SA", email: "sa@example.com", role: "SUPER_ADMIN", status: "active" });
    const realSet = failing.set.bind(failing);
    failing.set = async (col: string, id: string, data: Record<string, unknown>) => {
      if (id !== "sa-1") throw new Error("firestore unavailable");
      return realSet(col, id, data);
    };
    const storagePath = testConfig().privateStoragePath;
    const rollbackApp = createApp({
      config: testConfig({ privateStoragePath: storagePath }),
      gateway: failing,
      verifier: new FakeVerifier({ "sa-token": "sa-1" }),
      razorpay: new FakeRazorpay(),
      storagePath,
      users,
    });
    const res = await request(rollbackApp)
      .post("/api/admin/users")
      .set("Authorization", "Bearer sa-token")
      .send(newAdmin());
    expect(res.status).toBe(500);
    // Auth user was created, then deleted again — nothing orphaned.
    expect(users.created).toHaveLength(1);
    expect(users.deleted).toEqual(["admin-uid-1"]);
    expect(await failing.get("users", "admin-uid-1")).toBeNull();
  });
});
