import L from "leaflet";
import type { CorridorPoint } from "../types";

const RISK_FILL: Record<number, string> = {
  1: "rgba(61, 204, 151, 0.42)",
  2: "rgba(226, 177, 90, 0.48)",
  3: "rgba(240, 138, 36, 0.55)",
  4: "rgba(255, 93, 93, 0.62)",
  5: "rgba(213, 107, 255, 0.68)",
};

const RADIUS_METERS = 16 * 1609.344;

export class CorridorCanvasLayer extends L.Layer {
  private points: CorridorPoint[] = [];
  private hour = 0;
  private map: L.Map | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private frame = 0;

  setFrame(points: CorridorPoint[], hour: number): void {
    this.points = points;
    this.hour = hour;
    this.schedule();
  }

  onAdd(map: L.Map): this {
    this.map = map;
    const canvas = L.DomUtil.create("canvas", "corridor-canvas") as HTMLCanvasElement;
    this.canvas = canvas;
    map.getPanes().overlayPane?.appendChild(canvas);
    map.on("moveend zoomend viewreset resize", this.schedule);
    this.schedule();
    return this;
  }

  onRemove(map: L.Map): this {
    map.off("moveend zoomend viewreset resize", this.schedule);
    this.canvas?.remove();
    this.canvas = null;
    this.map = null;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    return this;
  }

  private schedule = (): void => {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.redraw();
    });
  };

  private redraw(): void {
    const map = this.map;
    const canvas = this.canvas;
    if (!map || !canvas) return;
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    canvas.width = Math.max(1, Math.round(size.x * dpr));
    canvas.height = Math.max(1, Math.round(size.y * dpr));
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size.x, size.y);

    for (const point of this.points) {
      const risk = point.risks[this.hour] ?? 1;
      const center = map.latLngToContainerPoint([point.lat, point.lon]);
      const edge = map.latLngToContainerPoint(offsetEast(point.lat, point.lon, RADIUS_METERS));
      const radius = Math.max(12, center.distanceTo(edge));
      if (
        center.x < -radius ||
        center.y < -radius ||
        center.x > size.x + radius ||
        center.y > size.y + radius
      ) {
        continue;
      }
      const gradient = context.createRadialGradient(center.x, center.y, radius * 0.1, center.x, center.y, radius);
      gradient.addColorStop(0, RISK_FILL[risk] ?? RISK_FILL[1]);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(center.x, center.y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function offsetEast(lat: number, lon: number, meters: number): L.LatLng {
  const degrees = meters / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return L.latLng(lat, lon + degrees);
}
