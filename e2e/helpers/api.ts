/**
 * API helper for E2E tests — calls the backend directly to set up state.
 */

import { APIRequestContext } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:8000";

export async function createStrategy(
  request: APIRequestContext,
  payload: Record<string, unknown>
): Promise<string> {
  const r = await request.post(`${BASE}/api/strategies`, { data: payload });
  const body = await r.json();
  return body.strategy_id as string;
}

export async function createAlert(
  request: APIRequestContext,
  payload: Record<string, unknown>
): Promise<string> {
  const r = await request.post(`${BASE}/api/alerts`, { data: payload });
  const body = await r.json();
  return body.alert.id as string;
}

export async function connectAdapter(
  request: APIRequestContext,
  adapterId: string,
  credentials: { api_key: string; api_secret: string }
): Promise<void> {
  await request.post(`${BASE}/api/adapters/${adapterId}/connect`, {
    data: credentials,
  });
}

export async function setRiskLimits(
  request: APIRequestContext,
  limits: Record<string, number>
): Promise<void> {
  await request.post(`${BASE}/api/risk/limits`, { data: limits });
}

export async function clearAllStrategies(
  request: APIRequestContext
): Promise<void> {
  const r = await request.get(`${BASE}/api/strategies`);
  const body = await r.json();
  for (const s of body.strategies ?? []) {
    await request.delete(`${BASE}/api/strategies/${s.id}`);
  }
}
