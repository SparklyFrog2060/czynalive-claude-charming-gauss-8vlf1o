import type { Point as GeoJsonPoint } from "geojson";
import { Box, Button, Chip, Snackbar, useTheme } from "@mui/material";
import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCities, useCity } from "@/api/cities";
import {
    ERouteTuple,
    EStopDepartureTuple,
    EStopTuple,
    ETripTuple,
    EVehiclePosition,
    type Point,
    type RouteTuple,
    type StopDepartureTuple,
    type StopTuple,
    type StopTupleDetailed,
    type VehiclePosition,
    type VehiclePositionDetailed,
} from "@/api/types";
import { installImageGenerator } from "@/components/map/canvasImages";
import { FilterDialog, type MapFilter } from "@/components/map/FilterDialog";
import { useMapFeatures, useVehicleExtras, useViewport, useWatchedVehicles, useWstVehicles } from "@/components/map/hooks";
import { LayersDialog } from "@/components/map/LayersDialog";
import { MapControls } from "@/components/map/MapControls";
import { attributionFor, mapStyleFor, normalizeTileLayer } from "@/components/map/mapStyle";
import { MapLoadingOverlay, MapLogo } from "@/components/map/MapLogo";
import { showToast, ToastHost } from "@/components/map/Toasts";
import { openSse } from "@/components/map/sse";
import { StopLayer, STOPS_ZOOM, type TripOverlayData } from "@/components/map/StopLayer";
import { StopSheet } from "@/components/map/StopSheet";
import { VehicleLayer } from "@/components/map/VehicleLayer";
import { TripSheet } from "@/components/trip/TripSheet";
import { useTripLive, type TripLiveState } from "@/components/trip/useTripLive";
import { VehicleSheet } from "@/components/vehicle/VehicleSheet";
import { decodePolyline6, formatTime } from "@/lib/transit";
import { wstExecutionVehicleId, wstTripExecutionId } from "@/api/wst";
import { vehicleTypeName } from "@/components/departures/VehicleTypeIcon";
import { stopEtaPopup, stopNamePopup, stopTimePopup } from "@/components/map/popups";
import { useFavourites } from "@/store/favourites";
import { useSettings } from "@/store/settings";

const DEFAULT_ZOOM = 15;
const FOLLOW_ZOOM = 15;
const ZOOM_HINT_KEY = "czynalive:map:zoomHintDismissed";
const IS_MOBILE = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);

// `lines=` accepts route ids and the czynaczas `<routeType>/<routeId>` form.
const parseLines = (value: string | null) =>
    (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.match(/^\d+\/(.+)$/)?.[1] ?? item);

const tripOverlay = (live: TripLiveState): TripOverlayData | null => {
    const itinerary = live.itinerary;
    const route = live.trip?.[ETripTuple.route];
    if (!itinerary || !route) return null;
    const shape = decodePolyline6(itinerary[1]);
    if (shape.length < 2) return null;
    const stops = itinerary[0].map(([stop]) => ({ id: stop[EStopTuple.stopId], name: stop[EStopTuple.stopName], location: stop[EStopTuple.location] }));
    return { shape, typeName: vehicleTypeName(route[ERouteTuple.routeType]), stops };
};

const shapeBounds = (shape: Point[]) => {
    const bounds = new maplibregl.LngLatBounds(shape[0], shape[0]);
    for (const point of shape) bounds.extend(point);
    return bounds;
};

export default function MapPage() {
    const { t } = useTranslation();
    const { city = "" } = useParams();
    const cityInfo = useCity(city);
    const { byId } = useCities();
    const [settings, setSettings] = useSettings();
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const dark = useTheme().palette.mode === "dark";
    const rootRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<maplibregl.Map | null>(null);
    const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
    const vehicleLayerRef = useRef<VehicleLayer | null>(null);
    const stopLayerRef = useRef<StopLayer | null>(null);
    const [zoom, setZoom] = useState(DEFAULT_ZOOM);
    const [filterOpen, setFilterOpen] = useState(false);
    const [layersOpen, setLayersOpen] = useState(false);
    const [favouritesMode, setFavouritesMode] = useState(false);
    const [vehicleFilter, setVehicleFilter] = useState<string[]>([]);
    const setToast = (value: { text: string; action?: { label: string; run: () => void } } | null) => {
        if (!value) return;
        const action = value.action;
        showToast(value.text, {
            key: value.text,
            action: action
                ? (close) => (
                      <Button
                          size="small"
                          sx={{ color: "var(--white)" }}
                          onClick={() => {
                              action.run();
                              close();
                          }}
                      >
                          {action.label}
                      </Button>
                  )
                : undefined,
        });
    };
    const [sheet, setSheet] = useState<{ px: number; side: boolean }>({
        px: 0,
        side: false,
    });
    const [follow, setFollow] = useState(true);
    const [geo, setGeo] = useState<{
        position: Point | null;
        watching: boolean;
        waiting: boolean;
    }>({ position: null, watching: false, waiting: false });
    const [selectedStop, setSelectedStop] = useState<StopTupleDetailed | null>(null);
    const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(null);
    const { favourites } = useFavourites(city);
    const [showStops, setShowStopsState] = useState(() => {
        try {
            return localStorage.getItem(`czynalive:${city}.show.stops`) !== "false";
        } catch {
            return true;
        }
    });
    const setShowStops = (value: boolean) => {
        setShowStopsState(value);
        try {
            localStorage.setItem(`czynalive:${city}.show.stops`, String(value));
        } catch {}
    };

    const stopId = params.get("przystanek");
    const linkedWstStopIds = params.get("wst")?.split(",").filter(Boolean) ?? [];
    const vehicleId = params.get("pojazd");
    const tripId = vehicleId ? null : params.get("kurs");
    const entityCity = params.get("miasto") || city;
    const backUrl = params.get("backurl");
    const hasBack = !!backUrl || !!(location.state as { fromSheet?: boolean } | null)?.fromSheet;
    const tileLayer = normalizeTileLayer(settings.mapStyle);

    const savedFilter = settings.mapFilters[city] ?? {
        routes: [],
        vehicleTypes: [],
    };
    const filter: MapFilter = favouritesMode
        ? {
              routes: favourites.routes.map((route) => route.id),
              vehicleTypes: [],
              vehicles: favourites.vehicles.map((vehicle) => vehicle.id),
          }
        : {
              routes: savedFilter.routes,
              vehicleTypes: savedFilter.vehicleTypes,
              vehicles: vehicleFilter,
          };
    const filterActive = !favouritesMode && (filter.routes.length > 0 || filter.vehicleTypes.length > 0 || filter.vehicles.length > 0);

    // Deep link filters: ?lines=a,b&vehicles=x,y (applied once, then dropped from the URL).
    useEffect(() => {
        const lines = parseLines(params.get("lines"));
        const vehicles = (params.get("vehicles") ?? "").split(",").filter(Boolean);
        if (!lines.length && !vehicles.length) return;
        if (lines.length)
            setSettings((prev) => ({
                mapFilters: {
                    ...prev.mapFilters,
                    [city]: { routes: lines, vehicleTypes: [] },
                },
            }));
        setVehicleFilter(vehicles);
        setFavouritesMode(false);
        const next = new URLSearchParams(params);
        next.delete("lines");
        next.delete("vehicles");
        setParams(next, { replace: true });
    }, [params.get("lines"), params.get("vehicles")]);

    useEffect(() => {
        document.title = `${t("map.pageTitle")} ${cityInfo?.name ?? ""} - Czynalive`;
    }, [cityInfo?.name]);

    // Map instance.
    useEffect(() => {
        if (!containerRef.current || !cityInfo) return;
        const urlZoom = Number(params.get("z"));
        const urlLat = Number(params.get("lat"));
        const urlLng = Number(params.get("lng"));
        let view: [number, number, number];
        if (params.get("z") && params.get("lat") && params.get("lng") && [urlZoom, urlLat, urlLng].every(Number.isFinite)) view = [urlLng, urlLat, urlZoom];
        else if (settings.useLastMapLocation && settings.lastMapLocations[city]) view = settings.lastMapLocations[city];
        else if (settings.startLocations[city]) view = settings.startLocations[city];
        else view = [cityInfo.location[0], cityInfo.location[1], DEFAULT_ZOOM];

        const instance = new maplibregl.Map({
            container: containerRef.current,
            style: mapStyleFor(tileLayer, dark),
            center: [view[0], view[1]],
            zoom: view[2],
            maxZoom: 20,
            fadeDuration: 0,
            attributionControl: false,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
            maxPitch: 0,
        });
        instance.touchZoomRotate.disableRotation();
        instance.keyboard.disableRotation();
        installImageGenerator(instance);
        instance.once("load", () => setMap(instance));
        setMapInstance(instance);
        instance.on("zoomend", () => setZoom(instance.getZoom()));
        setZoom(view[2]);

        let saveTimer: ReturnType<typeof setTimeout> | undefined;
        const saveView = () => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                const center = instance.getCenter();
                const value: [number, number, number] = [+center.lng.toFixed(5), +center.lat.toFixed(5), Math.round(instance.getZoom() * 100) / 100];
                setSettings((prev) => ({
                    lastMapLocations: { ...prev.lastMapLocations, [city]: value },
                }));
                const search = new URLSearchParams(window.location.search);
                if (!search.get("przystanek") && !search.get("pojazd") && !search.get("kurs")) {
                    search.set("z", String(value[2]));
                    search.set("lat", String(value[1]));
                    search.set("lng", String(value[0]));
                    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${search}`);
                }
            }, 800);
        };
        instance.on("moveend", saveView);
        return () => {
            clearTimeout(saveTimer);
            vehicleLayerRef.current?.destroy();
            stopLayerRef.current?.destroy();
            vehicleLayerRef.current = null;
            stopLayerRef.current = null;
            setMap(null);
            setMapInstance(null);
            instance.remove();
        };
    }, [city, !!cityInfo]);

    // Base layer / theme switch.
    const styleKey = useRef(`${tileLayer}:${dark}`);
    useEffect(() => {
        if (!map) return;
        const key = `${tileLayer}:${dark}`;
        if (styleKey.current === key) return;
        styleKey.current = key;
        map.setStyle(mapStyleFor(tileLayer, dark));
    }, [map, tileLayer, dark]);

    useEffect(() => {
        if (!map) return;
        const control = new maplibregl.AttributionControl({
            compact: false,
            customAttribution: attributionFor(tileLayer),
        });
        map.addControl(control, "bottom-left");
        return () => {
            if (map.hasControl(control)) map.removeControl(control);
        };
    }, [map, tileLayer]);

    const openEntity = useCallback(
        (key: "przystanek" | "pojazd" | "kurs", id: string, targetCity: string, fromSheet: boolean, linkedWstIds: string[] = []) => {
            const next = new URLSearchParams();
            next.set(key, id);
            if (key === "przystanek" && linkedWstIds.length) next.set("wst", linkedWstIds.join(","));
            if (targetCity !== city) next.set("miasto", targetCity);
            navigate(
                { pathname: `/${city}`, search: `?${next}` },
                {
                    state: fromSheet ? { fromSheet: true } : null,
                    replace: !fromSheet && !!(stopId || vehicleId || tripId),
                },
            );
        },
        [city, navigate, stopId, vehicleId, tripId],
    );
    const openEntityRef = useRef(openEntity);
    const navigateRef = useRef(navigate);
    navigateRef.current = navigate;
    openEntityRef.current = openEntity;

    const closeSheet = () => {
        setFollow(true);
        navigate({ pathname: `/${city}`, search: "" }, { replace: true });
    };
    const goBack = () => {
        if (backUrl && backUrl.startsWith("/")) navigate(backUrl);
        else navigate(-1);
    };

    // Layers + click handling.
    useEffect(() => {
        if (!map) return;
        const stopLayer = new StopLayer(map);
        const vehicleLayer = new VehicleLayer(map, (vehicle) =>
            openEntityRef.current("pojazd", vehicle[EVehiclePosition.id], vehicle[EVehiclePosition.city], false),
        );
        stopLayerRef.current = stopLayer;
        vehicleLayerRef.current = vehicleLayer;

        const onClick = (event: maplibregl.MapMouseEvent) => {
            const radius = 12;
            const box: [maplibregl.PointLike, maplibregl.PointLike] = [
                [event.point.x - radius, event.point.y - radius],
                [event.point.x + radius, event.point.y + radius],
            ];
            const layers = ["cnc-vehicles-shape", "cnc-vehicles-label", "cnc-vehicles-dots", "cnc-stops", "cnc-cities"].filter((id) => map.getLayer(id));
            const features = map.queryRenderedFeatures(box, { layers });
            const pill = features.find((feature) => feature.layer.id === "cnc-cities");
            if (pill) {
                if (pill.properties.id === city) return map.flyTo({ center: (pill.geometry as GeoJsonPoint).coordinates as [number, number], zoom: 12 });
                return navigateRef.current(`/${pill.properties.id}`);
            }
            const vehicle = features.find((feature) => feature.layer.id.startsWith("cnc-vehicles") && feature.properties.tier === "small");
            if (vehicle) return openEntityRef.current("pojazd", vehicle.properties.id, vehicle.properties.city, false);
            const dot = features.find((feature) => feature.layer.id === "cnc-vehicles-dots");
            if (dot) {
                const coordinates = (dot.geometry as GeoJsonPoint).coordinates as [number, number];
                return setToast({
                    text: t("map.zoomInToChooseVehicle"),
                    action: {
                        label: t("global.zoomIn"),
                        run: () => map.flyTo({ center: coordinates, zoom: 15 }),
                    },
                });
            }
            const stop = features.find((feature) => feature.layer.id === "cnc-stops");
            if (stop) openEntityRef.current("przystanek", stop.properties.id, stop.properties.city || city, false, String(stop.properties.wstStopIds ?? "").split(",").filter(Boolean));
        };
        const onMouseMove = (event: maplibregl.MapMouseEvent) => {
            const layers = ["cnc-vehicles-shape", "cnc-vehicles-dots", "cnc-stops"].filter((id) => map.getLayer(id));
            const hit = map.queryRenderedFeatures(
                [
                    [event.point.x - 8, event.point.y - 8],
                    [event.point.x + 8, event.point.y + 8],
                ],
                { layers },
            );
            map.getCanvas().style.cursor = hit.length ? "pointer" : "";
        };
        const onDragStart = () => setFollow(false);
        map.on("click", onClick);
        map.on("mousemove", onMouseMove);
        map.on("dragstart", onDragStart);
        return () => {
            map.off("click", onClick);
            map.off("mousemove", onMouseMove);
            map.off("dragstart", onDragStart);
            vehicleLayer.destroy();
            stopLayer.destroy();
            vehicleLayerRef.current = null;
            stopLayerRef.current = null;
        };
    }, [map]);

    // Data.
    const viewport = useViewport(map);
    const [stopDeparture, setStopDeparture] = useState<StopDepartureTuple | null>(null);
    const selectionActive = !!vehicleId || !!tripId || !!stopId;
    const features = useMapFeatures(city, viewport, filter.routes, !selectionActive && filter.vehicles.length === 0);
    const watched = useWatchedVehicles(city, selectionActive ? [] : filter.vehicles);
    const extras = useVehicleExtras(city, settings.colorByDelay);
    const vehicleLive = useTripLive("vehicle", entityCity, vehicleId);
    const tripLive = useTripLive("trip", entityCity, tripId);
    const live = vehicleId ? vehicleLive : tripLive;
    // WST departures carry no vehicle tuple, so the highlighted stop-board row
    // fetches its execution live state to show the bus and its GTFS route.
    const stopExecutionId = stopId && stopDeparture ? wstTripExecutionId(stopDeparture[EStopDepartureTuple.trip]) : undefined;
    const stopExecutionLive = useTripLive("vehicle", "krakow", stopExecutionId ? wstExecutionVehicleId(stopExecutionId) : null);
    const stopVehicle = stopId ? (stopDeparture?.[EStopDepartureTuple.vehicle] ?? stopExecutionLive.position ?? null) : null;
    // Wieliczka (WST) buses run on the Kraków map but not in its live stream, so
    // poll them separately and merge them with the regular vehicles.
    const wstVehicles = useWstVehicles(city === "krakow");

    const delays = useMemo(() => {
        const result: Record<string, number | null> = {};
        for (const [id, [delay]] of Object.entries(extras)) result[id] = delay;
        if (vehicleId && vehicleLive.stops && vehicleLive.sequence !== undefined) {
            const point = vehicleLive.stops[Math.min(vehicleLive.sequence, vehicleLive.stops.length - 1)]?.[1];
            if (point && point[2] !== 0) result[vehicleId] = point[1];
        }
        return result;
    }, [extras, vehicleId, vehicleLive.stops, vehicleLive.sequence]);

    const visibleVehicles: VehiclePosition[] = useMemo(() => {
        if (vehicleId) return vehicleLive.position ? [vehicleLive.position as VehiclePosition] : [];
        if (tripId) return [];
        if (stopId) return stopVehicle ? [stopVehicle as VehiclePosition] : [];
        const wst = filter.routes.length ? wstVehicles.filter((vehicle) => filter.routes.includes(vehicle[EVehiclePosition.route][ERouteTuple.routeId])) : wstVehicles;
        const source = filter.vehicles.length ? watched : [...features.positions, ...wst];
        if (!filter.vehicleTypes.length) return source;
        return source.filter((vehicle) => filter.vehicleTypes.includes(vehicle[EVehiclePosition.route][ERouteTuple.routeType]));
    }, [
        vehicleId,
        tripId,
        stopId,
        stopVehicle,
        vehicleLive.position,
        tripLive.position,
        features.positions,
        watched,
        wstVehicles,
        filter.vehicleTypes.join(","),
        filter.routes.join(","),
        filter.vehicles.length,
    ]);

    const dots = selectionActive || filter.vehicles.length || filter.vehicleTypes.length ? [] : features.dots;
    const markerOptions = {
        showBrigade: settings.markerShowBrigade,
        showVehicleNo: settings.markerShowVehicleNo,
        colorByDelay: settings.colorByDelay,
        dark,
        delays,
        focused: selectionActive || filterActive,
    };

    useEffect(() => {
        vehicleLayerRef.current?.update(visibleVehicles, dots, markerOptions);
    }, [map, visibleVehicles, dots]);

    useEffect(() => {
        vehicleLayerRef.current?.setOptions(markerOptions);
        stopLayerRef.current?.refresh();
    }, [settings.markerShowBrigade, settings.markerShowVehicleNo, settings.colorByDelay, dark, delays, selectionActive || filterActive]);

    // Stops and trip overlay.
    const overlay = useMemo(() => {
        if (!selectionActive) return null;
        if (vehicleId || tripId) return tripOverlay(live);
        if (stopId) return tripOverlay(stopExecutionLive);
        return null;
    }, [selectionActive, vehicleId, tripId, live, stopId, stopExecutionLive]);

    // Highlighted stop of the drawer's list and its popup on the map.
    const [activeStop, setActiveStop] = useState(0);
    useEffect(() => setActiveStop(vehicleId ? (vehicleLive.sequence ?? 0) : 0), [vehicleId, tripId, vehicleId ? vehicleLive.sequence : 0]);
    useEffect(() => {
        const layer = stopLayerRef.current;
        if (!layer) return;
        layer.onTripStopClick = (index) => {
            setFollow(false);
            setActiveStop(index);
        };
        const stop = live.itinerary?.[0]?.[activeStop]?.[0];
        if (!overlay || !stop || zoom < 12) return layer.setPopup(null);
        const name = stop[EStopTuple.stopName];
        const times = live.stops?.[activeStop];
        const isLast = activeStop === (live.itinerary?.[0].length ?? 0) - 1;
        const point = times ? (isLast ? times[0] : times[1]) : undefined;
        let html = stopNamePopup(name);
        if (tripId && point) html = stopTimePopup(name, formatTime(point[0]));
        else if (vehicleId && point && activeStop >= (live.sequence ?? 0)) {
            const delayed = point[0] + point[1];
            html = stopEtaPopup(
                name,
                {
                    depTime: formatTime(point[0]),
                    delayedDepTime: formatTime(delayed),
                    diffDelayed: point[1] / 60000,
                    minRemaining: Math.floor((delayed - Date.now()) / 60000),
                },
                t,
            );
        }
        layer.setPopup(stop[EStopTuple.location], html);
    }, [map, overlay, activeStop, live.stops, live.sequence, zoom >= 12]);

    useEffect(() => {
        const stopLayer = stopLayerRef.current;
        if (!stopLayer) return;
        if (stopId) {
            stopLayer.setStops(selectedStop ? [selectedStop.slice(0, 7) as StopTuple] : [], true);
            return;
        }
        stopLayer.setStops(features.stops, !overlay && showStops && zoom >= STOPS_ZOOM);
    }, [map, features.stops, overlay, zoom >= STOPS_ZOOM, selectedStop, stopId, showStops]);

    useEffect(() => {
        stopLayerRef.current?.setTrip(overlay);
    }, [map, overlay]);

    const cityPills = useMemo(
        () =>
            Object.values(byId ?? {})
                .filter((entry) => !entry.virtual)
                .map((entry) => ({ id: entry.id, name: entry.name, location: entry.location as Point })),
        [byId],
    );
    useEffect(() => {
        stopLayerRef.current?.setCities(cityPills, zoom <= 9 && !selectionActive && !filterActive && !favouritesMode);
    }, [map, cityPills, zoom <= 9, selectionActive, filterActive, favouritesMode, dark]);

    useEffect(() => {
        stopLayerRef.current?.setHighlighted(stopId);
        if (!stopId) setSelectedStop(null);
    }, [map, stopId]);

    // Camera.
    const followTarget = useRef<Point | null>(null);
    useEffect(() => {
        if (!map) return;
        const padding = sheet.side ? { top: 0, bottom: 0, left: sheet.px, right: 0 } : { top: 0, bottom: sheet.px, left: 0, right: 0 };
        map.setPadding(padding);
        const target = followTarget.current;
        if (target) map.easeTo({ center: target, duration: 300 });
        rootRef.current?.style.setProperty("--map-pad-bottom", sheet.side ? "0px" : `${sheet.px}px`);
    }, [map, sheet.px, sheet.side]);

    const lastCentered = useRef<string | null>(null);
    followTarget.current = vehicleId && follow && vehicleLive.position ? vehicleLive.position[EVehiclePosition.location] : null;
    useEffect(() => {
        if (!map || !vehicleId) {
            lastCentered.current = null;
            return;
        }
        const position = vehicleLive.position;
        if (!position) return;
        const target = position[EVehiclePosition.location];
        if (lastCentered.current !== vehicleId) {
            lastCentered.current = vehicleId;
            setFollow(true);
            map.flyTo({
                center: target,
                zoom: Math.max(map.getZoom(), FOLLOW_ZOOM),
                duration: 800,
            });
        } else if (follow) {
            map.easeTo({ center: target, duration: 900 });
        }
    }, [map, vehicleId, vehicleLive.position, follow]);

    const fittedTrip = useRef<string | null>(null);
    const fitTrip = useCallback(() => {
        if (!map || !overlay) return;
        setFollow(false);
        map.fitBounds(shapeBounds(overlay.shape), {
            padding: 70,
            maxZoom: 16,
            duration: 250,
        });
    }, [map, overlay]);
    useEffect(() => {
        if (!tripId) {
            fittedTrip.current = null;
            return;
        }
        if (overlay && fittedTrip.current !== tripId) {
            fittedTrip.current = tripId;
            fitTrip();
        }
    }, [tripId, overlay]);

    // Stop drawer: the stop and the vehicle of the highlighted departure, framed together.
    const locateStop = useCallback((stop: StopTupleDetailed) => setSelectedStop(stop), []);
    const stopVehicleKey = stopVehicle ? stopVehicle[EVehiclePosition.id] : "";
    useEffect(() => {
        if (!map || !selectedStop || !stopId) return;
        const stopPoint = selectedStop[EStopTuple.location];
        if (!stopVehicle) {
            map.easeTo({ center: stopPoint, duration: 250 });
            return;
        }
        const bounds = new maplibregl.LngLatBounds(stopPoint, stopPoint).extend(stopVehicle[EVehiclePosition.location]);
        map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 250 });
    }, [map, selectedStop, stopId, stopVehicleKey]);

    // Geolocation.
    const geoWatch = useRef<number | null>(null);
    const geoMarker = useRef<maplibregl.Marker | null>(null);
    const locate = () => {
        if (geo.position && map) {
            map.flyTo({ center: geo.position, zoom: Math.max(map.getZoom(), 16) });
            return;
        }
        if (!navigator.geolocation) return setToast({ text: t("map.locationNotFoundPart1") });
        setGeo((prev) => ({ ...prev, waiting: true }));
        let first = true;
        geoWatch.current = navigator.geolocation.watchPosition(
            (result) => {
                const point: Point = [result.coords.longitude, result.coords.latitude];
                setGeo({ position: point, watching: true, waiting: false });
                if (first && map) map.flyTo({ center: point, zoom: Math.max(map.getZoom(), 16) });
                first = false;
            },
            () => {
                setGeo({ position: null, watching: false, waiting: false });
                setToast({
                    text: `${t("map.locationNotFoundPart1")} ${t("map.locationNotFoundPart3")}`,
                });
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
        );
    };
    useEffect(
        () => () => {
            if (geoWatch.current !== null) navigator.geolocation.clearWatch(geoWatch.current);
        },
        [],
    );
    useEffect(() => {
        if (!map || !geo.position) return;
        if (!geoMarker.current) {
            const element = document.createElement("div");
            element.className = "geo-location-marker";
            element.title = t("map.yourLocation");
            element.innerHTML =
                '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="rgba(19,106,236,0.25)"/><circle cx="12" cy="12" r="6.5" fill="var(--location-color)" stroke="#fff" stroke-width="2.5"/></svg>';
            geoMarker.current = new maplibregl.Marker({ element }).setLngLat(geo.position).addTo(map);
        } else geoMarker.current.setLngLat(geo.position);
    }, [map, geo.position]);
    useEffect(
        () => () => {
            geoMarker.current?.remove();
            geoMarker.current = null;
        },
        [map],
    );

    // Hints.
    useEffect(() => {
        if (features.error) setToast({ text: t("map.couldNotConnectToServer") });
    }, [features.error]);
    // One reminder per visit that the map shows a subset (filter / hidden stops / favourites).
    const cautionShown = useRef(false);
    useEffect(() => {
        if (cautionShown.current || selectionActive) return;
        if (filterActive || !showStops) {
            cautionShown.current = true;
            setToast({
                text: t("map.cautionFilteringTurnedOn"),
                action: {
                    label: t("global.reset"),
                    run: () => {
                        resetFilter();
                        setShowStops(true);
                    },
                },
            });
        } else if (favouritesMode) {
            cautionShown.current = true;
            setToast({ text: t("map.cautionFavouritesTurnedOn") });
        }
    }, [filterActive, showStops, favouritesMode]);

    // "Przybliż mapę…" after the user zooms out below the detail threshold (11 on phones, 10 elsewhere).
    const hintBlocked = useRef(false);
    hintBlocked.current = selectionActive || filterActive;
    useEffect(() => {
        if (!map) return;
        const onZoomEnd = () => {
            if (map.getZoom() >= (IS_MOBILE ? 11 : 10) || hintBlocked.current) return;
            try {
                if (localStorage.getItem(ZOOM_HINT_KEY)) return;
            } catch {}
            setToast({
                text: t("map.zoomInMapForDetails"),
                action: {
                    label: t("global.dontShowAgain"),
                    run: () => {
                        try {
                            localStorage.setItem(ZOOM_HINT_KEY, "1");
                        } catch {}
                    },
                },
            });
        };
        map.on("zoomend", onZoomEnd);
        return () => {
            map.off("zoomend", onZoomEnd);
        };
    }, [map]);
    useEffect(() => {
        if (vehicleLive.fatal === "POSITION_NOT_FOUND" && vehicleId) setToast({ text: t("map.signalGpsLost") });
    }, [vehicleLive.fatal]);

    const suggested = features.suggestedCity && features.suggestedCity !== dismissedSuggestion ? byId[features.suggestedCity] : undefined;

    // Saving the filter frames every matching vehicle of the city and says how many there are.
    const applyFilter = (value: MapFilter, stopsVisible = showStops) => {
        setFavouritesMode(false);
        setShowStops(stopsVisible);
        setSettings((prev) => ({
            mapFilters: {
                ...prev.mapFilters,
                [city]: { routes: value.routes, vehicleTypes: value.vehicleTypes },
            },
        }));
        setVehicleFilter(value.vehicles);
        if (!value.routes.length) return;
        const handle = openSse<unknown, { positions: VehiclePosition[] }>(
            `/${city}/mapFeatures/0/0,0,0,0/stream`,
            { graph: 1, filterRoutes: value.routes.join(",") },
            {
                onMessage: (message) => {
                    handle.close();
                    const positions = message.positions ?? [];
                    setToast({ text: `${t("global.found")} ${t("plural.vehicle", { count: positions.length })}.` });
                    if (!map || !positions.length) return;
                    const first = positions[0][EVehiclePosition.location];
                    const bounds = new maplibregl.LngLatBounds(first, first);
                    for (const position of positions) bounds.extend(position[EVehiclePosition.location]);
                    setTimeout(() => map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 250 }), 300);
                },
            },
        );
    };
    const resetFilter = () => {
        setFavouritesMode(false);
        setVehicleFilter([]);
        setSettings((prev) => ({
            mapFilters: {
                ...prev.mapFilters,
                [city]: { routes: [], vehicleTypes: [] },
            },
        }));
    };
    const showRoute = (route: RouteTuple) => {
        applyFilter({
            routes: [route[ERouteTuple.routeId]],
            vehicleTypes: [],
            vehicles: [],
        });
        map?.easeTo({ zoom: Math.min(map.getZoom(), 12) });
    };

    const center = map?.getCenter();

    // The drawer is fixed over the whole app; the map only needs the part it hides.
    const sheetHeight = useCallback((visiblePx: number) => {
        const bottom = rootRef.current?.getBoundingClientRect().bottom ?? window.innerHeight;
        setSheet({
            px: visiblePx ? Math.max(0, Math.round(bottom - (window.innerHeight - visiblePx))) : 0,
            side: false,
        });
    }, []);
    const focusPoint = useCallback(
        (point: Point) => {
            setFollow(false);
            map?.easeTo({ center: point, zoom: 14, duration: 500 });
        },
        [map],
    );

    return (
        <Box ref={rootRef} className="noselect mapgl-map" sx={{ position: "relative", width: "100%", height: "100%" }}>
            <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
            {mapInstance && (
                <>
                    <MapLogo bottom={selectionActive ? 0 : 1} />
                    <MapControls
                        map={mapInstance}
                        showBar={!selectionActive && !stopId}
                        filterActive={filterActive || !showStops}
                        favouritesActive={favouritesMode}
                        located={!!geo.position}
                        locating={geo.waiting}
                        onFilter={() => setFilterOpen(true)}
                        onLayers={() => setLayersOpen(true)}
                        onFavourites={() => {
                            if (!favourites.routes.length && !favourites.vehicles.length) {
                                setFavouritesMode(false);
                                return setToast({ text: t("map.noFavouritesAddThem") });
                            }
                            setFavouritesMode((value) => !value);
                        }}
                        onLocate={locate}
                    />
                </>
            )}

            {stopId && !vehicleId && !tripId && (
                <StopSheet
                    city={city}
                    stopCity={entityCity}
                    stopId={stopId}
                    linkedWstStopIds={linkedWstStopIds}
                    hasBack={hasBack}
                    onClose={closeSheet}
                    onBack={goBack}
                    onLocate={locateStop}
                    onDepartureActive={setStopDeparture}
                    onHeightChange={sheetHeight}
                />
            )}
            {vehicleId && (
                <VehicleSheet
                    city={city}
                    vehicleId={vehicleId}
                    live={vehicleLive}
                    hasBack={hasBack}
                    onClose={closeSheet}
                    onBack={goBack}
                    onFitTrip={fitTrip}
                    onFollow={() => {
                        setFollow(true);
                        if (vehicleLive.position)
                            map?.flyTo({
                                center: vehicleLive.position[EVehiclePosition.location],
                                zoom: Math.max(map.getZoom(), FOLLOW_ZOOM),
                            });
                    }}
                    activeStop={activeStop}
                    onStopSelect={(index, point) => {
                        setActiveStop(index);
                        focusPoint(point);
                    }}
                    onTripClick={(ref, targetCity) => openEntity("kurs", ref, targetCity, true)}
                    onHeightChange={sheetHeight}
                />
            )}
            {tripId && (
                <TripSheet
                    city={city}
                    tripId={tripId}
                    live={tripLive}
                    hasBack={hasBack}
                    onClose={closeSheet}
                    onBack={goBack}
                    onFitTrip={fitTrip}
                    activeStop={activeStop}
                    onStopSelect={(index, point) => {
                        setActiveStop(index);
                        focusPoint(point);
                    }}
                    onHeightChange={sheetHeight}
                />
            )}

            <FilterDialog
                open={filterOpen}
                city={city}
                value={filter}
                onClose={() => setFilterOpen(false)}
                showStops={showStops}
                onApply={applyFilter}
                onReset={() => {
                    resetFilter();
                    setShowStops(true);
                }}
                onToast={(text) => setToast({ text })}
            />
            {layersOpen && (
                <LayersDialog
                    open={layersOpen}
                    onClose={() => setLayersOpen(false)}
                    center={center ? [center.lng, center.lat] : (cityInfo?.location ?? [21, 52])}
                    zoom={zoom}
                    dark={dark}
                />
            )}
            {(!map || (features.loading && !features.positions.length && !selectionActive && filter.vehicles.length === 0)) && <MapLoadingOverlay />}
            <ToastHost />
            <Snackbar
                open={!!suggested && !selectionActive && !stopId}
                message={`${t("map.changeCityPart2")} ${suggested?.name ?? ""}?`}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                sx={{ bottom: "90px !important" }}
                action={
                    <>
                        <Button size="small" sx={{ color: "var(--white)" }} onClick={() => setDismissedSuggestion(features.suggestedCity ?? null)}>
                            {t("global.close")}
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                                const target = map?.getCenter();
                                const zoomNow = map?.getZoom();
                                navigate(`/${suggested!.id}${target ? `?z=${zoomNow}&lat=${target.lat}&lng=${target.lng}` : ""}`);
                            }}
                        >
                            {t("map.changeCityPart3")} {suggested?.name}
                        </Button>
                    </>
                }
            />
        </Box>
    );
}
