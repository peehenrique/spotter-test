import type { PlanResponse, RouteOption } from "../types";
import { formatDuration, formatMiles, formatShortStamp } from "../format";

interface StatusCardProps {
  plan: PlanResponse | null;
  route: RouteOption | null;
}

export function StatusCard({ plan, route }: StatusCardProps) {
  const arrival = route && route.checkpoints.length > 0 ? route.checkpoints[route.checkpoints.length - 1].eta : plan?.departure;
  const tone = !route ? "neutral" : route.summary.no_travel_miles > 0 ? "bad" : route.recommended ? "good" : "neutral";
  const status = !route ? "Waiting" : route.summary.no_travel_miles > 0 ? "Restricted" : route.recommended ? "Recommended" : "Alternate";

  return (
    <section className="panel status" aria-label="Route status">
      <div className="invoice-preview" aria-hidden="true">
        <div className="invoice-top">
          <span>Route brief</span>
          <span>{route?.label ?? "—"}</span>
        </div>
        <div className="invoice-lines">
          <span>Distance</span>
          <b>{route ? formatMiles(route.distance_miles) : "—"}</b>
          <span>No-travel</span>
          <b>{route ? `${route.summary.no_travel_miles.toFixed(1)} mi` : "—"}</b>
          <span>Severe</span>
          <b>{route ? `${route.summary.severe_miles.toFixed(1)} mi` : "—"}</b>
        </div>
      </div>
      <div className="status-main">
        <div className="status-head">
          <h2>Route status</h2>
          <span className={`status-pill ${tone}`}>
            <i />
            {status}
          </span>
        </div>
        <span className="status-id">{route ? route.label : "No route selected"}</span>
        <p className="hero-stat">
          {route ? Math.round(route.distance_miles).toLocaleString() : "—"}
          {route && <small> mi</small>}
        </p>
        <p className="status-sub">{route ? formatDuration(route.duration_seconds) : "Plan a trip to score routes"}</p>
        <div className="status-dates">
          <div>
            <span>Departs</span>
            <b>{plan ? formatShortStamp(plan.departure) : "—"}</b>
          </div>
          <div>
            <span>Arrives</span>
            <b>{arrival ? formatShortStamp(arrival) : "—"}</b>
          </div>
        </div>
      </div>
    </section>
  );
}
