import { useState } from "react";
import { planTrip } from "./api";
import { defaultDeparture, formatForecastHour, toIso } from "./format";
import type { PlaceDraft, PlanResponse } from "./types";
import { RISK_COLOR, RISK_NAME } from "./risk";
import { TripForm } from "./components/TripForm";
import { RoutePanel } from "./components/RoutePanel";
import { MapView } from "./components/MapView";

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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not plan the trip.");
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

  const hours = plan?.corridor.hours ?? [];
  const hourLabel = hours[hour] ? formatForecastHour(hours[hour], hour) : "Departure";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <div>
            <p className="eyebrow">Truck routing</p>
            <h1>Weather-Aware Truck Routing</h1>
          </div>
        </div>
        <p className="topbar-note">Three routes, scored by weather, load, and time.</p>
      </header>
      <div className="workspace">
        <aside className="sidebar">
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
          {plan && selectedId && (
            <RoutePanel
              plan={plan}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onFocusCheckpoint={(lat, lon) => setFocus({ lat, lon, token: Date.now() })}
            />
          )}
        </aside>
        <main className="map-stage">
          {loading && <div className="progress" />}
          {!plan && (
            <div className="map-empty">
              <p>Plan a trip to compare routes on the map.</p>
            </div>
          )}
          <MapView plan={plan} selectedId={selectedId} hour={hour} focus={focus} onSelectRoute={setSelectedId} />
          <div className="forecast">
            <div className="forecast-copy">
              <strong>Corridor forecast</strong>
              <span>{plan ? hourLabel : "0–48h after departure"}</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(hours.length - 1, 48)}
              value={Math.min(hour, Math.max(hours.length - 1, 0))}
              disabled={!plan}
              aria-label="Forecast hour"
              onChange={(event) => setHour(Number(event.target.value))}
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
        </main>
      </div>
    </div>
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
