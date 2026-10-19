export type RiskLabel = "low" | "moderate" | "high" | "severe" | "no_travel";

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

export interface PlaceDraft {
  label: string;
  lat: number | null;
  lon: number | null;
}

export interface Checkpoint {
  index: number;
  lat: number;
  lon: number;
  distance_miles: number;
  eta: string;
  wind_mph: number;
  rain_in_hr: number;
  snow_in_hr: number;
  wind_risk: RiskLabel;
  rain_risk: RiskLabel;
  snow_risk: RiskLabel;
  risk: RiskLabel;
  load_escalated: boolean;
}

export interface RouteSummary {
  low_miles: number;
  moderate_miles: number;
  high_miles: number;
  severe_miles: number;
  no_travel_miles: number;
  average_risk: number;
}

export interface RouteOption {
  id: string;
  label: string;
  recommended: boolean;
  distance_miles: number;
  duration_seconds: number;
  geometry: [number, number][];
  summary: RouteSummary;
  checkpoints: Checkpoint[];
}

export interface CorridorPoint {
  lat: number;
  lon: number;
  risks: number[];
}

export interface PlanResponse {
  origin: Place;
  destination: Place;
  departure: string;
  load_weight_lb: number;
  sample_interval_miles: 10 | 25 | 50;
  recommended_route_id: string;
  recommendation_reason: string;
  ranking: string[];
  routes: RouteOption[];
  corridor: {
    anchor: string;
    hours: string[];
    points: CorridorPoint[];
  };
}

export interface PlanPayload {
  origin: { label: string; lat?: number; lon?: number };
  destination: { label: string; lat?: number; lon?: number };
  departure: string;
  load_weight_lb: number;
  sample_interval_miles: 10 | 25 | 50;
}
