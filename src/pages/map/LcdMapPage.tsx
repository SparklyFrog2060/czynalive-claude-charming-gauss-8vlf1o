import { Box, Typography } from "@mui/material";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCity } from "@/api/cities";
import { EVehiclePosition, type Point } from "@/api/types";
import { useMapFeatures, useVehicleExtras, useViewport } from "@/components/map/hooks";
import { lcdMarkerHtml } from "@/components/map/markers";
import { attributionFor, mapStyleFor } from "@/components/map/mapStyle";
import { BrandLogo } from "@/components/map/MapLogo";

const LCD_ZOOM = 15;
const RELOAD_MS = 600_000;
const ANIMATION_MS = 1000;

// `/:city/lcd-map`: chrome-less board map with big markers (headsign, brigade, vehicle no, delay).
export default function LcdMapPage() {
    const { city = "" } = useParams();
    const cityInfo = useCity(city);
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<maplibregl.Map | null>(null);
    const markers = useRef(new Map<string, { marker: maplibregl.Marker; html: string; from: Point; to: Point; start: number }>());

    // The board map exists only for Słupsk in the original; other cities are sent there.
    useEffect(() => {
        if (city !== "slupsk") navigate("/slupsk");
    }, [city]);

    useEffect(() => {
        const root = document.documentElement;
        const previous = root.getAttribute("data-theme");
        root.setAttribute("data-theme", "light");
        document.title = `Mapa LCD ${cityInfo?.name ?? ""} - Czynalive`;
        const timer = setTimeout(() => window.location.reload(), RELOAD_MS);
        return () => {
            clearTimeout(timer);
            if (previous) root.setAttribute("data-theme", previous);
        };
    }, []);

    useEffect(() => {
        if (!containerRef.current || !cityInfo) return;
        const z = Number(params.get("z"));
        const lat = Number(params.get("lat"));
        const lng = Number(params.get("lng"));
        const hasView = params.get("z") && params.get("lat") && params.get("lng") && [z, lat, lng].every(Number.isFinite);
        const instance = new maplibregl.Map({
            container: containerRef.current,
            style: mapStyleFor("osm", false),
            center: hasView ? [lng, lat] : cityInfo.location,
            zoom: hasView ? z : LCD_ZOOM,
            maxZoom: 20,
            attributionControl: false,
            dragRotate: false,
            touchPitch: false,
            fadeDuration: 0,
        });
        instance.touchZoomRotate.disableRotation();
        instance.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: attributionFor("osm") }), "bottom-right");
        instance.on("moveend", () => {
            const center = instance.getCenter();
            const search = new URLSearchParams(window.location.search);
            search.set("z", String(Math.round(instance.getZoom() * 100) / 100));
            search.set("lat", String(center.lat));
            search.set("lng", String(center.lng));
            window.history.replaceState(window.history.state, "", `${window.location.pathname}?${search}`);
        });
        instance.once("load", () => setMap(instance));
        const store = markers.current;
        return () => {
            for (const entry of store.values()) entry.marker.remove();
            store.clear();
            setMap(null);
            instance.remove();
        };
    }, [city, !!cityInfo]);

    const viewport = useViewport(map);
    const features = useMapFeatures(city, viewport ? { ...viewport, zoom: Math.max(viewport.zoom, 14) } : null, []);
    const extras = useVehicleExtras(city, true);

    useEffect(() => {
        if (!map) return;
        const store = markers.current;
        const seen = new Set<string>();
        const now = performance.now();
        for (const vehicle of features.positions) {
            const id = vehicle[EVehiclePosition.id];
            seen.add(id);
            const extra = extras[id];
            const html = lcdMarkerHtml(vehicle, extra?.[1] ?? "", extra ? extra[0] : undefined);
            const target = vehicle[EVehiclePosition.location];
            const existing = store.get(id);
            if (existing) {
                if (existing.html !== html) {
                    existing.marker.getElement().innerHTML = html;
                    existing.html = html;
                }
                const current = existing.marker.getLngLat();
                existing.from = [current.lng, current.lat];
                existing.to = target;
                existing.start = now;
            } else {
                const element = document.createElement("div");
                element.className = "mapgl-icon-none vehicle-marker-icon";
                element.innerHTML = html;
                store.set(id, {
                    marker: new maplibregl.Marker({ element, anchor: "left" }).setLngLat(target).addTo(map),
                    html,
                    from: target,
                    to: target,
                    start: now,
                });
            }
        }
        for (const [id, entry] of store) {
            if (!seen.has(id)) {
                entry.marker.remove();
                store.delete(id);
            }
        }
        let frame = 0;
        const step = () => {
            const time = performance.now();
            let running = false;
            for (const entry of store.values()) {
                const progress = Math.min(1, (time - entry.start) / ANIMATION_MS);
                if (progress < 1) running = true;
                entry.marker.setLngLat([entry.from[0] + (entry.to[0] - entry.from[0]) * progress, entry.from[1] + (entry.to[1] - entry.from[1]) * progress]);
            }
            if (running) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [map, features.positions, extras]);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
            <Box sx={{ height: 60, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "0 20px", lineHeight: 1 }} className="bg-default-bg">
                <BrandLogo />
                <Typography variant="h4" className="text-default-text" sx={{ fontWeight: "bold" }}>
                    Napędzane przez Czynalive
                </Typography>
            </Box>
            <Box sx={{ position: "relative", flex: 1, minHeight: 0 }}>
                <div ref={containerRef} className="noselect mapgl-map" style={{ position: "absolute", inset: 0 }} />
                <Box sx={{ position: "absolute", left: 0, bottom: "calc(1px + env(safe-area-inset-bottom, 0))" }}>
                    <BrandLogo style={{ opacity: 0.7 }} />
                </Box>
            </Box>
        </Box>
    );
}
