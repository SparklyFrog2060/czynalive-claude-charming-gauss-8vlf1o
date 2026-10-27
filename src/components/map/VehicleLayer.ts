import type { Feature, FeatureCollection } from "geojson";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import { ERouteTuple, EVehiclePosition, type Point, type VehiclePosition } from "@/api/types";
import { vehicleNumberId, vehicleRoundId, vehicleTearId } from "./canvasImages";
import { typeClass } from "./icons";
import { delayMinutesClass, delayToMinutes, vehicleMarkerHtml, type MarkerOptions } from "./markers";

export const DETAILED_ZOOM = 14;
export const SMALL_ZOOM = 10;
const ANIMATION_MS = 1000;
const SOURCE = "cnc-vehicles";

export type VehicleRenderOptions = Omit<MarkerOptions, "delayMs"> & { delays: Record<string, number | null>; focused?: boolean };

type Animation = { from: Point; to: Point; start: number };

const displayLine = (name: string) => (name.length > 4 ? name[0] : name);

const emptyCollection = (): FeatureCollection => ({ type: "FeatureCollection", features: [] });

// Live vehicles: DOM markers when zoomed in, canvas symbols (circle / teardrop + line) or dots otherwise.
export class VehicleLayer {
    private markers = new Map<string, { marker: maplibregl.Marker; element: HTMLDivElement; html: string; vehicle: VehiclePosition }>();
    private current = new Map<string, Point>();
    private animations = new Map<string, Animation>();
    private raf = 0;
    private lastFrame = 0;
    private positions: VehiclePosition[] = [];
    private dots: [string, Point][] = [];
    private options: VehicleRenderOptions = { showBrigade: false, showVehicleNo: false, colorByDelay: false, dark: false, delays: {} };
    private features = emptyCollection();

    constructor(
        private map: MapLibreMap,
        private onVehicleClick: (vehicle: VehiclePosition) => void,
    ) {
        this.install();
        map.on("zoomend", this.render);
        map.on("style.load", this.install);
    }

    destroy() {
        cancelAnimationFrame(this.raf);
        this.map.off("zoomend", this.render);
        this.map.off("style.load", this.install);
        for (const entry of this.markers.values()) entry.marker.remove();
        this.markers.clear();
    }

    private install = () => {
        const map = this.map;
        if (map.getSource(SOURCE)) return;
        map.addSource(SOURCE, { type: "geojson", data: this.features });
        map.addLayer({
            id: "cnc-vehicles-dots",
            type: "circle",
            source: SOURCE,
            filter: ["==", ["get", "tier"], "dot"],
            paint: { "circle-radius": 4, "circle-color": ["get", "color"] },
        });
        map.addLayer({
            id: "cnc-vehicles-shape",
            type: "symbol",
            source: SOURCE,
            filter: ["==", ["get", "tier"], "small"],
            layout: {
                "icon-image": ["get", "icon"],
                "icon-rotate": ["coalesce", ["get", "angle"], 0],
                "icon-rotation-alignment": "map",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
            },
        });
        map.addLayer({
            id: "cnc-vehicles-label",
            type: "symbol",
            source: SOURCE,
            filter: ["==", ["get", "tier"], "small"],
            layout: { "icon-image": ["get", "label"], "icon-allow-overlap": true, "icon-ignore-placement": true },
        });
    };

    update(positions: VehiclePosition[], dots: [string, Point][], options: VehicleRenderOptions) {
        this.positions = positions;
        this.dots = dots;
        this.options = options;
        const now = performance.now();
        const seen = new Set<string>();
        for (const vehicle of positions) {
            const id = vehicle[EVehiclePosition.id];
            const target = vehicle[EVehiclePosition.location];
            seen.add(id);
            const from = this.current.get(id);
            if (from && (from[0] !== target[0] || from[1] !== target[1]) && Math.abs(from[0] - target[0]) + Math.abs(from[1] - target[1]) < 0.05) {
                this.animations.set(id, { from, to: target, start: now });
            } else {
                this.animations.delete(id);
                this.current.set(id, target);
            }
        }
        for (const id of [...this.current.keys()]) {
            if (!seen.has(id)) {
                this.current.delete(id);
                this.animations.delete(id);
            }
        }
        this.render();
        if (this.animations.size) this.loop();
    }

    // Re-render with current data (settings or theme changed).
    setOptions(options: VehicleRenderOptions) {
        this.options = options;
        for (const entry of this.markers.values()) entry.html = "";
        this.render();
    }

    private positionOf = (vehicle: VehiclePosition): Point => this.current.get(vehicle[EVehiclePosition.id]) ?? vehicle[EVehiclePosition.location];

    private colorKey(vehicle: VehiclePosition) {
        const id = vehicle[EVehiclePosition.id];
        if (this.options.colorByDelay && id in this.options.delays) {
            const delay = this.options.delays[id];
            return `--${delayMinutesClass(delay === null ? null : delayToMinutes(delay))}`;
        }
        return `--${typeClass(vehicle[EVehiclePosition.route][ERouteTuple.routeType])}`;
    }

    private render = () => {
        const zoom = this.map.getZoom();
        const detailed = zoom >= DETAILED_ZOOM || (!!this.options.focused && this.positions.length <= 50);
        const features: Feature[] = [];
        const keep = new Set<string>();

        for (const vehicle of this.positions) {
            const id = vehicle[EVehiclePosition.id];
            const location = this.positionOf(vehicle);
            if (detailed) {
                keep.add(id);
                const html = vehicleMarkerHtml(vehicle, { ...this.options, delayMs: this.options.delays[id] });
                const existing = this.markers.get(id);
                if (existing) {
                    existing.vehicle = vehicle;
                    if (existing.html !== html) {
                        existing.element.innerHTML = html;
                        existing.html = html;
                    }
                    existing.marker.setLngLat(location);
                } else {
                    const element = document.createElement("div");
                    element.className = "mapgl-icon-none vehicle-marker-icon";
                    element.innerHTML = html;
                    element.setAttribute("role", "button");
                    const route = vehicle[EVehiclePosition.route];
                    element.title = `${route[ERouteTuple.routeName]}${vehicle[EVehiclePosition.brigade] ? ` / ${vehicle[EVehiclePosition.brigade]}` : ""}`;
                    const entry = {
                        element,
                        html,
                        vehicle,
                        marker: new maplibregl.Marker({ element, anchor: "left", offset: [0, -12] }).setLngLat(location).addTo(this.map),
                    };
                    element.addEventListener("click", (event) => {
                        event.stopPropagation();
                        this.onVehicleClick(entry.vehicle);
                    });
                    this.markers.set(id, entry);
                }
            } else {
                const bearing = vehicle[EVehiclePosition.bearing];
                const color = this.colorKey(vehicle);
                const small = zoom >= SMALL_ZOOM;
                features.push({
                    type: "Feature",
                    id: features.length,
                    geometry: { type: "Point", coordinates: location },
                    properties: small
                        ? {
                              id,
                              city: vehicle[EVehiclePosition.city],
                              tier: "small",
                              icon: bearing !== null && bearing !== undefined ? vehicleTearId(color) : vehicleRoundId(color),
                              angle: bearing ?? 0,
                              label: vehicleNumberId(displayLine(vehicle[EVehiclePosition.route][ERouteTuple.routeName])),
                          }
                        : { id, city: vehicle[EVehiclePosition.city], tier: "dot", color: getComputedStyle(document.documentElement).getPropertyValue(color).trim() || "#666" },
                });
            }
        }
        for (const [color, location] of this.dots) {
            features.push({ type: "Feature", geometry: { type: "Point", coordinates: location }, properties: { tier: "dot", color } });
        }
        for (const [id, entry] of this.markers) {
            if (!keep.has(id)) {
                entry.marker.remove();
                this.markers.delete(id);
            }
        }
        this.features = { type: "FeatureCollection", features };
        (this.map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(this.features);
    };

    private loop() {
        if (this.raf) return;
        const step = () => {
            this.raf = 0;
            const now = performance.now();
            for (const [id, animation] of this.animations) {
                const progress = Math.min(1, (now - animation.start) / ANIMATION_MS);
                const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
                this.current.set(id, [
                    animation.from[0] + (animation.to[0] - animation.from[0]) * eased,
                    animation.from[1] + (animation.to[1] - animation.from[1]) * eased,
                ]);
                if (progress >= 1) this.animations.delete(id);
            }
            for (const [id, entry] of this.markers) {
                const location = this.current.get(id);
                if (location) entry.marker.setLngLat(location);
            }
            if (this.markers.size === 0 && (now - this.lastFrame > 50 || !this.animations.size)) {
                this.lastFrame = now;
                this.render();
            }
            if (this.animations.size) this.raf = requestAnimationFrame(step);
        };
        this.raf = requestAnimationFrame(step);
    }
}
