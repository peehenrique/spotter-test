import type { Place, PlanPayload, PlanResponse } from "./types";

const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export async function geocode(query: string): Promise<Place[]> {
  const response = await fetch(
    `${apiBase}/api/geocode/?q=${encodeURIComponent(query)}`,
  );
  if (!response.ok) {
    return [];
  }
  const body = (await response.json()) as { results?: Place[] };
  return body.results ?? [];
}

export async function planTrip(payload: PlanPayload): Promise<PlanResponse> {
  const response = await fetch(`${apiBase}/api/plan/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as PlanResponse & { detail?: string };
  if (!response.ok) {
    throw new Error(body.detail || "Could not plan the trip.");
  }
  return body;
}
