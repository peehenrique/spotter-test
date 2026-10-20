export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function formatMiles(miles: number): string {
  return `${miles.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} mi`;
}

export function formatPounds(pounds: number): string {
  return `${Math.round(pounds).toLocaleString()} lb`;
}

export function shortPlace(label: string): string {
  const parts = label
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
  return label;
}

export function placeCode(label: string): string {
  const city = label.split(",")[0]?.trim() ?? label;
  const words = city.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0].slice(0, 1)}${words[1].slice(0, 2)}`.toUpperCase();
  }
  const compact = city.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();
  return compact || "—";
}

export function formatShortStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatEta(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatForecastHour(iso: string, index: number): string {
  const time = new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
  });
  return `+${index}h · ${time}`;
}

export function defaultDeparture(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(6, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toIso(localValue: string): string {
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Choose a departure date and time.");
  }
  return date.toISOString();
}
