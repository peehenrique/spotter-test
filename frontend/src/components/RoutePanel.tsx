import type { PlanResponse, RouteOption } from "../types";
import { RISK_COLOR, RISK_NAME, routeColor } from "../risk";
import { formatDuration, formatEta, formatMiles } from "../format";

interface RoutePanelProps {
  plan: PlanResponse;
  selectedId: string;
  onSelect: (routeId: string) => void;
  onFocusCheckpoint: (lat: number, lon: number) => void;
}

const BUCKETS = [
  ["low_miles", "low"],
  ["moderate_miles", "moderate"],
  ["high_miles", "high"],
  ["severe_miles", "severe"],
  ["no_travel_miles", "no_travel"],
] as const;

export function RoutePanel({ plan, selectedId, onSelect, onFocusCheckpoint }: RoutePanelProps) {
  const ordered = plan.ranking
    .map((id) => plan.routes.find((route) => route.id === id))
    .filter((route): route is RouteOption => Boolean(route));
  const selected = ordered.find((route) => route.id === selectedId) ?? ordered[0];

  return (
    <section className="results">
      <p className="reason">{plan.recommendation_reason}</p>
      {plan.routes.length < 3 && (
        <p className="hint">Only {plan.routes.length} distinct driving routes were available for this trip.</p>
      )}
      <div className="cards">
        {ordered.map((route, index) => {
          const active = route.id === selectedId;
          return (
            <button
              key={route.id}
              type="button"
              className={active ? "route-card active" : "route-card"}
              onClick={() => onSelect(route.id)}
              aria-pressed={active}
            >
              <div className="route-card-top">
                <span className="swatch" style={{ background: routeColor(plan, route.id) }} />
                <strong>
                  {index + 1}. {route.label}
                </strong>
                {route.recommended && <span className="badge">Recommended</span>}
              </div>
              <p className="route-metrics">
                {formatMiles(route.distance_miles)} · {formatDuration(route.duration_seconds)}
              </p>
              <RiskBar route={route} />
              <p className="route-breakdown">
                {route.summary.no_travel_miles.toFixed(1)} no-travel · {route.summary.severe_miles.toFixed(1)} severe ·{" "}
                {route.summary.high_miles.toFixed(1)} high · avg {route.summary.average_risk.toFixed(2)}
              </p>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="checkpoints">
          <h2>Checkpoints · {selected.label}</h2>
          <ul>
            {selected.checkpoints.map((checkpoint) => (
              <li key={checkpoint.index}>
                <button type="button" onClick={() => onFocusCheckpoint(checkpoint.lat, checkpoint.lon)}>
                  <span className="risk-dot" style={{ background: RISK_COLOR[checkpoint.risk] }} />
                  <span className="checkpoint-mile">Mile {checkpoint.distance_miles.toFixed(0)}</span>
                  <span className="checkpoint-eta">{formatEta(checkpoint.eta)}</span>
                  <span className="checkpoint-risk">{RISK_NAME[checkpoint.risk]}</span>
                  <span className="checkpoint-wx">
                    {checkpoint.wind_mph.toFixed(0)} mph · {checkpoint.rain_in_hr.toFixed(2)} in rain ·{" "}
                    {checkpoint.snow_in_hr.toFixed(1)} in snow
                    {checkpoint.load_escalated ? " · load rule" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function RiskBar({ route }: { route: RouteOption }) {
  const total = route.distance_miles || 1;
  return (
    <div className="risk-bar" aria-hidden="true">
      {BUCKETS.map(([key, label]) => {
        const miles = route.summary[key];
        if (miles <= 0) return null;
        return (
          <span
            key={label}
            style={{ width: `${(miles / total) * 100}%`, background: RISK_COLOR[label] }}
            title={`${RISK_NAME[label]} ${miles.toFixed(1)} mi`}
          />
        );
      })}
    </div>
  );
}
