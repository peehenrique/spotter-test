import { useEffect, useRef, useState } from "react";
import type { Checkpoint, PlanResponse, RouteOption } from "../types";
import { formatPounds, formatShortStamp, shortPlace } from "../format";
import { RISK_COLOR, RISK_NAME } from "../risk";
import { IconBox, IconFlag, IconMoon, IconSun } from "./icons";

interface TimelineCardProps {
  plan: PlanResponse | null;
  route: RouteOption | null;
  onFocus: (lat: number, lon: number) => void;
}

export function TimelineCard({ plan, route, onFocus }: TimelineCardProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const rowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const checkpoints = route?.checkpoints ?? [];
  const active = checkpoints.find((checkpoint) => checkpoint.index === activeIndex) ?? null;

  useEffect(() => {
    setActiveIndex(null);
  }, [route?.id]);

  const track = trackIndexes(checkpoints.length);

  function open(checkpoint: Checkpoint) {
    setActiveIndex(checkpoint.index);
    onFocus(checkpoint.lat, checkpoint.lon);
    requestAnimationFrame(() => {
      rowRefs.current.get(checkpoint.index)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  return (
    <section className="panel timeline" aria-label="Delivery timeline">
      <header className="panel-head">
        <h2>Delivery timeline</h2>
      </header>
      <div className="track">
        {(track.length > 0 ? track : PLACEHOLDER_TRACK).map((index, position) => {
          const checkpoint = checkpoints[index];
          if (!checkpoint) {
            return <span key={position} className="track-node" aria-hidden="true" />;
          }
          const previous = position > 0 ? checkpoints[track[position - 1]] : undefined;
          const gap = previous ? hoursBetween(previous.eta, checkpoint.eta) : 0;
          const last = index === checkpoints.length - 1;
          return (
            <button
              key={checkpoint.index}
              type="button"
              className={activeIndex === checkpoint.index ? "track-node active" : "track-node"}
              onClick={() => open(checkpoint)}
              aria-pressed={activeIndex === checkpoint.index}
              aria-label={`${stageName(index, checkpoints.length)} ${formatShortStamp(checkpoint.eta)}`}
            >
              <NodeIcon checkpoint={checkpoint} first={index === 0} last={last} />
              {gap >= 1 && <span className="hour-badge">{gap}H</span>}
            </button>
          );
        })}
      </div>
      {plan && active && (
        <p className="track-selection" role="status">
          <span>{stageName(active.index, checkpoints.length)}</span>
          <span>{formatShortStamp(active.eta)}</span>
          <span>{locationLabel(plan, active, active.index, active.index === checkpoints.length - 1)}</span>
        </p>
      )}
      <div className="t-head" aria-hidden="true">
        <span>Stage</span>
        <span>Time</span>
        <span>Location</span>
        <span>Action</span>
        <span>Additional details</span>
      </div>
      <div className="t-body">
        {plan && route && checkpoints.length > 0 ? (
          checkpoints.map((checkpoint, index) => {
            const last = index === checkpoints.length - 1;
            return (
              <button
                key={checkpoint.index}
                type="button"
                ref={(node) => {
                  if (node) rowRefs.current.set(checkpoint.index, node);
                  else rowRefs.current.delete(checkpoint.index);
                }}
                className={activeIndex === checkpoint.index ? "t-row active" : "t-row"}
                aria-pressed={activeIndex === checkpoint.index}
                onClick={() => open(checkpoint)}
              >
                <span className="stage">
                  <i style={{ background: index === 0 || last ? "#2f6bff" : "#f0a04b" }} />
                  {stageName(index, checkpoints.length)}
                </span>
                <span>{formatShortStamp(checkpoint.eta)}</span>
                <span title={locationLabel(plan, checkpoint, index, last)}>
                  {locationLabel(plan, checkpoint, index, last)}
                </span>
                <span>{actionLabel(index, last, checkpoint)}</span>
                <span>
                  <em className={`tag ${tagTone(index, checkpoint)}`}>
                    <i style={{ background: index === 0 ? "#2f6bff" : RISK_COLOR[checkpoint.risk] }} />
                    {detailLabel(plan, checkpoint, index)}
                  </em>
                </span>
              </button>
            );
          })
        ) : (
          <p className="empty-copy">Plan a trip to see pickup, checkpoints, and arrival.</p>
        )}
      </div>
    </section>
  );
}

const PLACEHOLDER_TRACK = [0, 1, 2, 3, 4, 5];

function trackIndexes(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 7) return Array.from({ length: count }, (_, index) => index);
  const indexes = [0];
  const inner = 5;
  for (let step = 1; step <= inner; step += 1) {
    indexes.push(Math.round((step * (count - 1)) / (inner + 1)));
  }
  indexes.push(count - 1);
  return [...new Set(indexes)];
}

function hoursBetween(start: string, end: string): number {
  const delta = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  return Math.round(delta / 3_600_000);
}

function stageName(index: number, total: number): string {
  if (index === 0) return "Pickup";
  if (index === total - 1) return "Arrival";
  if (index === 1) return "First stop";
  return "En route";
}

function locationLabel(plan: PlanResponse, checkpoint: Checkpoint, index: number, last: boolean): string {
  if (index === 0) return shortPlace(plan.origin.label);
  if (last) return shortPlace(plan.destination.label);
  return `Mile ${checkpoint.distance_miles.toFixed(0)}`;
}

function actionLabel(index: number, last: boolean, checkpoint: Checkpoint): string {
  if (index === 0) return "Pickup of cargo";
  if (last) return "Arrive";
  return RISK_NAME[checkpoint.risk];
}

function detailLabel(plan: PlanResponse, checkpoint: Checkpoint, index: number): string {
  if (index === 0) return formatPounds(plan.load_weight_lb);
  const wind = `${checkpoint.wind_mph.toFixed(0)} mph`;
  const note = checkpoint.load_escalated ? " · load rule" : "";
  return `${RISK_NAME[checkpoint.risk]} · ${wind}${note}`;
}

function tagTone(index: number, checkpoint: Checkpoint): string {
  if (index === 0 || checkpoint.risk === "low") return "blue";
  if (checkpoint.risk === "moderate") return "orange";
  return "red";
}

function NodeIcon({ checkpoint, first, last }: { checkpoint: Checkpoint; first: boolean; last: boolean }) {
  if (first) return <IconBox />;
  if (last) return <IconFlag />;
  const hour = new Date(checkpoint.eta).getHours();
  if (hour < 6 || hour >= 20) return <IconMoon />;
  return <IconSun />;
}
