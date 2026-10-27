import { ApiError, cityGet } from "@/api/client";
import { EBrigadeTuple, ERouteTuple, type BrigadeTuple, type RouteTuple, type TripTupleDetailed } from "@/api/types";

// One duty of the whole city: own route, brigade, trips, first departure, last arrival and every line it runs on.
export type CityBrigade = {
    route: RouteTuple;
    brigade: string;
    tripCount: number;
    start: number;
    end: number;
    lines: RouteTuple[];
};

export type CityBrigades = { brigades: CityBrigade[]; linesKnown: boolean };

type CncBrigadesResponse = {
    routes: RouteTuple[];
    brigades: [route: number, brigade: string, tripCount: number, start: number, end: number, lines: number[]][];
};

// Live vehicle on a duty: [vehicleId, routeId, brigade, tripSlug | null, delayMs | null]
export type LiveBrigadeRow = [vehicleId: string, routeId: string, brigade: string, tripId: string | null, delay: number | null];

export const brigadeKey = (routeId: string, brigade: string) => `${routeId}/${brigade}`;

const runLimited = async <T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>, signal?: AbortSignal): Promise<R[]> => {
    const results: R[] = new Array(items.length);
    let next = 0;
    const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
            const index = next++;
            results[index] = await worker(items[index]);
        }
    });
    await Promise.all(lanes);
    return results;
};

// Prefers the cnc endpoint (one request); falls back to /routes + /brigades/:route/:date per line.
export const fetchCityBrigades = async (
    city: string,
    date: number,
    signal?: AbortSignal,
    onProgress?: (partial: CityBrigades, done: number, total: number) => void,
): Promise<CityBrigades> => {
    try {
        const response = await cityGet<CncBrigadesResponse>(city, `/cnc/brigades/${date}`, undefined, signal);
        if (Array.isArray(response?.brigades)) {
            return {
                linesKnown: true,
                brigades: response.brigades.map(([route, brigade, tripCount, start, end, lines]) => ({
                    route: response.routes[route],
                    brigade,
                    tripCount,
                    start,
                    end,
                    lines: lines.map((line) => response.routes[line]),
                })),
            };
        }
    } catch (error) {
        if (signal?.aborted) throw error;
        if (error instanceof ApiError && error.status === 400) throw error;
    }

    const routes = (await cityGet<RouteTuple[]>(city, "/routes", undefined, signal)).filter((route) => route[ERouteTuple.city] === city);
    const brigades: CityBrigade[] = [];
    let done = 0;
    let lastReport = 0;
    await runLimited(
        routes,
        16,
        async (route) => {
            const list = await cityGet<BrigadeTuple[]>(city, `/brigades/${encodeURIComponent(route[ERouteTuple.routeId])}/${date}`, undefined, signal).catch(
                () => [] as BrigadeTuple[],
            );
            for (const tuple of list) {
                const shifts = tuple[EBrigadeTuple.shifts];
                brigades.push({
                    route,
                    brigade: tuple[EBrigadeTuple.brigade],
                    tripCount: tuple[EBrigadeTuple.tripCount],
                    start: shifts[0]?.[0] ?? 0,
                    end: shifts[shifts.length - 1]?.[1] ?? 0,
                    lines: [route],
                });
            }
            done++;
            if (onProgress && !signal?.aborted && (Date.now() - lastReport > 700 || done === routes.length)) {
                lastReport = Date.now();
                onProgress({ brigades: [...brigades], linesKnown: false }, done, routes.length);
            }
        },
        signal,
    );
    return { brigades, linesKnown: false };
};

export const fetchLiveBrigades = async (city: string, signal?: AbortSignal): Promise<LiveBrigadeRow[]> => {
    try {
        return await cityGet<LiveBrigadeRow[]>(city, "/cnc/brigades/live", undefined, signal);
    } catch (error) {
        if (signal?.aborted) throw error;
        return [];
    }
};

export const fetchBrigadeTrips = (city: string, routeId: string, brigade: string, date: number, signal?: AbortSignal) =>
    cityGet<TripTupleDetailed[]>(city, `/brigades/${encodeURIComponent(routeId)}/${encodeURIComponent(brigade)}/${date}`, undefined, signal);

export const compareNatural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

// Tram, bus, trolleybus, ferry, metro, rail — the original's list order.
const TYPE_ORDER = [0, 3, 11, 4, 1, 2];
export const typeRank = (type: number) => {
    const index = TYPE_ORDER.indexOf(type);
    return index === -1 ? TYPE_ORDER.length : index;
};
