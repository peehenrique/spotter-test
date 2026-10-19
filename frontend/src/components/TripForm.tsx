import type { PlaceDraft } from "../types";
import { PlaceField } from "./PlaceField";

interface TripFormProps {
  origin: PlaceDraft;
  destination: PlaceDraft;
  departure: string;
  load: string;
  interval: 10 | 25 | 50;
  loading: boolean;
  error: string | null;
  onOrigin: (value: PlaceDraft) => void;
  onDestination: (value: PlaceDraft) => void;
  onDeparture: (value: string) => void;
  onLoad: (value: string) => void;
  onInterval: (value: 10 | 25 | 50) => void;
  onSubmit: () => void;
  onSample: () => void;
}

export function TripForm({
  origin,
  destination,
  departure,
  load,
  interval,
  loading,
  error,
  onOrigin,
  onDestination,
  onDeparture,
  onLoad,
  onInterval,
  onSubmit,
  onSample,
}: TripFormProps) {
  return (
    <form
      className="trip-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <PlaceField label="Origin" value={origin} onChange={onOrigin} />
      <PlaceField label="Destination" value={destination} onChange={onDestination} />
      <label className="field">
        <span>Departure</span>
        <input type="datetime-local" value={departure} onChange={(event) => onDeparture(event.target.value)} required />
      </label>
      <label className="field">
        <span>Load weight (lb)</span>
        <input
          type="number"
          min={1}
          max={200000}
          step={1}
          value={load}
          onChange={(event) => onLoad(event.target.value)}
          required
        />
      </label>
      <div className="field">
        <span>Weather sample</span>
        <div className="segmented" role="group" aria-label="Sample interval">
          {([10, 25, 50] as const).map((miles) => (
            <button
              key={miles}
              type="button"
              aria-pressed={interval === miles}
              className={interval === miles ? "segment active" : "segment"}
              onClick={() => onInterval(miles)}
            >
              {miles} mi
            </button>
          ))}
        </div>
      </div>
      <p className="hint">
        Above 30,000 lb, 45–54 mph wind becomes no-travel. Above 40,000 lb, 35–44 mph wind becomes severe.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="primary" type="submit" disabled={loading}>
          {loading ? "Checking weather…" : "Find routes"}
        </button>
        <button className="ghost" type="button" onClick={onSample} disabled={loading}>
          Sample trip
        </button>
      </div>
    </form>
  );
}
