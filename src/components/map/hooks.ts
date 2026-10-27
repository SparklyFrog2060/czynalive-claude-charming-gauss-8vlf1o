import { cityRouteIdsWithVirtual } from "@/api/virtualCities";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { cityGet } from "@/api/client";
import type { Point, RouteTuple, StopTuple, VehiclePosition } from "@/api/types";
import { loadWstStops, loadWstVehicles, mergeWstStops } from "@/api/wst";
import { openSse } from "./sse";
import { DETAILED_ZOOM } from "./VehicleLayer";

export type Viewport = { zoom: number; bounds: [number, number, number, number] };

const round = (value: number) => Math.round(value * 1e4) / 1e4;

// Debounced viewport of the map (the mapFeatures stream is fixed per connection).
export const useViewport = (map: MapLibreMap | null, debounceMs = 400): Viewport | null => {
    const [viewport, setViewport] = useState<Viewport | null>(null);
    useEffect(() => {
        if (!map) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const read = () => {
            const bounds = map.getBounds();
            const padLon = (bounds.getEast() - bounds.getWest()) * 0.15;
            const padLat = (bounds.getNorth() - bounds.getSouth()) * 0.15;
            setViewport({
                zoom: Math.round(map.getZoom() * 10) / 10,
                bounds: [round(bounds.getWest() - padLon), round(bounds.getSouth() - padLat), round(bounds.getEast() + padLon), round(bounds.getNorth() + padLat)],
            });
        };
        const onMove = () => {
            clearTimeout(timer);
            timer = setTimeout(read, debounceMs);
        };
        read();
        map.on("moveend", onMove);
        return () => {
            clearTimeout(timer);
            map.off("moveend", onMove);
        };
    }, [map]);
    return viewport;
};

export type MapFeatures = { positions: VehiclePosition[]; dots: [string, Point][]; stops: StopTuple[]; error: boolean; loading: boolean; suggestedCity?: string };

type Initial = { stops: StopTuple[]; suggestedCity?: string };
type Message = { positions: VehiclePosition[]; dots: [string, Point][]; bbox?: number[] };

// `mapFeatures/:zoom/:bounds/stream`, reopened when the viewport or the line filter changes.
export const useMapFeatures = (city: string, viewport: Viewport | null, filterRoutes: string[], enabled = true): MapFeatures => {
    const [state, setState] = useState<MapFeatures>({ positions: [], dots: [], stops: [], error: false, loading: true });
    const stopsRef = useRef<StopTuple[]>([]);
    const routesKey = filterRoutes.join(",");

    useEffect(() => {
        if (!viewport || !enabled) return;
        // From DETAILED_ZOOM on ask for >14.5 so the server sends stops.
        const zoom = viewport.zoom >= DETAILED_ZOOM ? Math.max(viewport.zoom, 14.6) : viewport.zoom;
        setState((prev) => ({ ...prev, loading: true }));
        let handle: { close: () => void } | null = null;
        let cancelled = false;
        const controller = new AbortController();
        const routeIdsPromise = routesKey ? Promise.resolve(routesKey.split(",")) : cityRouteIdsWithVirtual(city);
        // Load the Wieliczka stops in every Kraków viewport, even with a
        // Kraków-only line filter, so shared physical stops remain discoverable.
        const wstStopsPromise = city === "krakow" ? loadWstStops(controller.signal).catch(() => []) : Promise.resolve([] as StopTuple[]);
        Promise.all([routeIdsPromise, wstStopsPromise]).then(([routeIds, wstStops]) => {
            if (cancelled) return;
            const query = routeIds.length ? { filterRoutes: routeIds.join(","), graph: 1 } : {};
            handle = openSse<Initial, Message>(`/${city}/mapFeatures/${zoom}/${viewport.bounds.join(",")}/stream`, query, {
                onInitial: (initial) => {
                    stopsRef.current = mergeWstStops(initial.stops ?? [], wstStops);
                    setState((prev) => ({ ...prev, stops: stopsRef.current, suggestedCity: initial.suggestedCity }));
                },
                onMessage: (message) =>
                    setState((prev) => ({ ...prev, positions: message.positions ?? [], dots: message.dots ?? [], stops: stopsRef.current, error: false, loading: false })),
                onError: () => setState((prev) => ({ ...prev, error: true, loading: false })),
            });
        });
        return () => {
            cancelled = true;
            controller.abort();
            handle?.close();
        };
    }, [city, viewport?.zoom, viewport?.bounds.join(","), routesKey, enabled]);

    return state;
};

export type VehicleExtras = Record<string, [delay: number | null, headsign: string, model: string]>;
// cnc endpoint with per-vehicle delay / headsign / model; empty when not deployed.
export const useVehicleExtras = (city: string, enabled: boolean, refreshMs = 15000): VehicleExtras => {
    const [extras, setExtras] = useState<VehicleExtras>({});
    useEffect(() => {
        if (!enabled) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const controller = new AbortController();
        let failures = 0;
        const run = () => {
            cityGet<VehicleExtras>(city, "/cnc/map/vehicles", undefined, controller.signal)
                .then((data) => {
                    failures = 0;
                    setExtras(data);
                })
                .catch(() => {
                    failures++;
                })
                .finally(() => {
                    if (!controller.signal.aborted && failures < 3) timer = setTimeout(run, refreshMs);
                });
        };
        run();
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [city, enabled]);
    return extras;
};

// Live Wieliczka buses, merged into the map like any other vehicle.
export const useWstVehicles = (enabled: boolean, refreshMs = 20000): VehiclePosition[] => {
    const [positions, setPositions] = useState<VehiclePosition[]>([]);
    useEffect(() => {
        if (!enabled) {
            setPositions([]);
            return;
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        const controller = new AbortController();
        let failures = 0;
        const run = () => {
            loadWstVehicles(controller.signal)
                .then((data) => {
                    failures = 0;
                    setPositions(data);
                })
                .catch(() => {
                    failures++;
                })
                .finally(() => {
                    if (!controller.signal.aborted && failures < 3) timer = setTimeout(run, refreshMs);
                });
        };
        run();
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [enabled, refreshMs]);
    return positions;
};

// Positions of explicitly filtered vehicles (one light stream each; the map stream cannot filter by vehicle).
export const useWatchedVehicles = (city: string, vehicleIds: string[]): VehiclePosition[] => {
    const [positions, setPositions] = useState<Record<string, VehiclePosition>>({});
    const key = vehicleIds.slice(0, 20).join(",");
    useEffect(() => {
        setPositions({});
        if (!key) return;
        const handles = key.split(",").map((vehicleId) =>
            openSse<unknown, { position: VehiclePosition }>(`/${city}/positions/${encodeURIComponent(vehicleId)}/stream`, { details: false }, {
                onMessage: (message) => message.position && setPositions((prev) => ({ ...prev, [vehicleId]: message.position })),
                onFatal: () =>
                    setPositions((prev) => {
                        const next = { ...prev };
                        delete next[vehicleId];
                        return next;
                    }),
            }),
        );
        return () => handles.forEach((handle) => handle.close());
    }, [city, key]);
    return Object.values(positions);
};
