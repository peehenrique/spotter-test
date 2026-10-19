import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Checkpoint, PlanResponse } from "../types";
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
    const map = L.map(container, { zoomControl: true }).setView([39.5, -96], 4);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    L.control.scale({ imperial: true, metric: false, position: "topright" }).addTo(map);
    const corridor = new CorridorCanvasLayer();
    corridor.addTo(map);
    const routes = L.layerGroup().addTo(map);
    mapRef.current = map;
    corridorRef.current = corridor;
    routesRef.current = routes;
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
    const drawOrder = [...plan.routes].sort((a, b) => Number(a.id === selected) - Number(b.id === selected));
    for (const route of drawOrder) {
      const active = route.id === selected;
      const line = L.polyline(
        route.geometry.map(([lon, lat]) => [lat, lon] as [number, number]),
        {
          color: routeColor(plan, route.id),
          weight: active ? 6 : 3,
          opacity: active ? 0.95 : 0.5,
        },
      );
      line.on("click", () => onSelectRef.current(route.id));
      line.addTo(group);
    }
    for (const route of plan.routes) {
      const active = route.id === selected;
      for (const checkpoint of route.checkpoints) {
        const marker = L.circleMarker([checkpoint.lat, checkpoint.lon], {
          radius: active ? 6 : 3.5,
          color: "#0b1016",
          weight: active ? 2 : 1,
          fillColor: RISK_COLOR[checkpoint.risk],
          fillOpacity: active ? 1 : 0.75,
        });
        marker.bindTooltip(`${Math.round(checkpoint.distance_miles)} mi · ${RISK_NAME[checkpoint.risk]}`, {
          direction: "top",
          opacity: 1,
        });
        marker.bindPopup(popupHtml(checkpoint), { maxWidth: 260 });
        marker.addTo(group);
      }
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
      map.fitBounds(bounds, { paddingTopLeft: [36, 36], paddingBottomRight: [36, 128] });
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

  return <div ref={containerRef} className="map" />;
}

function popupHtml(checkpoint: Checkpoint): string {
  const escalated = checkpoint.load_escalated ? "<p class=\"popup-note\">Load rule raised the wind risk.</p>" : "";
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
