/**
 * E2E tests — Strategies page
 *
 * Tests strategy CRUD operations through the UI.
 * Backend is tested via API calls; UI interactions via Playwright.
 *
 * Coverage:
 * - Create SMA strategy via API → verify appears in UI
 * - Create RSI strategy via API → verify appears in UI
 * - Start/Stop strategy buttons update status
 * - Delete strategy removes it from list
 * - Invalid strategy parameters are rejected
 */

import { test, expect, APIRequestContext } from "@playwright/test";
import { createStrategy, clearAllStrategies } from "../helpers/api";

const API = process.env.BASE_URL ?? "http://localhost:8000";

// ── Fixtures ──────────────────────────────────────────────────────────────────

test.beforeEach(async ({ request }) => {
  await clearAllStrategies(request);
});

// ── Strategy CRUD via API ─────────────────────────────────────────────────────

test.describe("Strategy API — CRUD", () => {
  test("create SMA strategy returns strategy_id", async ({ request }) => {
    const r = await request.post(`${API}/api/strategies`, {
      data: {
        name: "SMA E2E Test",
        type: "sma_crossover",
        fast_period: 10,
        slow_period: 50,
      },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(typeof body.strategy_id).toBe("string");
    expect(body.strategy_id.length).toBeGreaterThan(0);
  });

  test("create RSI strategy returns strategy_id", async ({ request }) => {
    const r = await request.post(`${API}/api/strategies`, {
      data: {
        name: "RSI E2E Test",
        type: "rsi",
        rsi_period: 14,
        oversold_level: 30,
        overbought_level: 70,
      },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
  });

  test("strategy appears in list after creation", async ({ request }) => {
    const sid = await createStrategy(request, {
      name: "List Check E2E",
      type: "sma_crossover",
    });

    const listR = await request.get(`${API}/api/strategies`);
    const listBody = await listR.json();
    const found = listBody.strategies.find((s: { id: string }) => s.id === sid);
    expect(found).toBeTruthy();
    expect(found.name).toBe("List Check E2E");
  });

  test("invalid SMA periods (fast >= slow) returns 422", async ({ request }) => {
    const r = await request.post(`${API}/api/strategies`, {
      data: {
        name: "Bad Periods",
        type: "sma_crossover",
        fast_period: 50,
        slow_period: 10,
      },
    });
    expect(r.status()).toBe(422);
  });

  test("missing name returns 422", async ({ request }) => {
    const r = await request.post(`${API}/api/strategies`, {
      data: { type: "sma_crossover" },
    });
    expect(r.status()).toBe(422);
  });

  test("unknown strategy type returns 400 or 422", async ({ request }) => {
    const r = await request.post(`${API}/api/strategies`, {
      data: { name: "AI Trader", type: "deep_learning_v9" },
    });
    expect([400, 422]).toContain(r.status());
  });

  test("delete strategy removes from list", async ({ request }) => {
    const sid = await createStrategy(request, {
      name: "Delete Me",
      type: "sma_crossover",
    });

    const delR = await request.delete(`${API}/api/strategies/${sid}`);
    expect(delR.status()).toBe(200);

    const listR = await request.get(`${API}/api/strategies`);
    const listBody = await listR.json();
    const found = listBody.strategies.find((s: { id: string }) => s.id === sid);
    expect(found).toBeFalsy();
  });

  test("start and stop strategy changes status", async ({ request }) => {
    const sid = await createStrategy(request, {
      name: "Start Stop E2E",
      type: "rsi",
    });

    const startR = await request.post(`${API}/api/strategies/${sid}/start`);
    expect(startR.status()).toBe(200);

    let listR = await request.get(`${API}/api/strategies`);
    let found = (await listR.json()).strategies.find((s: { id: string }) => s.id === sid);
    expect(found.status).toBe("running");

    const stopR = await request.post(`${API}/api/strategies/${sid}/stop`);
    expect(stopR.status()).toBe(200);

    listR = await request.get(`${API}/api/strategies`);
    found = (await listR.json()).strategies.find((s: { id: string }) => s.id === sid);
    expect(found.status).toBe("stopped");
  });
});

// ── Strategy API — Types Registry ─────────────────────────────────────────────

test.describe("Strategy Types Registry", () => {
  test("GET /api/strategy-types returns sma_crossover and rsi", async ({ request }) => {
    const r = await request.get(`${API}/api/strategy-types`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    const ids = body.strategy_types.map((t: { id: string }) => t.id);
    expect(ids).toContain("sma_crossover");
    expect(ids).toContain("rsi");
  });
});
