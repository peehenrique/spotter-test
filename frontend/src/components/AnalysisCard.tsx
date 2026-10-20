import { useState } from "react";
import type { PlanResponse, RouteOption } from "../types";
import { formatDuration, formatForecastHour, formatMiles, formatPounds, shortPlace } from "../format";
import { RISK_COLOR, RISK_NAME } from "../risk";
import { IconArrowUp } from "./icons";

interface AnalysisCardProps {
  plan: PlanResponse | null;
  route: RouteOption | null;
}

export function ForecastSlider({
  hours,
  hour,
  maxHour,
  onHour,
}: {
  hours: string[];
  hour: number;
  maxHour: number;
  onHour: (hour: number) => void;
}) {
  const stamp = hours[hour];
  const hourLabel = stamp ? formatForecastHour(stamp, hour) : "0–48h after departure";
  return (
    <section className="panel forecast-dock" aria-label="Corridor forecast">
      <div className="forecast-copy">
        <strong>Corridor forecast</strong>
        <span className="forecast-hour">{hourLabel}</span>
      </div>
      <input
        type="range"
        min={0}
        max={maxHour}
        step={1}
        value={Math.min(hour, maxHour)}
        aria-label={`Forecast hour from 0 to ${maxHour}`}
        aria-valuemin={0}
        aria-valuemax={maxHour}
        aria-valuenow={Math.min(hour, maxHour)}
        onChange={(event) => onHour(Number(event.target.value))}
      />
      <div className="forecast-scale">
        <span>0h</span>
        <span>{maxHour}h</span>
      </div>
      <div className="legend">
        {(Object.keys(RISK_NAME) as (keyof typeof RISK_NAME)[]).map((label) => (
          <span key={label}>
            <i style={{ background: RISK_COLOR[label] }} />
            {RISK_NAME[label]}
          </span>
        ))}
      </div>
    </section>
  );
}

export function AnalysisCard({ plan, route }: AnalysisCardProps) {
  const [open, setOpen] = useState(false);
  const summary = route?.summary;
  const headline = route
    ? `${formatMiles(route.distance_miles)} · ${formatDuration(route.duration_seconds)} · risk ${summary?.average_risk.toFixed(2)}`
    : "Plan a trip to score the route";

  return (
    <section className={open ? "panel analysis open" : "panel analysis"} aria-label="AI route analysis">
      <button
        type="button"
        className="analysis-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="spark" aria-hidden="true">
          <TruckGlyph />
        </span>
        <span className="analysis-copy">
          <h2>AI route analysis</h2>
          {!open && <p className="analysis-summary">{headline}</p>}
        </span>
        <span className={open ? "chevron open" : "chevron"} aria-hidden="true">
          <IconArrowUp size={16} />
        </span>
      </button>
      {open && (
        <div className="analysis-body">
          <dl className="facts">
            <Fact label="Departure" value={plan ? shortPlace(plan.origin.label) : "—"} />
            <Fact label="Destination" value={plan ? shortPlace(plan.destination.label) : "—"} />
            <Fact label="Total distance" value={route ? formatMiles(route.distance_miles) : "—"} />
            <Fact label="Travel time" value={route ? formatDuration(route.duration_seconds) : "—"} />
            <Fact label="Load weight" value={plan ? formatPounds(plan.load_weight_lb) : "—"} />
            <Fact label="Average risk" value={summary ? summary.average_risk.toFixed(2) : "—"} />
          </dl>
          {plan && <p className="reason">{plan.recommendation_reason}</p>}
          <div className="hazard-row">
            <Hazard tone="bad" value={summary ? miles(summary.no_travel_miles) : "—"} label="No go" />
            <Hazard tone="warn" value={summary ? miles(summary.severe_miles) : "—"} label="Severe" />
            <Hazard tone="mid" value={summary ? miles(summary.high_miles) : "—"} label="High" />
          </div>
        </div>
      )}
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

