import type { PlanResponse, RouteOption } from "../types";
import { formatDuration, formatMiles, formatShortStamp, placeCode, shortPlace } from "../format";
import { RISK_COLOR, RISK_NAME, routeColor } from "../risk";

interface RoutePanelProps {
  plan: PlanResponse;
  selectedId: string;
  onSelect: (routeId: string) => void;
}

const BUCKETS = [
  ["low_miles", "low"],
  ["moderate_miles", "moderate"],
  ["high_miles", "high"],
  ["severe_miles", "severe"],
  ["no_travel_miles", "no_travel"],
] as const;

export function RoutePanel({ plan, selectedId, onSelect }: RoutePanelProps) {
  const ordered = plan.ranking
    .map((id) => plan.routes.find((route) => route.id === id))
    .filter((route): route is RouteOption => Boolean(route));
  const recommended = ordered.find((route) => route.recommended) ?? ordered[0];
  const others = ordered.filter((route) => route !== recommended);

  return (
    <div className="route-groups">
      {plan.routes.length < 3 && (
        <p className="hint">Only {plan.routes.length} distinct driving routes were available for this trip.</p>
      )}
      {recommended && (
        <>
          <p className="section-label">Recommended</p>
          <LoadCard plan={plan} route={recommended} index={ordered.indexOf(recommended)} selectedId={selectedId} onSelect={onSelect} />
        </>
      )}
      {others.length > 0 && (
        <>
          <p className="section-label">Other routes</p>
          {others.map((route) => (
            <LoadCard
              key={route.id}
              plan={plan}
              route={route}
              index={ordered.indexOf(route)}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </div>
  );
}

function LoadCard({
  plan,
  route,
  index,
  selectedId,
  onSelect,
}: {
  plan: PlanResponse;
  route: RouteOption;
  index: number;
  selectedId: string;
  onSelect: (routeId: string) => void;
}) {
  const active = route.id === selectedId;
  const arrival = route.checkpoints[route.checkpoints.length - 1]?.eta ?? plan.departure;
  const maxWind = route.checkpoints.reduce((max, checkpoint) => Math.max(max, checkpoint.wind_mph), 0);

  return (
    <div
      className={active ? "load-card selected" : "load-card"}
      style={active ? undefined : { borderLeftColor: routeColor(plan, route.id) }}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={() => onSelect(route.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(route.id);
        }
      }}
    >
      <div className="load-head">
        <div>
          <strong className="load-name">{route.label}</strong>
          <span className="load-id">Nº{index + 1}</span>
        </div>
        <span className={route.recommended ? "pill" : "pill neutral"}>
          {route.recommended ? "Recommended" : `Avg ${route.summary.average_risk.toFixed(2)}`}
        </span>
      </div>
      <div className="lane">
        <div>
          <b>{placeCode(plan.origin.label)}</b>
          <small title={plan.origin.label}>{shortPlace(plan.origin.label)}</small>
          <time>{formatShortStamp(plan.departure)}</time>
        </div>
        <div className="lane-mid">
          <span>{formatDuration(route.duration_seconds)}</span>
          <div className="lane-line" />
        </div>
        <div className="lane-end">
          <b>{placeCode(plan.destination.label)}</b>
          <small title={plan.destination.label}>{shortPlace(plan.destination.label)}</small>
          <time>{formatShortStamp(arrival)}</time>
        </div>
      </div>
      <div className="stats">
        <div>
          <span>MPH</span>
          <b>{Math.round(maxWind)}</b>
        </div>
        <div>
          <span>TIME</span>
          <b>{formatDuration(route.duration_seconds)}</b>
        </div>
        <div>
          <span>LBS</span>
          <b>{Math.round(plan.load_weight_lb).toLocaleString()}</b>
        </div>
      </div>
      <RiskBar route={route} />
      <p className="breakdown">
        {route.summary.no_travel_miles.toFixed(1)} no-travel · {route.summary.severe_miles.toFixed(1)} severe ·{" "}
        {route.summary.high_miles.toFixed(1)} high
      </p>
      <div className={active ? "load-foot featured" : "load-foot"}>
        <strong>{formatMiles(route.distance_miles)}</strong>
        <button
          type="button"
          className="accept"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(route.id);
          }}
        >
          {active ? "Selected" : "Select"}
        </button>
      </div>
    </div>
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
