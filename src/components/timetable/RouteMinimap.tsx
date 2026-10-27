import maplibregl, { type Map as MapLibreMap, type StyleImageInterface } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ERouteTuple, EVehiclePosition, type Point, type VehiclePosition } from "@/api/types";
import { attributionFor, mapStyleFor, normalizeTileLayer } from "@/components/map/mapStyle";
import { escapeHtml } from "@/components/map/icons";
import { vehicleMarkerHtml } from "@/components/map/markers";
import { vehicleTypeName } from "@/components/departures/VehicleTypeIcon";
import { parseVehicleId } from "@/lib/transit";
import { useSettings } from "@/store/settings";
import { useThemeMode } from "./common";

export type LineStop = { id: string; name: string; location: Point; onDemand: boolean; minutes: number };

type Props = {
    center: Point;
    maxZoom?: number;
    line: Point[];
    stops: LineStop[];
    routeType: number;
    vehicles: VehiclePosition[];
    headsign: string;
    showVehicles: boolean;
    activeIndex: number;
    onStopClick: (index: number) => void;
    fitKey: number;
    onReady?: (fit: () => void) => void;
};

const SOURCE = "route-id-trip-line";
const LAYER = "route-id-trip-line-layer";
const STOPS_MIN_ZOOM = 12;
const ACTIVE_ZOOM = 14;

const DASH = 12.5;
const GAP = 0.9;
const PERIOD_MS = 3000;
const HEIGHT = 8;
const WIDTH = Math.round(HEIGHT * (DASH + GAP));
const FILLED = (WIDTH * DASH) / (DASH + GAP);

const cssColor = (name: string) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || "#888888";
    const probe = document.createElement("div");
    probe.style.color = value;
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g)?.map(Number) ?? [136, 136, 136];
    probe.remove();
    return { r: rgb[0], g: rgb[1], b: rgb[2] };
};

const overlap = (a: number, b: number, c: number, d: number) => Math.max(0, Math.min(b, d) - Math.max(a, c));

// Moving dashed line pattern of the original ("trip-dash-<type>").
const dashImage = (color: { r: number; g: number; b: number }, animate: boolean): StyleImageInterface => {
    const data = new Uint8Array(WIDTH * HEIGHT * 4);
    const paint = (offset: number) => {
        for (let x = 0; x < WIDTH; x++) {
            const cover = overlap(x, x + 1, offset - WIDTH, offset - WIDTH + FILLED) + overlap(x, x + 1, offset, offset + FILLED) + overlap(x, x + 1, offset + WIDTH, offset + WIDTH + FILLED);
            const i = x * 4;
            data[i] = color.r;
            data[i + 1] = color.g;
            data[i + 2] = color.b;
            data[i + 3] = Math.round(Math.min(cover, 1) * 255);
        }
        for (let row = 1; row < HEIGHT; row++) data.copyWithin(row * WIDTH * 4, 0, WIDTH * 4);
    };
    paint(0);
    let map: MapLibreMap | null = null;
    let last = -1;
    return {
        width: WIDTH,
        height: HEIGHT,
        data,
        onAdd(instance) {
            map = instance as MapLibreMap;
        },
        render() {
            if (!animate) return false;
            const offset = ((performance.now() % PERIOD_MS) / PERIOD_MS) * WIDTH;
            map?.triggerRepaint();
            if (Math.abs(offset - last) < 0.01) return false;
            last = offset;
            paint(offset);
            return true;
        },
    };
};

const stopMarkerHtml = (index: number, typeName: string) =>
    `<button class="stop_marker bg-${typeName} text-white" type="button"><span class="marker-fade-in" style="display: flex;place-items:center;"><strong>${index + 1}</strong></span></button>`;

const stopPopupHtml = (name: string, extra: string) =>
    `<div style="display:flex; align-items: center; flex-direction: column;"><div style="font-weight: bold; word-break: break-word; color: var(--default-text); text-align: center">${escapeHtml(name)}<br/></div>${extra}</div>`;

export const RouteMinimap = ({ center, maxZoom = 18, line, stops, routeType, vehicles, headsign, showVehicles, activeIndex, onStopClick, fitKey, onReady }: Props) => {
    const { t } = useTranslation();
    const container = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<MapLibreMap | null>(null);
    const [zoomedIn, setZoomedIn] = useState(false);
    const dark = useThemeMode() === "dark";
    const [settings] = useSettings();
    const layer = normalizeTileLayer(settings.mapStyle);
    const typeName = vehicleTypeName(routeType);
    const boundsRef = useRef<maplibregl.LngLatBounds | null>(null);
    const stopMarkers = useRef<maplibregl.Marker[]>([]);
    const popup = useRef<maplibregl.Popup | null>(null);
    const vehicleMarkers = useRef(new Map<string, maplibregl.Marker>());
    const clickRef = useRef(onStopClick);
    clickRef.current = onStopClick;

    const fit = () => {
        if (!map || !boundsRef.current || boundsRef.current.isEmpty()) return;
        const container = map.getContainer();
        const x = Math.min(70, Math.floor(container.clientWidth / 6));
        const y = Math.min(70, Math.floor(container.clientHeight / 6));
        map.fitBounds(boundsRef.current, { padding: { top: y, bottom: y, left: x, right: x }, duration: 100 });
    };

    useEffect(() => {
        if (!container.current) return;
        let instance: MapLibreMap | null = null;
        try {
            instance = new maplibregl.Map({
                container: container.current,
                style: mapStyleFor(layer, dark),
                center,
                zoom: 9,
                maxZoom,
                attributionControl: false,
                dragRotate: false,
                pitchWithRotate: false,
                touchPitch: false,
            });
        } catch {
            return;
        }
        instance.touchZoomRotate.disableRotation();
        instance.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: attributionFor(layer) }), "bottom-right");
        instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        const onZoom = () => setZoomedIn(instance!.getZoom() >= STOPS_MIN_ZOOM);
        instance.on("zoomend", onZoom);
        instance.on("load", () => setMap(instance));
        return () => {
            instance?.remove();
            setMap(null);
        };
    }, [dark, layer]);

    useEffect(() => {
        if (!map) return;
        const remove = () => {
            if (map.getLayer(LAYER)) map.removeLayer(LAYER);
            if (map.getSource(SOURCE)) map.removeSource(SOURCE);
        };
        if (line.length < 2) {
            remove();
            boundsRef.current = null;
            return;
        }
        const pattern = `trip-dash-${typeName}`;
        if (map.hasImage(pattern)) map.removeImage(pattern);
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        map.addImage(pattern, dashImage(cssColor(typeName), !reduced));
        const data = { type: "Feature" as const, properties: { pattern }, geometry: { type: "LineString" as const, coordinates: line } };
        const source = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
        if (source) source.setData(data);
        else {
            map.addSource(SOURCE, { type: "geojson", data });
            map.addLayer({ id: LAYER, type: "line", source: SOURCE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 4, "line-pattern": ["get", "pattern"] } });
        }
        const bounds = new maplibregl.LngLatBounds();
        for (const point of line) bounds.extend(point);
        boundsRef.current = bounds;
    }, [map, line, typeName]);

    useEffect(() => {
        if (!map) return;
        onReady?.(fit);
        const timer = setTimeout(fit, 500);
        return () => clearTimeout(timer);
    }, [map, fitKey, line]);

    useEffect(() => {
        stopMarkers.current.forEach((marker) => marker.remove());
        stopMarkers.current = [];
        if (!map || !zoomedIn) return;
        stops.forEach((stop, index) => {
            const holder = document.createElement("div");
            holder.innerHTML = stopMarkerHtml(index, typeName);
            const element = holder.firstElementChild as HTMLElement;
            element.addEventListener("click", (event) => {
                event.stopPropagation();
                clickRef.current(index);
            });
            stopMarkers.current.push(new maplibregl.Marker({ element, anchor: "center" }).setLngLat(stop.location).addTo(map));
        });
        return () => {
            stopMarkers.current.forEach((marker) => marker.remove());
            stopMarkers.current = [];
        };
    }, [map, zoomedIn, stops, typeName]);

    useEffect(() => {
        popup.current?.remove();
        popup.current = null;
        const stop = stops[activeIndex];
        if (!map || !stop) return;
        if (zoomedIn) {
            const extra = stop.onDemand ? `<div>${escapeHtml(t("global.onDemand"))}</div>` : "";
            popup.current = new maplibregl.Popup({ closeOnClick: true }).setLngLat(stop.location).setHTML(stopPopupHtml(stop.name, extra)).addTo(map);
        }
        map.easeTo({ center: stop.location, zoom: ACTIVE_ZOOM });
    }, [activeIndex]);

    useEffect(() => {
        if (!map) return;
        const seen = new Set<string>();
        for (const vehicle of vehicles) {
            const id = vehicle[EVehiclePosition.id];
            seen.add(id);
            const html = vehicleMarkerHtml(vehicle, { showBrigade: settings.markerShowBrigade, showVehicleNo: settings.markerShowVehicleNo, colorByDelay: false, dark });
            const route = vehicle[EVehiclePosition.route];
            const brigade = vehicle[EVehiclePosition.brigade];
            const number = parseVehicleId(id).number;
            const popupHtml = `<div><div class="MuiTypography-root MuiTypography-body2"><strong>${escapeHtml(route[ERouteTuple.routeName])}</strong> ${escapeHtml(headsign)}</div>${
                brigade && routeType !== 1 ? `<div class="MuiTypography-root MuiTypography-body2" style="margin-top:5px"><strong>${escapeHtml(t("global.brigade"))}</strong>: ${escapeHtml(brigade)}</div>` : ""
            }${number && ![1, 2, 4].includes(routeType) ? `<div class="MuiTypography-root MuiTypography-body2"><strong>${escapeHtml(t("global.vehicleNo"))}</strong>: ${escapeHtml(number)}</div>` : ""}<a style="margin-top:10px;display:block;width:100%;text-align:center" href="/${encodeURIComponent(route[ERouteTuple.city])}?pojazd=${encodeURIComponent(id)}">${escapeHtml(t("timetables.vehicleDetails"))}</a></div>`;
            let marker = vehicleMarkers.current.get(id);
            if (!marker) {
                const element = document.createElement("div");
                element.className = "mapgl-icon-none vehicle-marker-icon";
                marker = new maplibregl.Marker({ element, anchor: "left", offset: [0, -12] })
                    .setLngLat(vehicle[EVehiclePosition.location])
                    .setPopup(new maplibregl.Popup({ closeButton: true }))
                    .addTo(map);
                vehicleMarkers.current.set(id, marker);
            } else marker.setLngLat(vehicle[EVehiclePosition.location]);
            const element = marker.getElement();
            if (element.innerHTML !== html) element.innerHTML = html;
            element.style.display = showVehicles ? "" : "none";
            marker.getPopup()?.setHTML(popupHtml);
        }
        vehicleMarkers.current.forEach((marker, id) => {
            if (seen.has(id)) return;
            marker.remove();
            vehicleMarkers.current.delete(id);
        });
    }, [map, vehicles, showVehicles, dark, headsign]);

    useEffect(
        () => () => {
            vehicleMarkers.current.forEach((marker) => marker.remove());
            vehicleMarkers.current.clear();
        },
        [map],
    );

    return <div ref={container} className="minimapgl noselect" style={{ height: "100%", width: "100%" }} />;
};
