import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Checkpoint, PlanResponse, RiskLabel } from "../types";
import { RISK_COLOR, RISK_NAME, routeColor } from "../risk";
import { formatEta } from "../format";
import { CorridorCanvasLayer } from "../map/corridorLayer";

interface MapViewProps {
  plan: PlanResponse | null;
  selectedId: string | null;
  hour: number;
  focus: { lat: number; lon: number; token: number } | null;
  onSelectRoute: (routeId: string) => void;
}

const RISK_RANK: Record<RiskLabel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  severe: 4,
  no_travel: 5,
};

export function MapView({ plan, selectedId, hour, focus, onSelectRoute }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const corridorRef = useRef<CorridorCanvasLayer | null>(null);
  const routesRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectRoute);
  onSelectRef.current = onSelectRoute;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    const map = L.map(container, { zoomControl: false, minZoom: 3, maxZoom: 16 }).setView([39.5, -98], 4);
    const attribution = 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ';
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      attribution,
      maxZoom: 16,
    }).addTo(map);
    map.createPane("labels");
    const labels = map.getPane("labels");
    if (labels) {
      labels.style.zIndex = "450";
      labels.style.pointerEvents = "none";
    }
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      { pane: "labels", maxZoom: 16 },
    ).addTo(map);
    const corridor = new CorridorCanvasLayer();
    corridor.addTo(map);
    const routes = L.layerGroup().addTo(map);
    mapRef.current = map;
    corridorRef.current = corridor;
    routesRef.current = routes;
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.remove();
      mapRef.current = null;
      corridorRef.current = null;
      routesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const group = routesRef.current;
    if (!group) return;
    group.clearLayers();
    if (!plan) return;
    const selected = selectedId ?? plan.recommended_route_id;
    const selectedRoute = plan.routes.find((route) => route.id === selected);
    const drawOrder = [...plan.routes].sort((a, b) => Number(a.id === selected) - Number(b.id === selected));
    drawOrder.forEach((route, index) => {
      const active = route.id === selected;
      const latlngs = route.geometry.map(([lon, lat]) => [lat, lon] as [number, number]);
      if (active) {
        L.polyline(latlngs, { color: "#083238", weight: 11, opacity: 0.95, interactive: false }).addTo(group);
      }
      const line = L.polyline(latlngs, {
        color: routeColor(plan, route.id, active),
        weight: active ? 6 : 4,
        opacity: active ? 1 : 0.95,
      });
      line.on("click", () => onSelectRef.current(route.id));
      line.addTo(group);
      if (!active && selectedRoute) {
        const delta = Math.round((route.duration_seconds - selectedRoute.duration_seconds) / 60);
        if (delta !== 0) {
          const text = delta > 0 ? `${delta} min. longer` : `${Math.abs(delta)} min. shorter`;
          const at = along(latlngs, 0.36 + (index % 3) * 0.14);
          L.marker(at, {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              className: "delay-label",
              html: `<span>${text}</span>`,
              iconSize: [130, 18],
              iconAnchor: [65, 9],
            }),
          }).addTo(group);
        }
      }
    });

    for (const route of plan.routes) {
      const active = route.id === selected;
      for (const checkpoint of route.checkpoints) {
        const marker = L.circleMarker([checkpoint.lat, checkpoint.lon], {
          radius: active ? 5.5 : 3.5,
          color: "#ffffff",
          weight: 2,
          fillColor: RISK_COLOR[checkpoint.risk],
          fillOpacity: active ? 1 : 0.8,
        });
        marker.bindTooltip(`${Math.round(checkpoint.distance_miles)} mi · ${RISK_NAME[checkpoint.risk]}`, {
          direction: "top",
          opacity: 1,
        });
        marker.bindPopup(popupHtml(checkpoint), { maxWidth: 260 });
        marker.addTo(group);
      }
    }

    if (selectedRoute) {
      const worst = selectedRoute.checkpoints.reduce<Checkpoint | null>((current, checkpoint) => {
        if (!current || RISK_RANK[checkpoint.risk] > RISK_RANK[current.risk]) return checkpoint;
        return current;
      }, null);
      if (worst && RISK_RANK[worst.risk] >= RISK_RANK.high) {
        L.marker([worst.lat, worst.lon], {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "alert-label",
            html: `<span>${RISK_NAME[worst.risk]}</span>`,
            iconSize: [110, 20],
            iconAnchor: [55, 26],
          }),
        }).addTo(group);
      }
    }

    for (const place of [plan.origin, plan.destination]) {
      L.circleMarker([place.lat, place.lon], {
        radius: 7,
        color: "#ffffff",
        weight: 3,
        fillColor: "#2f6bff",
        fillOpacity: 1,
      })
        .bindTooltip(place.label, { direction: "top", opacity: 1 })
        .addTo(group);
    }
  }, [plan, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !plan) return;
    const bounds = L.latLngBounds([]);
    for (const route of plan.routes) {
      for (const [lon, lat] of route.geometry) bounds.extend([lat, lon]);
    }
    if (bounds.isValid()) {
      map.fitBounds(bounds, { paddingTopLeft: [430, 72], paddingBottomRight: [360, 320] });
    }
  }, [plan]);

  useEffect(() => {
    corridorRef.current?.setFrame(plan?.corridor.points ?? [], hour);
  }, [plan, hour]);

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    const zoom = Math.max(mapRef.current.getZoom(), 7);
    mapRef.current.flyTo([focus.lat, focus.lon], zoom, { duration: 0.55 });
  }, [focus]);

  return (
    <>
      <div ref={containerRef} className="map" />
      <div className="zoom-stack">
        <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          −
        </button>
      </div>
    </>
  );
}

function along(coords: [number, number][], fraction: number): [number, number] {
  if (coords.length === 0) return [0, 0];
  const index = Math.min(coords.length - 1, Math.max(0, Math.round((coords.length - 1) * fraction)));
  return coords[index];
}

function popupHtml(checkpoint: Checkpoint): string {
  const escalated = checkpoint.load_escalated ? '<p class="popup-note">Load rule raised the wind risk.</p>' : "";
  return `
    <div class="popup">
      <strong>Mile ${checkpoint.distance_miles.toFixed(1)}</strong>
      <p>${escapeHtml(formatEta(checkpoint.eta))}</p>
      <p>Wind ${checkpoint.wind_mph.toFixed(0)} mph · ${RISK_NAME[checkpoint.wind_risk]}</p>
      <p>Rain ${checkpoint.rain_in_hr.toFixed(2)} in/hr · ${RISK_NAME[checkpoint.rain_risk]}</p>
      <p>Snow ${checkpoint.snow_in_hr.toFixed(1)} in/hr · ${RISK_NAME[checkpoint.snow_risk]}</p>
      <p>Combined <b>${RISK_NAME[checkpoint.risk]}</b></p>
      ${escalated}
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
