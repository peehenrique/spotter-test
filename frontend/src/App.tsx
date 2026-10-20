import { useState } from "react";
import { planTrip } from "./api";
import { defaultDeparture, formatMiles, placeCode, shortPlace, toIso } from "./format";
import type { PlaceDraft, PlanResponse, RouteOption } from "./types";
import { TripForm } from "./components/TripForm";
import { RoutePanel } from "./components/RoutePanel";
import { MapView } from "./components/MapView";
import { TopNav } from "./components/TopNav";
import { AnalysisCard } from "./components/AnalysisCard";
import { TimelineCard } from "./components/TimelineCard";
import { StatusCard } from "./components/StatusCard";
import { IconClose, IconExpand } from "./components/icons";

const SAMPLE = {
  origin: { label: "Chicago, IL", lat: 41.8781, lon: -87.6298 },
  destination: { label: "Kansas City, MO", lat: 39.0997, lon: -94.5786 },
  load: "42000",
  interval: 25 as const,
};

const emptyPlace: PlaceDraft = { label: "", lat: null, lon: null };

export function App() {
  const [origin, setOrigin] = useState<PlaceDraft>(emptyPlace);
  const [destination, setDestination] = useState<PlaceDraft>(emptyPlace);
  const [departure, setDeparture] = useState(defaultDeparture);
  const [load, setLoad] = useState("35000");
  const [interval, setInterval] = useState<10 | 25 | 50>(25);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hour, setHour] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lon: number; token: number } | null>(null);
  const [composerOpen, setComposerOpen] = useState(true);

  async function submit(next?: {
    origin: PlaceDraft;
    destination: PlaceDraft;
    departure: string;
    load: string;
    interval: 10 | 25 | 50;
  }) {
    const current = next ?? { origin, destination, departure, load, interval };
    const weight = Number(current.load);
    if (!current.origin.label.trim() || !current.destination.label.trim()) {
      setError("Enter an origin and a destination.");
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      setError("Enter a load weight in pounds.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await planTrip({
        origin: placePayload(current.origin),
        destination: placePayload(current.destination),
        departure: toIso(current.departure),
        load_weight_lb: weight,
        sample_interval_miles: current.interval,
      });
      setPlan(result);
      setSelectedId(result.recommended_route_id);
      setHour(0);
      setComposerOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not plan the trip.");
      setComposerOpen(true);
    } finally {
      setLoading(false);
    }
  }

  function runSample() {
    setOrigin(SAMPLE.origin);
    setDestination(SAMPLE.destination);
    setLoad(SAMPLE.load);
    setInterval(SAMPLE.interval);
    const sampleDeparture = defaultDeparture();
    setDeparture(sampleDeparture);
    void submit({
      origin: SAMPLE.origin,
      destination: SAMPLE.destination,
      departure: sampleDeparture,
      load: SAMPLE.load,
      interval: SAMPLE.interval,
    });
  }

  const selected = selectedRoute(plan, selectedId);
  const hours = plan?.corridor.hours ?? [];
  const maxHour = Math.max(hours.length - 1, 0);

  return (
    <div className="shell">
      <TopNav />
      <div className={plan && selected ? "canvas" : "canvas no-dock"}>
        {loading && <div className="progress" role="progressbar" aria-label="Planning trip" />}
        <div className="map-frame">
          <MapView plan={plan} selectedId={selectedId} hour={hour} focus={focus} onSelectRoute={setSelectedId} />
        </div>
        <div className="overlay">
          <section className="panel planner" aria-label="Routes available">
            <header className="panel-head">
              <h2>Routes available</h2>
              {plan && <span className="count-pill">{plan.routes.length}</span>}
              <button
                type="button"
                className="icon-btn end"
                aria-label={composerOpen ? "Hide trip form" : "Edit trip"}
                aria-expanded={composerOpen}
                onClick={() => setComposerOpen((open) => !open)}
              >
                <IconExpand />
              </button>
            </header>
            {composerOpen || !plan ? (
              <TripForm
                origin={origin}
                destination={destination}
                departure={departure}
                load={load}
                interval={interval}
                loading={loading}
                error={error}
                onOrigin={setOrigin}
                onDestination={setDestination}
                onDeparture={setDeparture}
                onLoad={setLoad}
                onInterval={setInterval}
                onSubmit={() => void submit()}
                onSample={runSample}
              />
            ) : (
              <div className="chips">
                <Chip label={shortPlace(origin.label) || placeCode(origin.label)} onClick={() => setComposerOpen(true)} />
                <Chip label={shortPlace(destination.label)} onClick={() => setComposerOpen(true)} />
                <Chip label={`${Number(load).toLocaleString()} lb`} onClick={() => setComposerOpen(true)} />
                <Chip label={`${interval} mi`} onClick={() => setComposerOpen(true)} />
              </div>
            )}
            <div className="load-scroll">
              {plan && selectedId ? (
                <RoutePanel plan={plan} selectedId={selectedId} onSelect={setSelectedId} />
              ) : (
                <div className="empty-routes">
                  <p className="section-label">Recommended</p>
                  <div className="empty-card">
                    <strong>No routes yet</strong>
                    <p>Enter an origin, destination, departure, and load. Sample trip uses Chicago to Kansas City.</p>
                  </div>
                </div>
              )}
            </div>
          </section>
          <header className="map-heading">
            <h2>Shipment route overview</h2>
            <p>{selected ? `Distance: ${formatMiles(selected.distance_miles)}` : "Distance: —"}</p>
          </header>
          {plan && selected && (
            <>
              <AnalysisCard
                plan={plan}
                route={selected}
                hour={Math.min(hour, maxHour)}
                maxHour={maxHour}
                onHour={setHour}
              />
              <TimelineCard
                plan={plan}
                route={selected}
                onFocus={(lat, lon) => setFocus({ lat, lon, token: Date.now() })}
              />
              <StatusCard plan={plan} route={selected} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="chip" onClick={onClick}>
      {label}
      <IconClose />
    </button>
  );
}

function selectedRoute(plan: PlanResponse | null, selectedId: string | null): RouteOption | null {
  if (!plan) return null;
  return (
    plan.routes.find((route) => route.id === selectedId) ??
    plan.routes.find((route) => route.id === plan.recommended_route_id) ??
    null
  );
}

function placePayload(place: PlaceDraft): { label: string; lat?: number; lon?: number } {
  const payload: { label: string; lat?: number; lon?: number } = { label: place.label.trim() };
  if (place.lat != null && place.lon != null) {
    payload.lat = place.lat;
    payload.lon = place.lon;
  }
  return payload;
}
