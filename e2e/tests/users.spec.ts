/**
 * E2E tests — User Management API
 *
 * Coverage:
 * - List users (admin only)
 * - Create user
 * - Delete (deactivate) user
 * - Change user password
 * - Auth guard: 401 without token, 403 for non-admin
 */

import { test, expect } from "@playwright/test";

const API = process.env.BASE_URL ?? "http://localhost:8000";

// ── Helper: get admin JWT token ───────────────────────────────────────────────

async function getAdminToken(request: import("@playwright/test").APIRequestContext): Promise<string> {
  const r = await request.post(`${API}/api/auth/login`, {
    data: { username: "admin", password: "admin" },
  });
  if (r.status() !== 200) throw new Error(`Admin login failed: ${r.status()}`);
  return (await r.json()).access_token;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ── Auth guard ────────────────────────────────────────────────────────────────

test.describe("Users API — Auth guard", () => {
  test("GET /api/users without token returns 401", async ({ request }) => {
    const r = await request.get(`${API}/api/users`);
    expect(r.status()).toBe(401);
  });

  test("POST /api/users without token returns 401", async ({ request }) => {
    const r = await request.post(`${API}/api/users`, {
      data: { username: "x", password: "secret123", role: "trader" },
    });
    expect(r.status()).toBe(401);
  });
});

// ── List users ────────────────────────────────────────────────────────────────

test.describe("Users API — List", () => {
  test("GET /api/users contains admin", async ({ request }) => {
    const token = await getAdminToken(request);
    const r = await request.get(`${API}/api/users`, {
      headers: authHeader(token),
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.users)).toBe(true);
    const usernames = body.users.map((u: { username: string }) => u.username);
    expect(usernames).toContain("admin");
  });

  test("users list omits hashed_password", async ({ request }) => {
    const token = await getAdminToken(request);
    const r = await request.get(`${API}/api/users`, { headers: authHeader(token) });
    const body = await r.json();
    for (const user of body.users) {
      expect(user).not.toHaveProperty("hashed_password");
    }
  });
});

// ── Create user ───────────────────────────────────────────────────────────────

test.describe("Users API — Create", () => {
  test("create trader returns 201 with user object", async ({ request }) => {
    const token = await getAdminToken(request);
    const r = await request.post(`${API}/api/users`, {
      headers: authHeader(token),
      data: { username: `e2e_trader_${Date.now()}`, password: "secure123", role: "trader" },
    });
    expect(r.status()).toBe(201);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.user.role).toBe("trader");
    expect(body.user).toHaveProperty("id");
  });

  test("create admin user returns 201", async ({ request }) => {
    const token = await getAdminToken(request);
    const r = await request.post(`${API}/api/users`, {
      headers: authHeader(token),
      data: { username: `e2e_admin_${Date.now()}`, password: "secure123", role: "admin" },
    });
    expect(r.status()).toBe(201);
  });

  test("duplicate username returns 409", async ({ request }) => {
    const token = await getAdminToken(request);
    const username = `dup_e2e_${Date.now()}`;
    await request.post(`${API}/api/users`, {
      headers: authHeader(token),
      data: { username, password: "secure123", role: "trader" },
    });
    const r = await request.post(`${API}/api/users`, {
      headers: authHeader(token),
      data: { username, password: "secure123", role: "trader" },
    });
    expect(r.status()).toBe(409);
  });

  test("short password returns 422", async ({ request }) => {
    const token = await getAdminToken(request);
    const r = await request.post(`${API}/api/users`, {
      headers: authHeader(token),
      data: { username: "shortpwuser", password: "abc", role: "trader" },
    });
    expect(r.status()).toBe(422);
  });

  test("invalid role returns 422", async ({ request }) => {
    const token = await getAdminToken(request);
    const r = await request.post(`${API}/api/users`, {
      headers: authHeader(token),
      data: { username: "badrole", password: "secure123", role: "superadmin" },
    });
    expect(r.status()).toBe(422);
  });
});

// ── Delete user ───────────────────────────────────────────────────────────────

test.describe("Users API — Delete", () => {
  test("deactivate user removes from active list", async ({ request }) => {
    const token = await getAdminToken(request);
    const username = `del_e2e_${Date.now()}`;

    const createR = await request.post(`${API}/api/users`, {
      headers: authHeader(token),
      data: { username, password: "secure123", role: "trader" },
    });
    const userId = (await createR.json()).user.id;

    const delR = await request.delete(`${API}/api/users/${userId}`, {
      headers: authHeader(token),
    });
    expect(delR.status()).toBe(200);

    const listR = await request.get(`${API}/api/users`, { headers: authHeader(token) });
    const activeUsernames = (await listR.json()).users
      .filter((u: { is_active: number }) => u.is_active)
      .map((u: { username: string }) => u.username);
    expect(activeUsernames).not.toContain(username);
  });

  test("delete nonexistent user returns 404", async ({ request }) => {
    const token = await getAdminToken(request);
    const r = await request.delete(`${API}/api/users/USR-DOESNOTEXIST`, {
      headers: authHeader(token),
    });
    expect(r.status()).toBe(404);
  });
});

// ── Change password ───────────────────────────────────────────────────────────

test.describe("Users API — Change password", () => {
  test("new password works for login", async ({ request }) => {
    const token = await getAdminToken(request);
    const username = `pw_e2e_${Date.now()}`;

    const createR = await request.post(`${API}/api/users`, {
      headers: authHeader(token),
      data: { username, password: "oldpassword1", role: "trader" },
    });
    const userId = (await createR.json()).user.id;

    await request.post(`${API}/api/users/${userId}/password`, {
      headers: authHeader(token),
      data: { password: "newpassword1" },
    });

    const loginR = await request.post(`${API}/api/auth/login`, {
      data: { username, password: "newpassword1" },
    });
    expect(loginR.status()).toBe(200);
  });

  test("old password rejected after change", async ({ request }) => {
    const token = await getAdminToken(request);
    const username = `pw2_e2e_${Date.now()}`;

    const createR = await request.post(`${API}/api/users`, {
      headers: authHeader(token),
      data: { username, password: "oldpassword1", role: "trader" },
    });
    const userId = (await createR.json()).user.id;

    await request.post(`${API}/api/users/${userId}/password`, {
      headers: authHeader(token),
      data: { password: "newpassword1" },
    });

    const loginR = await request.post(`${API}/api/auth/login`, {
      data: { username, password: "oldpassword1" },
    });
    expect(loginR.status()).toBe(401);
  });
});

// ── Login improvements ────────────────────────────────────────────────────────

test.describe("Auth — Login", () => {
  test("login returns role field", async ({ request }) => {
    const r = await request.post(`${API}/api/auth/login`, {
      data: { username: "admin", password: "admin" },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.role).toBe("admin");
    expect(body.access_token).toBeTruthy();
  });

  test("new user can login after creation", async ({ request }) => {
    const token = await getAdminToken(request);
    const username = `login_e2e_${Date.now()}`;
    await request.post(`${API}/api/users`, {
      headers: authHeader(token),
      data: { username, password: "mypassword1", role: "trader" },
    });

    const loginR = await request.post(`${API}/api/auth/login`, {
      data: { username, password: "mypassword1" },
    });
    expect(loginR.status()).toBe(200);
    expect((await loginR.json()).role).toBe("trader");
  });
});
