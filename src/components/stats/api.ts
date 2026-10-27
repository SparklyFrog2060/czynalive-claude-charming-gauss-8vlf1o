import { apiGet, cityGet } from "@/api/client";
import { ERouteTuple, RouteType, type RouteTuple } from "@/api/types";

// Row of GET /api6/:city/cnc/delays (backend cnc-joke.ts).
export type LiveVehicle = {
    id: string;
    vehicleNo: string;
    type: number;
    route: RouteTuple;
    brigade: string;
    headsign: string;
    delay: number | null; // s
    state: "onTrip" | "offRoute" | "noTrip";
    stop: string;
    tripId: string | null;
    timestamp: number;
};

export type LiveVehiclesResponse = { updatedAt: number; vehicles: LiveVehicle[] };

export type RankingMetrics = { count: number; avg: number; median: number };

export type DelaysRankingResponse = {
    updatedAt: number;
    cities: Record<string, { name: string; total: RankingMetrics; byType: Record<string, RankingMetrics> }>;
};

export const fetchLiveVehicles = (city: string, signal: AbortSignal) => cityGet<LiveVehiclesResponse>(city, "/cnc/delays", undefined, signal);

export const fetchDelaysRanking = (signal: AbortSignal) => apiGet<DelaysRankingResponse>("/cnc/delays-ranking", undefined, signal);

export const TYPE_TAB_ORDER = [RouteType.Tram, RouteType.Trolleybus, RouteType.Bus, RouteType.Subway, RouteType.Rail, RouteType.Ferry];

export const sortTypes = (types: Iterable<number>) =>
    [...new Set(types)].sort((a, b) => {
        const ia = TYPE_TAB_ORDER.indexOf(a);
        const ib = TYPE_TAB_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a - b;
    });

// czynaczas colour scale, integer minutes.
const DELAY_RANGES: { from: number; to: number; className: string }[] = [
    { from: -Infinity, to: -2, className: "before-time" },
    { from: -1, to: 3, className: "on-time" },
    { from: 4, to: 9, className: "delayed-slight" },
    { from: 10, to: 14, className: "delayed-minor" },
    { from: 15, to: 19, className: "delayed-moderate" },
    { from: 20, to: 24, className: "delayed-major" },
    { from: 25, to: Infinity, className: "delayed-critical" },
];

export const delayMinutesClass = (minutes: number | undefined | null) => {
    if (minutes === undefined || minutes === null) return "delayed-no-data";
    return DELAY_RANGES.find((range) => minutes >= range.from && minutes <= range.to)?.className ?? "delayed-no-data";
};

// Seconds -> whole minutes, truncated towards zero like czynaczas.
export const delayMinutes = (seconds: number) => (seconds > 0 ? Math.floor(seconds / 60) : -Math.floor(Math.abs(seconds / 60)));

const TOLERANCE: Record<string, { min: number; max: number }> = { lodz: { min: -1, max: 4 } };
export const toleranceFor = (city: string) => TOLERANCE[city] ?? { min: -1, max: 3 };

const quantile = (values: number[], q: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const position = (sorted.length - 1) * q;
    const base = Math.floor(position);
    const rest = position - base;
    return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
};

export type RouteDelay = { routeId: string; routeName: string; type: number; count: number; avgDelay: number; city: string };

export type DelayStats = {
    count: number;
    avg: number;
    median: number;
    quantile25: number;
    quantile75: number;
    quantile90: number;
    avgTop10: number;
    top10VehCount: number;
    max?: LiveVehicle;
    min?: LiveVehicle;
    inTolerance: { percentage: number; number: number };
    outTolerance: { percentage: number; number: number };
    perRoute: RouteDelay[];
};

export const computeDelayStats = (vehicles: LiveVehicle[], city: string): DelayStats => {
    const tolerance = toleranceFor(city);
    const withDelay = vehicles.filter((vehicle) => vehicle.delay !== null);
    const stats: DelayStats = {
        count: withDelay.length,
        avg: 0,
        median: 0,
        quantile25: 0,
        quantile75: 0,
        quantile90: 0,
        avgTop10: 0,
        top10VehCount: 0,
        inTolerance: { percentage: 0, number: 0 },
        outTolerance: { percentage: 0, number: 0 },
        perRoute: [],
    };
    if (withDelay.length === 0) return stats;

    const delays = withDelay.map((vehicle) => vehicle.delay!);
    const byDelay = [...withDelay].sort((a, b) => b.delay! - a.delay!);
    stats.max = byDelay[0];
    stats.min = byDelay[byDelay.length - 1];

    const positive = delays.filter((delay) => delay > 0).sort((a, b) => b - a);
    const top = positive.slice(0, Math.ceil(positive.length * 0.1));
    stats.avgTop10 = top.length ? Math.round(top.reduce((sum, delay) => sum + delay, 0) / top.length / 60) : 0;
    stats.top10VehCount = top.length;

    stats.median = Math.round(quantile(delays, 0.5) / 60);
    stats.quantile25 = Math.round(quantile(delays, 0.25) / 60);
    stats.quantile75 = Math.round(quantile(delays, 0.75) / 60);
    stats.quantile90 = Math.round(quantile(delays, 0.9) / 60);
    stats.avg = Math.round(delays.reduce((sum, delay) => sum + delay, 0) / delays.length / 60) || 0;

    for (const delay of delays) {
        const minutes = Math.round(delay / 60);
        if (minutes >= tolerance.min && minutes <= tolerance.max) stats.inTolerance.number++;
        else stats.outTolerance.number++;
    }
    stats.inTolerance.percentage = Math.round((stats.inTolerance.number / delays.length) * 10000) / 100;
    stats.outTolerance.percentage = Math.round((stats.outTolerance.number / delays.length) * 10000) / 100;

    const perRoute = new Map<string, { sum: number; vehicle: LiveVehicle; count: number }>();
    for (const vehicle of withDelay) {
        const key = `${vehicle.route[ERouteTuple.city]}/${vehicle.route[ERouteTuple.routeId]}`;
        const entry = perRoute.get(key);
        if (entry) {
            entry.sum += vehicle.delay!;
            entry.count++;
        } else perRoute.set(key, { sum: vehicle.delay!, vehicle, count: 1 });
    }
    stats.perRoute = [...perRoute.values()]
        .map(({ sum, count, vehicle }) => ({
            routeId: vehicle.route[ERouteTuple.routeId],
            routeName: vehicle.route[ERouteTuple.routeName],
            city: vehicle.route[ERouteTuple.city],
            type: vehicle.type,
            count,
            avgDelay: Math.round(sum / count / 60),
        }))
        .sort((a, b) => b.avgDelay - a.avgDelay);
    return stats;
};

export const mapLinesUrl = (city: string, type: number, routeId: string) => `/${city}?lines=${encodeURIComponent(`${type}/${routeId}`)}`;
export const mapVehicleUrl = (city: string, vehicleId: string) => `/${city}?pojazd=${encodeURIComponent(vehicleId)}`;
