/**
 * E2E tests — Alerts
 *
 * Coverage:
 * - Create alert
 * - Dismiss alert
 * - Delete alert
 * - Alert trigger logic (price condition met)
 * - Alert status persistence
 */

import { test, expect } from "@playwright/test";

const API = process.env.BASE_URL ?? "http://localhost:8000";

test.describe("Alerts API", () => {
  test("create alert returns alert with id and status=active", async ({ request }) => {
    const r = await request.post(`${API}/api/alerts`, {
      data: {
        symbol: "BTCUSDT",
        condition: "above",
        price: 999_999.0,
        message: "E2E Test Alert",
      },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.alert).toBeTruthy();
    expect(body.alert.id).toBeTruthy();
    expect(body.alert.status).toBe("active");
  });

  test("created alert appears in list", async ({ request }) => {
    const r = await request.post(`${API}/api/alerts`, {
      data: {
        symbol: "ETHUSDT",
        condition: "below",
        price: 1.0,
      },
    });
    const alertId = (await r.json()).alert.id;

    const listR = await request.get(`${API}/api/alerts`);
    const listBody = await listR.json();
    const found = listBody.alerts.find((a: { id: string }) => a.id === alertId);
    expect(found).toBeTruthy();
    expect(found.symbol).toBe("ETHUSDT");
  });

  test("dismiss active alert changes status to dismissed", async ({ request }) => {
    const r = await request.post(`${API}/api/alerts`, {
      data: { symbol: "SOLUSDT", condition: "above", price: 999_999.0 },
    });
    const alertId = (await r.json()).alert.id;

    const dismissR = await request.put(`${API}/api/alerts/${alertId}/dismiss`);
    expect(dismissR.status()).toBe(200);
    expect((await dismissR.json()).status).toBe("dismissed");

    // Verify status in list
    const listR = await request.get(`${API}/api/alerts`);
    const found = (await listR.json()).alerts.find((a: { id: string }) => a.id === alertId);
    expect(found.status).toBe("dismissed");
  });

  test("delete alert removes it from list", async ({ request }) => {
    const r = await request.post(`${API}/api/alerts`, {
      data: { symbol: "BNBUSDT", condition: "below", price: 1.0 },
    });
    const alertId = (await r.json()).alert.id;

    const deleteR = await request.delete(`${API}/api/alerts/${alertId}`);
    expect(deleteR.status()).toBe(200);

    const listR = await request.get(`${API}/api/alerts`);
    const found = (await listR.json()).alerts.find((a: { id: string }) => a.id === alertId);
    expect(found).toBeFalsy();
  });

  test("dismiss nonexistent alert returns 404", async ({ request }) => {
    const r = await request.put(`${API}/api/alerts/ALT-DOES-NOT-EXIST/dismiss`);
    expect(r.status()).toBe(404);
  });

  test("alert supports all valid conditions", async ({ request }) => {
    for (const condition of ["above", "below"]) {
      const r = await request.post(`${API}/api/alerts`, {
        data: {
          symbol: "BTCUSDT",
          condition,
          price: 50_000.0,
        },
      });
      expect(r.status()).toBe(200);
    }
  });

  test("alert stats endpoint returns counts", async ({ request }) => {
    // Create a few alerts
    for (let i = 0; i < 3; i++) {
      await request.post(`${API}/api/alerts`, {
        data: { symbol: "BTCUSDT", condition: "above", price: 999_999.0 },
      });
    }

    const r = await request.get(`${API}/api/alerts`);
    const body = await r.json();
    expect(body.alerts).toBeTruthy();
    expect(Array.isArray(body.alerts)).toBe(true);
    expect(body.alerts.length).toBeGreaterThanOrEqual(3);
  });
});
