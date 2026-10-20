import type { PlanResponse, RouteOption } from "../types";
import { formatDuration, formatForecastHour, formatMiles, formatPounds, shortPlace } from "../format";
import { RISK_COLOR, RISK_NAME } from "../risk";
import { IconArrowUp, IconExpand } from "./icons";

interface AnalysisCardProps {
  plan: PlanResponse | null;
  route: RouteOption | null;
  hour: number;
  maxHour: number;
  onHour: (hour: number) => void;
}

export function AnalysisCard({ plan, route, hour, maxHour, onHour }: AnalysisCardProps) {
  const hours = plan?.corridor.hours ?? [];
  const stamp = hours[hour];
  const hourLabel = stamp ? formatForecastHour(stamp, hour) : "0–48h after departure";
  const summary = route?.summary;

  function stepHour() {
    if (!plan) return;
    onHour(hour >= maxHour ? 0 : hour + 1);
  }

  return (
    <section className="panel analysis" aria-label="AI route analysis">
      <header className="panel-head">
        <span className="spark" aria-hidden="true">
          <TruckGlyph />
        </span>
        <h2>AI route analysis</h2>
        <span className="icon-btn end" aria-hidden="true">
          <IconExpand />
        </span>
      </header>
      <TruckArt />
      <dl className="facts">
        <Fact label="Departure" value={plan ? shortPlace(plan.origin.label) : "—"} />
        <Fact label="Destination" value={plan ? shortPlace(plan.destination.label) : "—"} />
        <Fact label="Total distance" value={route ? formatMiles(route.distance_miles) : "—"} />
        <Fact label="Travel time" value={route ? formatDuration(route.duration_seconds) : "—"} />
        <Fact label="Load weight" value={plan ? formatPounds(plan.load_weight_lb) : "—"} />
        <Fact label="Average risk" value={summary ? summary.average_risk.toFixed(2) : "—"} />
      </dl>
      {plan && <p className="reason" title={plan.recommendation_reason}>{plan.recommendation_reason}</p>}
      <div className="hazard-wrap">
        <button type="button" className="step-btn" onClick={stepHour} disabled={!plan} aria-label="Next forecast hour">
          <IconArrowUp />
        </button>
        <div className="hazard-bar">
          <Hazard tone="bad" value={summary ? miles(summary.no_travel_miles) : "—"} label="No go" />
          <Hazard tone="warn" value={summary ? miles(summary.severe_miles) : "—"} label="Severe" />
          <Hazard tone="mid" value={summary ? miles(summary.high_miles) : "—"} label="High" />
        </div>
      </div>
      <div className="forecast">
        <div className="forecast-copy">
          <strong>Corridor forecast</strong>
          <span>{hourLabel}</span>
        </div>
        <input
          type="range"
          min={0}
          max={maxHour}
          value={Math.min(hour, maxHour)}
          disabled={!plan}
          aria-label="Forecast hour"
          onChange={(event) => onHour(Number(event.target.value))}
        />
        <div className="legend">
          {(Object.keys(RISK_NAME) as (keyof typeof RISK_NAME)[]).map((label) => (
            <span key={label}>
              <i style={{ background: RISK_COLOR[label] }} />
              {RISK_NAME[label]}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Hazard({ tone, value, label }: { tone: "bad" | "warn" | "mid"; value: string; label: string }) {
  return (
    <span className="hazard">
      <i className={`hazard-mark ${tone}`} aria-hidden="true" />
      <span>
        <b>{value}</b>
        {label}
      </span>
    </span>
  );
}

function miles(value: number): string {
  const digits = value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} mi`;
}

function TruckGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 7h11v8H3z" stroke="#fff" strokeWidth="1.7" />
      <path d="M14 10h4.2L21 13.2V15h-7" stroke="#fff" strokeWidth="1.7" />
      <circle cx="7.5" cy="17" r="1.3" fill="#fff" />
      <circle cx="17" cy="17" r="1.3" fill="#fff" />
    </svg>
  );
}

function TruckArt() {
  return (
    <svg className="truck-art" viewBox="0 0 280 78" role="img" aria-label="Truck">
      <rect x="8" y="18" width="154" height="38" rx="5" fill="#c5ceda" />
      <rect x="18" y="26" width="134" height="8" rx="2" fill="#e7edf4" />
      <path d="M162 24h48c8 0 14 4 20 12l16 8v12H162z" fill="#2f6bff" />
      <path d="M186 30h26c6 0 12 3 16 8H186z" fill="#d7e4ff" />
      <circle cx="52" cy="60" r="9" fill="#1c1f26" />
      <circle cx="52" cy="60" r="3.5" fill="#d5dce6" />
      <circle cx="86" cy="60" r="9" fill="#1c1f26" />
      <circle cx="86" cy="60" r="3.5" fill="#d5dce6" />
      <circle cx="196" cy="60" r="9" fill="#1c1f26" />
      <circle cx="196" cy="60" r="3.5" fill="#d5dce6" />
      <circle cx="222" cy="60" r="9" fill="#1c1f26" />
      <circle cx="222" cy="60" r="3.5" fill="#d5dce6" />
    </svg>
  );
}
