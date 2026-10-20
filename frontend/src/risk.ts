import type { PlanResponse, RiskLabel } from "./types";

export const RISK_COLOR: Record<RiskLabel, string> = {
  low: "#3dcc97",
  moderate: "#e2b15a",
  high: "#f08a24",
  severe: "#ff5d5d",
  no_travel: "#d56bff",
};

export const RISK_NAME: Record<RiskLabel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
  no_travel: "No travel",
};

const ROUTE_MUTED = ["#b7c3d4", "#e0b15a", "#9aa8ba"];

export function routeColor(plan: PlanResponse, routeId: string, active = false): string {
  if (active) return "#2f6bff";
  const index = plan.routes.findIndex((route) => route.id === routeId);
  const safe = index < 0 ? 0 : index;
  return ROUTE_MUTED[safe % ROUTE_MUTED.length];
}
