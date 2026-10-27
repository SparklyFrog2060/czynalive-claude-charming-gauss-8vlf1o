import type { Feature, FeatureCollection } from "geojson";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import { EStopTuple, type Point, type StopTuple } from "@/api/types";
import { getMergedWstStopIds } from "@/api/wst";
import { cityPillId, stopArrowId, stopIconId, tripDashId } from "./canvasImages";
import { typeClass } from "./icons";

const STOPS = "cnc-stops";
const ARROWS = "cnc-stop-arrows";
const TRIP_LINE = "cnc-trip-line";
const CITIES = "cnc-cities";

export const STOPS_ZOOM = 14;

const collection = (features: Feature[] = []): FeatureCollection => ({ type: "FeatureCollection", features });

// czynaczas paints a split icon only for these type combinations (bus half + the other mode).
const SPLIT_STOPS: Record<string, string> = { "3-11": "trolleybus", "0-3": "tram", "2-3": "train" };

const stopColors = (stop: StopTuple) => {
    const types = stop[EStopTuple.vehicleTypes];
    const split = types.length > 1 ? SPLIT_STOPS[types.join("-")] : undefined;
    if (split) return ["--bus", `--${split}`];
    return [`--${typeClass(types[0] ?? 3)}`];
};

export type TripOverlayData = {
    shape: Point[];
    typeName: string;
    stops: { id: string; name: string; location: Point }[];
};

// Stops (canvas stop-board icons + bearing arrows) and the selected trip's shape.
export class StopLayer {
    private stops: StopTuple[] = [];
    private trip: TripOverlayData | null = null;
    private tripMarkers: maplibregl.Marker[] = [];
    private tripMarkersKey = "";
    private popup: maplibregl.Popup | null = null;
    onTripStopClick: ((index: number) => void) | null = null;
    private highlighted: string | null = null;
    private visible = true;

    constructor(private map: MapLibreMap) {
        this.install();
        map.on("style.load", this.install);
        map.on("zoomend", this.toggleTripMarkers);
    }

    destroy() {
        this.map.off("style.load", this.install);
        this.map.off("zoomend", this.toggleTripMarkers);
        for (const marker of this.tripMarkers) marker.remove();
        this.tripMarkers = [];
        this.popup?.remove();
    }

    private toggleTripMarkers = () => {
        const hidden = this.map.getZoom() < 12;
        for (const marker of this.tripMarkers) marker.getElement().style.display = hidden ? "none" : "";
    };

    // Numbered DOM markers of the selected trip (czynaczas `stop_marker`).
    private renderTripStops() {
        const trip = this.trip;
        const key = trip ? `${trip.typeName}:${trip.stops.map((stop) => stop.id).join(",")}` : "";
        if (key === this.tripMarkersKey) return;
        this.tripMarkersKey = key;
        for (const marker of this.tripMarkers) marker.remove();
        this.tripMarkers = [];
        if (!trip) return;
        trip.stops.forEach((stop, index) => {
            const element = document.createElement("div");
            element.className = "mapgl-icon-none stop-icon";
            element.innerHTML = `<button class="stop_marker bg-${trip.typeName} text-white" type="button"><span style="display: flex;place-items:center;"><strong>${index + 1}</strong></span></button>`;
            element.addEventListener("click", (event) => {
                event.stopPropagation();
                event.preventDefault();
                this.onTripStopClick?.(index);
            });
            this.tripMarkers.push(new maplibregl.Marker({ element, anchor: "top", offset: [0, -12] }).setLngLat(stop.location).addTo(this.map));
        });
        this.toggleTripMarkers();
    }

    setPopup(location: Point | null, html = "") {
        this.popup?.remove();
        this.popup = null;
        if (!location) return;
        this.popup = new maplibregl.Popup({ closeOnClick: true, offset: 12, focusAfterOpen: false }).setLngLat(location).setHTML(html).addTo(this.map);
    }

    private install = () => {
        const map = this.map;
        if (map.getSource(STOPS)) return;
        map.addSource(TRIP_LINE, { type: "geojson", data: collection() });
        map.addSource(STOPS, { type: "geojson", data: collection() });
        map.addSource(ARROWS, { type: "geojson", data: collection() });
        map.addSource(CITIES, { type: "geojson", data: collection() });
        map.addLayer({
            id: "cnc-trip-line",
            type: "line",
            source: TRIP_LINE,
            layout: { "line-cap": "butt", "line-join": "round" },
            paint: { "line-width": 4, "line-pattern": ["get", "pattern"] },
        });
        map.addLayer({
            id: "cnc-stop-arrows",
            type: "symbol",
            source: ARROWS,
            layout: {
                "icon-image": ["get", "icon"],
                "icon-rotate": ["get", "angle"],
                "icon-rotation-alignment": "map",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
            },
        });
        map.addLayer({
            id: "cnc-stops",
            type: "symbol",
            source: STOPS,
            layout: {
                "icon-image": ["get", "icon"],
                "icon-size": ["case", ["get", "highlighted"], 1.25, 1],
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
            },
        });
        map.addLayer({
            id: CITIES,
            type: "symbol",
            source: CITIES,
            layout: { "icon-image": ["get", "icon"], "icon-allow-overlap": true, "icon-ignore-placement": true },
        });
        this.render();
    };

    private cities: { id: string; name: string; location: Point }[] = [];
    private citiesVisible = false;

    // Pills of every city, shown instead of vehicles when zoomed far out.
    setCities(cities: { id: string; name: string; location: Point }[], visible: boolean) {
        this.cities = cities;
        this.citiesVisible = visible;
        this.render();
    }

    setStops(stops: StopTuple[], visible: boolean) {
        this.stops = stops;
        this.visible = visible;
        this.render();
    }

    setHighlighted(stopId: string | null) {
        this.highlighted = stopId;
        this.render();
    }

    setTrip(trip: TripOverlayData | null) {
        this.trip = trip;
        this.render();
    }

    refresh() {
        this.render();
    }

    private render = () => {
        const map = this.map;
        const stopFeatures: Feature[] = [];
        const arrowFeatures: Feature[] = [];
        if (this.visible) {
            for (const stop of this.stops) {
                const colors = stopColors(stop);
                const id = stop[EStopTuple.stopId];
                const highlighted = this.highlighted === id;
                if (this.highlighted && !highlighted && this.trip) continue;
                stopFeatures.push({
                    type: "Feature",
                    geometry: { type: "Point", coordinates: stop[EStopTuple.location] },
                    properties: { id, city: stop[EStopTuple.city], name: stop[EStopTuple.stopName], icon: stopIconId(colors), highlighted, wstStopIds: getMergedWstStopIds(stop).join(",") },
                });
                const bearing = stop[EStopTuple.bearing];
                if (bearing !== null && bearing !== undefined) {
                    arrowFeatures.push({
                        type: "Feature",
                        geometry: { type: "Point", coordinates: stop[EStopTuple.location] },
                        properties: { icon: stopArrowId(colors[0]), angle: bearing },
                    });
                }
            }
        }
        (map.getSource(STOPS) as GeoJSONSource | undefined)?.setData(collection(stopFeatures));
        (map.getSource(ARROWS) as GeoJSONSource | undefined)?.setData(collection(arrowFeatures));

        const lineFeatures: Feature[] = [];
        if (this.trip && this.trip.shape.length > 1) {
            lineFeatures.push({
                type: "Feature",
                geometry: { type: "LineString", coordinates: this.trip.shape },
                properties: { pattern: tripDashId(map, this.trip.typeName) },
            });
        }
        (map.getSource(TRIP_LINE) as GeoJSONSource | undefined)?.setData(collection(lineFeatures));
        const cityFeatures: Feature[] = this.citiesVisible
            ? this.cities.map((city) => ({ type: "Feature", geometry: { type: "Point", coordinates: city.location }, properties: { id: city.id, icon: cityPillId(map, city.id, city.name) } }))
            : [];
        (map.getSource(CITIES) as GeoJSONSource | undefined)?.setData(collection(cityFeatures));
        if (cityFeatures.length && map.getLayer(CITIES)) map.moveLayer(CITIES);
        this.renderTripStops();
    };
}
