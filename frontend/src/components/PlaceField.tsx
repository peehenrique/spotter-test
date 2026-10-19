import { useEffect, useRef, useState } from "react";
import { geocode } from "../api";
import type { Place, PlaceDraft } from "../types";

interface PlaceFieldProps {
  label: string;
  value: PlaceDraft;
  onChange: (value: PlaceDraft) => void;
}

export function PlaceField({ label, value, onChange }: PlaceFieldProps) {
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const query = value.label.trim();
    if (value.lat != null || query.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    const current = ++requestId.current;
    const handle = window.setTimeout(async () => {
      const found = await geocode(query);
      if (current !== requestId.current) return;
      setResults(found);
      setOpen(found.length > 0);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [value.label, value.lat]);

  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value.label}
        placeholder="City or address"
        autoComplete="off"
        onChange={(event) => onChange({ label: event.target.value, lat: null, lon: null })}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
      />
      {open && results.length > 0 && (
        <ul className="suggestions">
          {results.map((place) => (
            <li key={`${place.lat},${place.lon},${place.label}`}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(place);
                  setOpen(false);
                  setResults([]);
                }}
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}
