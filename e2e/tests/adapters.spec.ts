/**
 * E2E tests — Adapters
 *
 * Coverage:
 * - List adapters
 * - Connect/disconnect flow
 * - Credential validation
 * - Status persistence
 * - Security: plaintext credentials must not appear in responses
 */

import { test, expect } from "@playwright/test";

const API = process.env.BASE_URL ?? "http://localhost:8000";

test.describe("Adapters API", () => {
  test("list adapters returns 11+ adapters", async ({ request }) => {
    const r = await request.get(`${API}/api/adapters`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.count).toBeGreaterThanOrEqual(11);
    const ids = body.adapters.map((a: { id: string }) => a.id);
    expect(ids).toContain("binance");
    expect(ids).toContain("bybit");
    expect(ids).toContain("interactive_brokers");
  });

  test("get single adapter by id", async ({ request }) => {
    const r = await request.get(`${API}/api/adapters/binance`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.id).toBe("binance");
    expect(body.name).toBeTruthy();
    expect(body.status).toBeTruthy();
  });

  test("get unknown adapter returns 404", async ({ request }) => {
    const r = await request.get(`${API}/api/adapters/fake_exchange_xyz`);
    expect(r.status()).toBe(404);
  });

  test("connect adapter with valid credentials returns connected status", async ({ request }) => {
    const r = await request.post(`${API}/api/adapters/binance/connect`, {
      data: { api_key: "test_key_e2e", api_secret: "test_secret_e2e" },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("connected");
  });

  test("connect adapter without credentials returns 400", async ({ request }) => {
    const r = await request.post(`${API}/api/adapters/binance/connect`, {
      data: {},
    });
    expect(r.status()).toBe(400);
  });

  test("connect then disconnect changes status to disconnected", async ({ request }) => {
    await request.post(`${API}/api/adapters/bybit/connect`, {
      data: { api_key: "k", api_secret: "s" },
    });

    const r = await request.post(`${API}/api/adapters/bybit/disconnect`);
    expect(r.status()).toBe(200);
    expect((await r.json()).status).toBe("disconnected");
  });

  test("connected status persists across GET calls", async ({ request }) => {
    await request.post(`${API}/api/adapters/okx/connect`, {
      data: { api_key: "mykey", api_secret: "mysecret" },
    });

    const r = await request.get(`${API}/api/adapters/okx`);
    expect((await r.json()).status).toBe("connected");
  });

  test("disconnect unknown adapter returns 404", async ({ request }) => {
    const r = await request.post(`${API}/api/adapters/nonexistent_xyz/disconnect`);
    expect(r.status()).toBe(404);
  });

  // ── Security checks (will fail until Sprint 1 encryption implemented) ────

  test("GET adapters list does not leak plaintext credentials", async ({ request }) => {
    const secretKey = "SUPER_SECRET_E2E_KEY_12345";
    await request.post(`${API}/api/adapters/binance/connect`, {
      data: { api_key: secretKey, api_secret: "secret_value_xyz" },
    });

    const r = await request.get(`${API}/api/adapters`);
    const responseText = await r.text();

    // This test is lenient: it passes currently because adapters list doesn't return api_key at all.
    // After Sprint 1, it should also not return encrypted form that could be mistaken for plaintext.
    expect(responseText).not.toContain("SUPER_SECRET_E2E_KEY_12345");
  });

  test("GET single adapter does not return full plaintext api_key", async ({ request }) => {
    const secretKey = "MY_FULL_API_KEY_SHOULD_BE_MASKED";
    await request.post(`${API}/api/adapters/binance/connect`, {
      data: { api_key: secretKey, api_secret: "secret_xyz" },
    });

    const r = await request.get(`${API}/api/adapters/binance`);
    const responseText = await r.text();

    // The full key should never appear in the response
    expect(responseText).not.toContain("MY_FULL_API_KEY_SHOULD_BE_MASKED");
  });
});
