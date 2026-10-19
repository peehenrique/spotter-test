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

export const ROUTE_COLORS = ["#6cb6ff", "#e2b15a", "#5ddeaf"];

export function routeColor(plan: PlanResponse, routeId: string): string {
  const index = plan.routes.findIndex((route) => route.id === routeId);
  return ROUTE_COLORS[(index + ROUTE_COLORS.length) % ROUTE_COLORS.length];
}
