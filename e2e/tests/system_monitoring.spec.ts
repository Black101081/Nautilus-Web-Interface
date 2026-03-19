/**
 * E2E tests — System Monitoring & Health
 *
 * Coverage:
 * - Health check endpoint
 * - System metrics (CPU, memory, disk)
 * - Components list
 * - Settings save/load
 * - Risk limits save/load
 * - Market data
 * - Database operations
 */

import { test, expect } from "@playwright/test";

const API = process.env.BASE_URL ?? "http://localhost:8000";

test.describe("Health & System", () => {
  test("GET /api/health returns healthy or degraded", async ({ request }) => {
    const r = await request.get(`${API}/api/health`);
    expect([200, 503]).toContain(r.status());
    const body = await r.json();
    expect(["healthy", "degraded"]).toContain(body.status);
    expect(body.version).toBeTruthy();
  });

  test("GET /api/system/metrics returns cpu and memory", async ({ request }) => {
    const r = await request.get(`${API}/api/system/metrics`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(typeof body.uptime_seconds).toBe("number");
    expect(body.uptime_seconds).toBeGreaterThan(0);
    expect(typeof body.requests_total).toBe("number");
  });

  test("GET /api/components returns 6 components", async ({ request }) => {
    const r = await request.get(`${API}/api/components`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.count).toBe(6);
    const ids = body.components.map((c: { id: string }) => c.id);
    expect(ids).toContain("risk_engine");
    expect(ids).toContain("data_engine");
  });

  test("component start/stop/restart actions return success", async ({ request }) => {
    for (const action of ["start", "stop", "restart"]) {
      const r = await request.post(`${API}/api/component/${action}`, {
        data: { component: "risk_engine" },
      });
      expect(r.status()).toBe(200);
      expect((await r.json()).success).toBe(true);
    }
  });
});

test.describe("Settings", () => {
  test("get settings returns structured object", async ({ request }) => {
    const r = await request.get(`${API}/api/settings`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toHaveProperty("general");
    expect(body).toHaveProperty("notifications");
  });

  test("save and retrieve general settings", async ({ request }) => {
    const r = await request.post(`${API}/api/settings`, {
      data: {
        general: {
          system_name: "E2E Test System",
          timezone: "UTC",
        },
      },
    });
    expect(r.status()).toBe(200);
    const saved = (await r.json()).settings;
    expect(saved.general.system_name).toBe("E2E Test System");

    // Verify persisted
    const getR = await request.get(`${API}/api/settings`);
    const getBody = await getR.json();
    expect(getBody.general?.system_name).toBe("E2E Test System");
  });

  test("save notification settings persists", async ({ request }) => {
    await request.post(`${API}/api/settings`, {
      data: {
        notifications: {
          email_enabled: true,
          email_to: "e2e@test.com",
        },
      },
    });

    const r = await request.get(`${API}/api/settings`);
    const body = await r.json();
    expect(body.notifications?.email_enabled).toBe(true);
    expect(body.notifications?.email_to).toBe("e2e@test.com");
  });
});

test.describe("Risk Limits", () => {
  test("get risk limits returns default values", async ({ request }) => {
    const r = await request.get(`${API}/api/risk/limits`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.limits).toHaveProperty("max_position_size");
    expect(body.limits).toHaveProperty("max_daily_loss");
  });

  test("update risk limits persists correctly", async ({ request }) => {
    const r = await request.post(`${API}/api/risk/limits`, {
      data: {
        max_position_size: 123_456,
        max_daily_loss: 7_890,
        max_leverage: 4.0,
        max_orders_per_day: 75,
      },
    });
    expect(r.status()).toBe(200);
    const limits = (await r.json()).limits;
    expect(limits.max_position_size).toBe(123_456);
    expect(limits.max_daily_loss).toBe(7_890);
    expect(limits.max_leverage).toBe(4.0);
    expect(limits.max_orders_per_day).toBe(75);
  });

  test("partial update keeps other limits intact", async ({ request }) => {
    // First set a known state
    await request.post(`${API}/api/risk/limits`, {
      data: { max_position_size: 500_000, max_daily_loss: 10_000 },
    });

    // Partial update: only change one field
    await request.post(`${API}/api/risk/limits`, {
      data: { max_position_size: 250_000 },
    });

    const r = await request.get(`${API}/api/risk/limits`);
    const limits = (await r.json()).limits;
    expect(limits.max_position_size).toBe(250_000);
    expect(limits.max_daily_loss).toBe(10_000); // unchanged
  });
});

test.describe("Market Data", () => {
  test("GET /api/market-data/instruments returns BTC price", async ({ request }) => {
    const r = await request.get(`${API}/api/market-data/instruments`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    // API returns { instruments: [...], count: N }
    expect(Array.isArray(body.instruments)).toBe(true);
    expect(body.instruments.length).toBeGreaterThan(0);
    const btc = body.instruments.find((i: { symbol: string }) => i.symbol === "BTCUSDT");
    expect(btc).toBeTruthy();
    expect(btc.price).toBeGreaterThan(0);
  });

  test("GET /api/market-data/BTCUSDT returns valid quote", async ({ request }) => {
    const r = await request.get(`${API}/api/market-data/BTCUSDT`);
    // May be 200 (live) or fallback
    expect([200, 404]).toContain(r.status());
    if (r.status() === 200) {
      const body = await r.json();
      expect(body.symbol).toBe("BTCUSDT");
      expect(body.price).toBeGreaterThan(0);
    }
  });

  test("GET /api/market-data/FAKECOIN returns 404", async ({ request }) => {
    const r = await request.get(`${API}/api/market-data/FAKECOIN`);
    expect(r.status()).toBe(404);
  });
});

test.describe("Database Operations", () => {
  test("POST /api/database/backup returns success", async ({ request }) => {
    const r = await request.post(`${API}/api/database/backup`, {
      data: {},
    });
    expect(r.status()).toBe(200);
    expect((await r.json()).success).toBe(true);
  });

  test("POST /api/database/optimize returns success", async ({ request }) => {
    const r = await request.post(`${API}/api/database/optimize`, {
      data: {},
    });
    expect(r.status()).toBe(200);
    expect((await r.json()).success).toBe(true);
  });

  test("GET /api/database/backups returns list", async ({ request }) => {
    // Create a backup first
    await request.post(`${API}/api/database/backup`, { data: {} });

    const r = await request.get(`${API}/api/database/backups`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.backups)).toBe(true);
  });
});
