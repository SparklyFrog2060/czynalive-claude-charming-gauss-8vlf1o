import { RouteType, type RouteTuple, ERouteTuple, StopDepartureStatus } from "@/api/types";

export type VehicleTypeInfo = { key: string; cssVar: string; name: string; plural: string; lineLabel: string };

export const VEHICLE_TYPES: Record<number, VehicleTypeInfo> = {
    [RouteType.Tram]: { key: "tram", cssVar: "var(--tram)", name: "Tramwaj", plural: "Tramwaje", lineLabel: "Linia tramwajowa" },
    [RouteType.Subway]: { key: "subway", cssVar: "var(--subway)", name: "Metro", plural: "Metro", lineLabel: "Linia metra" },
    [RouteType.Rail]: { key: "train", cssVar: "var(--train)", name: "Pociąg", plural: "Pociągi", lineLabel: "Linia kolejowa" },
    [RouteType.Bus]: { key: "bus", cssVar: "var(--bus)", name: "Autobus", plural: "Autobusy", lineLabel: "Linia autobusowa" },
    [RouteType.Ferry]: { key: "ferry", cssVar: "var(--ferry)", name: "Prom", plural: "Promy", lineLabel: "Linia promowa" },
    [RouteType.AerialLift]: { key: "bus", cssVar: "var(--ferry)", name: "Kolej linowa", plural: "Koleje linowe", lineLabel: "Kolej linowa" },
    [RouteType.Funicular]: { key: "train", cssVar: "var(--train)", name: "Kolej szynowo-linowa", plural: "Koleje szynowo-linowe", lineLabel: "Kolej szynowo-linowa" },
    [RouteType.Trolleybus]: { key: "trolleybus", cssVar: "var(--trolleybus)", name: "Trolejbus", plural: "Trolejbusy", lineLabel: "Linia trolejbusowa" },
    [RouteType.Monorail]: { key: "train", cssVar: "var(--train)", name: "Kolej jednoszynowa", plural: "Koleje jednoszynowe", lineLabel: "Kolej jednoszynowa" },
};

export const vehicleType = (type: number): VehicleTypeInfo => VEHICLE_TYPES[type] ?? VEHICLE_TYPES[RouteType.Bus];

// Realtime-only routes send their color without "#".
export const routeColor = (route: RouteTuple): string => {
    const color = route[ERouteTuple.routeColor];
    if (!color) return vehicleType(route[ERouteTuple.routeType]).cssVar;
    return color.startsWith("#") ? color : `#${color}`;
};

// Readable text color for a given background hex.
export const contrastText = (hex: string): string => {
    if (!hex.startsWith("#") || hex.length < 7) return "#fff";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? "#000" : "#fff";
};

export type DelayClass = "delayed-no-data" | "before-time" | "on-time" | "delayed-slight" | "delayed-minor" | "delayed-moderate" | "delayed-major" | "delayed-critical";

// Delay in ms -> czynaczas-style CSS class (thresholds in minutes).
export const delayClass = (delayMs: number | null | undefined, status?: StopDepartureStatus): DelayClass => {
    if (delayMs === null || delayMs === undefined || status === StopDepartureStatus.Scheduled) return "delayed-no-data";
    const minutes = delayMs / 60000;
    if (minutes <= -1) return "before-time";
    if (minutes < 2) return "on-time";
    if (minutes < 5) return "delayed-slight";
    if (minutes < 10) return "delayed-minor";
    if (minutes < 20) return "delayed-moderate";
    if (minutes < 30) return "delayed-major";
    return "delayed-critical";
};

export const delayColorVar = (cls: DelayClass) => `var(--${cls})`;

export const formatDelay = (delayMs: number): string => {
    const totalSeconds = Math.round(Math.abs(delayMs) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const sign = delayMs < 0 ? "-" : "+";
    if (minutes === 0) return `${sign}${seconds} s`;
    return `${sign}${minutes} min${seconds ? ` ${seconds} s` : ""}`;
};

export const formatDelayShort = (delayMs: number): string => {
    const minutes = Math.round(delayMs / 60000);
    if (minutes === 0) return "0 min";
    return `${minutes > 0 ? "+" : ""}${minutes} min`;
};

export const formatTime = (epochMs: number, timeZone = "Europe/Warsaw"): string =>
    new Date(epochMs).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone });

export const formatDate = (epochMs: number, timeZone = "Europe/Warsaw"): string =>
    new Date(epochMs).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone });

// Minutes until departure, "<1 min" style like czynaczas boards.
export const formatRelative = (epochMs: number, now = Date.now()): string => {
    const minutes = Math.floor((epochMs - now) / 60000);
    if (minutes < 1) return "<1 min";
    if (minutes >= 60) return formatTime(epochMs);
    return `${minutes} min`;
};

const DATE_EPOCH = Date.UTC(2020, 0, 1);
const DAY_MS = 86400000;

// Backend "date index" = days since 2020-01-01 (local service day).
export const dateIndexToDate = (index: number): Date => new Date(DATE_EPOCH + index * DAY_MS);

export const dateToDateIndex = (date: Date, timeZone = "Europe/Warsaw"): number => {
    const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
        .format(date)
        .split("-")
        .map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - DATE_EPOCH) / DAY_MS);
};

export const todayDateIndex = (timeZone = "Europe/Warsaw") => dateToDateIndex(new Date(), timeZone);

export const formatDateIndex = (index: number): string => {
    const date = dateIndexToDate(index);
    return date.toLocaleDateString("pl-PL", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
};

// Google encoded polyline, precision 1e6, lat-first -> [lon, lat][]
export const decodePolyline6 = (encoded: string): [number, number][] => {
    const points: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lon = 0;
    while (index < encoded.length) {
        for (let axis = 0; axis < 2; axis++) {
            let shift = 0;
            let result = 0;
            let byte: number;
            do {
                byte = encoded.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);
            const delta = result & 1 ? ~(result >> 1) : result >> 1;
            if (axis === 0) lat += delta;
            else lon += delta;
        }
        points.push([lon / 1e6, lat / 1e6]);
    }
    return points;
};

// Inverse of decodePolyline6: [lon, lat][] -> Google encoded polyline (precision 1e6, lat-first).
export const encodePolyline6 = (points: [number, number][]): string => {
    let lastLat = 0;
    let lastLon = 0;
    let out = "";
    const encodeValue = (value: number) => {
        let v = value < 0 ? ~(value << 1) : value << 1;
        while (v >= 0x20) {
            out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
            v >>= 5;
        }
        out += String.fromCharCode(v + 63);
    };
    for (const [lon, lat] of points) {
        const latE = Math.round(lat * 1e6);
        const lonE = Math.round(lon * 1e6);
        encodeValue(latE - lastLat);
        encodeValue(lonE - lastLon);
        lastLat = latE;
        lastLon = lonE;
    }
    return out;
};

export const haversineMeters = (a: [number, number], b: [number, number]): number => {
    const toRad = Math.PI / 180;
    const dLat = (b[1] - a[1]) * toRad;
    const dLon = (b[0] - a[0]) * toRad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(h));
};

// Vehicle id "<type>:<agency>_<number>" or "<type>:<number>".
export const parseVehicleId = (id: string): { type: number; agency: string; number: string } => {
    const [typePart, rest = ""] = id.split(":");
    const underscore = rest.indexOf("_");
    if (underscore === -1) return { type: +typePart, agency: "default", number: rest };
    return { type: +typePart, agency: rest.slice(0, underscore), number: rest.slice(underscore + 1) };
};

export const fleetUrl = (url: string) => (!url ? "" : url.startsWith("http") ? url : `https://phototrans.eu/${url}`);
