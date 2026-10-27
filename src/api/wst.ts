import { encodePolyline6 } from "@/lib/transit";
import {
    ALIGHT,
    ERouteTuple,
    EStopDepartureTuple,
    EStopTuple,
    EVehiclePosition,
    RouteType,
    StopDepartureStatus,
    type RouteTuple,
    type StopDepartureTuple,
    type StopTuple,
    type StopTupleDetailed,
    type TripTupleDetailed,
    type ItineraryTuple,
    type ItineraryStop,
    type TripStopTime,
    type VehiclePositionDetailed,
    type VehiclePosition,
    type Point,
} from "./types";

const FEED_BASE = "/gtfs/wst";
const WIELICZKA_DEPARTURES = "https://wieliczka.kiedyprzyjedzie.pl/api/departures";

type KpDepartureRow = {
    time: string | null;
    static_time?: string | null;
    time_diff?: number;
    at_stop?: boolean;
    canceled?: boolean;
    direction_id: number;
    platform?: string;
    line_name: string;
    vehicle_type?: number;
    trip_id: number;
    trip_execution_id?: string;
};

type KpDeparturesResponse = {
    timestamp: number;
    rows: KpDepartureRow[];
    directions: Record<string, string>;
    station_name?: string;
};

type KpTripExecutionResponse = {
    trip: {
        times: { stop_name: string; place_id: string; departure_time: string; index: number; platform?: string }[];
        direction: string;
        line: { name: string; type?: string; show_name?: boolean };
    };
    vehicle?: { lon: number; lat: number } | null;
    estimates?: { to_go?: number | null; arrival_abs?: string | null }[];
    at_stop?: boolean;
    canceled?: unknown[];
    current_station_id?: number;
    vehicle_trip_index?: number;
    next_departure_index?: number;
};

const wstTripExecutionIds = new WeakMap<StopDepartureTuple[typeof EStopDepartureTuple.trip], string>();
export const wstTripExecutionId = (trip: StopDepartureTuple[typeof EStopDepartureTuple.trip]) => wstTripExecutionIds.get(trip);

const WST_EXEC_VEHICLE_PREFIX = "3:wst_";
export const wstExecutionVehicleId = (executionId: string) => `${WST_EXEC_VEHICLE_PREFIX}${executionId}`;
export const wstExecutionIdFromVehicleId = (vehicleId: string) => vehicleId.startsWith(WST_EXEC_VEHICLE_PREFIX) ? vehicleId.slice(WST_EXEC_VEHICLE_PREFIX.length) : null;


const WST_STOP_ID = /^\d+:\d+$/;

export const isWstStopId = (stopId: string) => WST_STOP_ID.test(stopId);

const warsawHourMinute = (epochMs: number) => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(epochMs));
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
    return { hour, minute };
};

/** Calendar date (YYYYMMDD) of a moment in Warsaw time. */
const warsawDate = (epochMs: number) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(epochMs));
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "01";
    return `${get("year")}${get("month")}${get("day")}`;
};

/** Predykcje względne i godziny zegarowe kotwiczone do czasu serwera API. */
const departureTimeMs = (serverRefSec: number, time: string | null, fetchedAtMs: number): number => {
    const serverRefMs = serverRefSec * 1000;
    if (!time) return fetchedAtMs;
    const value = time.trim();
    if (/min/i.test(value)) {
        // Relative predictions are anchored to the API's own timestamp, not
        // the browser fetch completion time (which can be minutes apart).
        if (value.startsWith("<")) return serverRefMs + 60_000;
        const minutes = Number(value.match(/(\d+)/)?.[1] ?? 0);
        return serverRefMs + minutes * 60_000;
    }
    const clock = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (clock) {
        const targetHour = Number(clock[1]);
        const targetMinute = Number(clock[2]);
        const { hour, minute } = warsawHourMinute(serverRefMs);
        let diffMin = (targetHour - hour) * 60 + (targetMinute - minute);
        if (diffMin < 0) diffMin += 24 * 60;
        return serverRefMs + diffMin * 60_000;
    }
    return fetchedAtMs;
};

const routeTupleForLine = (lineName: string, headsign: string, feed: WstFeed): RouteTuple => {
    const route = feed.routes.find((entry) => entry[ERouteTuple.routeName] === lineName);
    if (route) return route;
    return [`WST_${lineName}`, "krakow", lineName, headsign, "WST", RouteType.Bus, "#9ACD32"];
};

const mapKpRow = (row: KpDepartureRow, stopId: string, serverRefSec: number, fetchedAtMs: number, feed: WstFeed, directions: Record<string, string>): StopDepartureTuple => {
    const headsign = directions[String(row.direction_id)] ?? "";
    const route = routeTupleForLine(row.line_name, headsign, feed);
    // GTFS is the sole source of the planned time. Match the API's actual
    // trip_id and this exact stop; never substitute a neighbouring timetable
    // row or prefer the API's static_time over the project schedule.
    const gtfsRow = row.trip_id ? feed.stopTimes.find((entry) => entry.trip_id === String(row.trip_id) && entry.stop_id === stopId) : undefined;
    const scheduledDeparture = gtfsRow
        ? timeMs(warsawDate(serverRefSec * 1000), gtfsRow.departure_time)
        : departureTimeMs(serverRefSec, row.static_time ?? null, fetchedAtMs);
    const realtimeEpoch = row.time ? departureTimeMs(serverRefSec, row.time, fetchedAtMs) : null;
    const delay = realtimeEpoch !== null ? realtimeEpoch - scheduledDeparture : 0;
    const realtime = realtimeEpoch !== null;
    const status = row.canceled ? StopDepartureStatus.Cancelled : realtime || row.at_stop ? StopDepartureStatus.OnTrip : StopDepartureStatus.Scheduled;
    const brigade = row.trip_execution_id?.split("/")[1]?.split(":")[0] ?? "";
    const trip: StopDepartureTuple[typeof EStopDepartureTuple.trip] = [String(row.trip_id), "krakow", route, headsign, brigade, "", []];
    if (row.trip_execution_id) wstTripExecutionIds.set(trip, row.trip_execution_id);
    const departure: StopDepartureTuple[typeof EStopDepartureTuple.departure] = [scheduledDeparture, delay, status, row.platform ?? "", 0];
    return [trip, null, departure];
};

export const loadWstTripExecution = async (executionId: string, signal?: AbortSignal) => {
    const encoded = btoa(executionId);
    const requestStartedAt = Date.now();
    const response = await fetch(`https://wieliczka.kiedyprzyjedzie.pl/api/trip_execution/${encodeURIComponent(encoded)}/9`, { signal });
    if (!response.ok) throw new Error(`WST_TRIP_EXECUTION_${response.status}`);
    const payload = (await response.json()) as KpTripExecutionResponse;
    const fetchedAtMs = Date.now();
    const apiRefMs = Date.parse(response.headers.get("Date") ?? "") || requestStartedAt;
    const feed = await loadFeed();
    const route = routeTupleForLine(payload.trip.line.name, payload.trip.direction, feed);
    const brigade = executionId.split("/")[1]?.split(":")[0] ?? "";
    const trip: StopDepartureTuple[typeof EStopDepartureTuple.trip] = [executionId, "krakow", route, payload.trip.direction, brigade, "", []];
    const serviceDate = warsawDate(apiRefMs);
    const times = [...payload.trip.times].sort((a, b) => a.index - b.index);
    const itineraryStops = times.map((entry): ItineraryStop | null => {
        const stop = stopOf(feed, entry.place_id);
        return stop ? [stop, 0, 0, entry.platform ?? "", payload.trip.direction] : null;
    });
    const itinerary: ItineraryTuple = [itineraryStops.filter((entry): entry is ItineraryStop => entry !== null), encodePolyline6(executionShape(feed, payload.trip.line.name, times))];
    // `estimates` starts at the stop the vehicle is heading to, not at the first
    // stop of the trip — align it with `next_departure_index` (KP omits the
    // already passed stops). Using the raw index shifted every prediction by the
    // number of passed stops (wrong clock time and wrong "heading to" stop).
    const nextIndex = Math.min(Math.max(payload.next_departure_index ?? payload.vehicle_trip_index ?? 0, 0), Math.max(0, times.length - 1));
    const apiRefSec = Math.floor(apiRefMs / 1000);
    const stopTimes: TripStopTime[] = times.map((entry, index) => {
        const scheduled = timeMs(serviceDate, `${entry.departure_time}:00`);
        const estimate = index >= nextIndex ? payload.estimates?.[index - nextIndex] : undefined;
        const predicted = estimate?.arrival_abs
            ? departureTimeMs(apiRefSec, estimate.arrival_abs, fetchedAtMs)
            : typeof estimate?.to_go === "number"
              ? apiRefMs + estimate.to_go * 60_000
              : null;
        const point = predicted === null
            ? [scheduled, 0, StopDepartureStatus.Scheduled] as [number, number, StopDepartureStatus]
            : [scheduled, predicted - scheduled, StopDepartureStatus.OnTrip] as [number, number, StopDepartureStatus];
        return [point, point];
    });
    const sequence = nextIndex;
    const position: VehiclePositionDetailed | null = payload.vehicle && Number.isFinite(payload.vehicle.lat) && Number.isFinite(payload.vehicle.lon)
        ? [wstExecutionVehicleId(executionId), "krakow", route, brigade, [payload.vehicle.lon, payload.vehicle.lat], null, fetchedAtMs, executionId, times.length > 1 ? sequence / (times.length - 1) : 0]
        : null;
    return { trip, itinerary, position, stops: stopTimes, sequence, canceled: !!payload.canceled?.length };
};

// KP's multi-stop board honours only the first 6 places per request, so batches
// must be small and the discovery must focus on informative stops.
const WST_STOP_BATCH = 6;

const sleep = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
        }, { once: true });
    });

// The KP server occasionally answers a batch with 5xx; retry a couple of times so
// a single flaky response does not drop a whole line of running buses.
const fetchStopBatch = async (batch: string[], signal?: AbortSignal, attempt = 0): Promise<{ departures?: { rows?: KpDepartureRow[] }[] } | null> => {
    try {
        const response = await fetch(`${WIELICZKA_DEPARTURES}?places=${batch.join(",")}`, { signal });
        if (!response.ok) throw new Error(`WST_DEPARTURES_${response.status}`);
        return (await response.json()) as { departures?: { rows?: KpDepartureRow[] }[] };
    } catch (error) {
        if (signal?.aborted || attempt >= 2) return null;
        await sleep(250 * (attempt + 1), signal);
        return fetchStopBatch(batch, signal, attempt + 1);
    }
};

// Lightweight GPS-only lookup used by the map to plot every WST bus on the road.
// The KP API returns the assigned vehicle's last GPS for future trips too, so a
// bus waiting for its next run still shows up (like the stop boards list it).
const fetchTripExecution = async (executionId: string, signal?: AbortSignal) => {
    const response = await fetch(`https://wieliczka.kiedyprzyjedzie.pl/api/trip_execution/${encodeURIComponent(btoa(executionId))}/9`, { signal });
    if (!response.ok) return null;
    const payload = (await response.json()) as KpTripExecutionResponse;
    const apiRefMs = Date.parse(response.headers.get("Date") ?? "") || Date.now();
    return { payload, apiRefMs };
};

// Execution ids are "<line>/<block>:<day>:<sequence>"; consecutive trips of the
// same vehicle differ by one sequence number.
const shiftExecutionId = (executionId: string, delta: number): string | null => {
    const match = /^(.*:)(\d+)$/.exec(executionId);
    if (!match) return null;
    const next = Number(match[2]) + delta;
    return next < 0 ? null : `${match[1]}${next}`;
};

// A trip that has started or ended no longer than a short while ago is the one
// the bus is on / just finished; older trips must not shadow the next course.
const recentlyActive = (payload: KpTripExecutionResponse, apiRefMs: number) => {
    if ((payload.vehicle_trip_index ?? -1) < 0) return false;
    const times = payload.trip?.times ?? [];
    if (!times.length) return true;
    const date = warsawDate(apiRefMs);
    const start = timeMs(date, `${times[0].departure_time}:00`);
    const end = timeMs(date, `${times[times.length - 1].departure_time}:00`);
    return apiRefMs >= start - 10 * 60_000 && apiRefMs <= end + 30 * 60_000;
};

const loadWstVehicle = async (executionId: string, feed: WstFeed, signal?: AbortSignal): Promise<{ position: VehiclePosition; active: boolean } | null> => {
    const current = await fetchTripExecution(executionId, signal);
    if (!current) return null;
    let chosenId = executionId;
    let { payload } = current;
    // A not-yet-started trip still reports the vehicle at its last GPS; if the
    // previous trip of the same block just finished, show that one instead of
    // jumping the rider to the next course.
    if ((payload.vehicle_trip_index ?? -1) < 0) {
        const previousId = shiftExecutionId(executionId, -1);
        const previous = previousId ? await fetchTripExecution(previousId, signal).catch(() => null) : null;
        if (previous && recentlyActive(previous.payload, previous.apiRefMs)) {
            chosenId = previousId!;
            payload = previous.payload;
        }
    }
    if (!payload.vehicle || !Number.isFinite(payload.vehicle.lat) || !Number.isFinite(payload.vehicle.lon)) return null;
    const route = routeTupleForLine(payload.trip.line.name, payload.trip.direction, feed);
    const brigade = chosenId.split("/")[1]?.split(":")[0] ?? "";
    const active = (payload.vehicle_trip_index ?? -1) >= 0;
    return { position: [wstExecutionVehicleId(chosenId), "krakow", route, brigade, [payload.vehicle.lon, payload.vehicle.lat], null], active };
};

const coordKey = (position: VehiclePosition) =>
    `${position[EVehiclePosition.location][0].toFixed(5)}:${position[EVehiclePosition.location][1].toFixed(5)}`;

// All Wieliczka buses: discover trip executions from the stop boards (the KP API
// offers no public vehicle list), then read their GPS. Running trips win over the
// future trips of the same physical bus, so one bus is plotted only once.
export const loadWstVehicles = async (signal?: AbortSignal): Promise<VehiclePosition[]> => {
    const feed = await loadFeed();
    // Near-terminus stops are listed by every running bus (they are ahead of it),
    // so the last stops of each trip cover all lines with a handful of requests.
    const stopIds = new Set<string>();
    for (const trip of feed.trips) {
        const rows = tripTimes(feed, trip.trip_id);
        for (let index = Math.max(0, rows.length - 3); index < rows.length; index++) stopIds.add(rows[index].stop_id);
    }
    const discoveryStops = [...stopIds];
    const batches: string[][] = [];
    for (let index = 0; index < discoveryStops.length; index += WST_STOP_BATCH) batches.push(discoveryStops.slice(index, index + WST_STOP_BATCH));
    const pages = await Promise.all(batches.map((batch) => fetchStopBatch(batch, signal)));
    const executions = new Set<string>();
    for (const page of pages) {
        for (const place of page?.departures ?? []) {
            for (const row of place.rows ?? []) if (row.trip_execution_id) executions.add(row.trip_execution_id);
        }
    }
    const loaded = (await Promise.all([...executions].slice(0, 40).map((executionId) => loadWstVehicle(executionId, feed, signal).catch(() => null)))).filter(
        (entry): entry is { position: VehiclePosition; active: boolean } => entry !== null,
    );
    const active = loaded.filter((entry) => entry.active).map((entry) => entry.position);
    const used = new Set(active.map(coordKey));
    const upcoming: VehiclePosition[] = [];
    for (const entry of loaded) {
        if (entry.active) continue;
        const key = coordKey(entry.position);
        if (used.has(key)) continue;
        used.add(key);
        upcoming.push(entry.position);
    }
    return [...active, ...upcoming];
};

export const loadWstStopDepartures = async (stopId: string, options: { limit?: number } = {}, signal?: AbortSignal) => {
    const { limit = 20 } = options;
    const response = await fetch(`${WIELICZKA_DEPARTURES}/${encodeURIComponent(stopId)}`, { signal });
    if (!response.ok) throw new Error(`WST_DEPARTURES_${response.status}`);
    const payload = (await response.json()) as KpDeparturesResponse;
    const fetchedAtMs = Date.now();
    const feed = await loadFeed();
    const stop = stopOf(feed, stopId);
    if (!stop) throw new Error("STOP_NOT_FOUND");
    const routeIds = new Set(
        feed.stopTimes.filter((row) => row.stop_id === stopId).map((row) => feed.trips.find((trip) => trip.trip_id === row.trip_id)?.route_id).filter(Boolean),
    );
    const routes = [...routeIds].map((id) => routeOf(feed, id!)).filter((entry): entry is RouteTuple => !!entry);
    const detailed: StopTupleDetailed = [...stop, "", routes, []];
    if (payload.station_name && payload.station_name !== stop[EStopTuple.stopName]) {
        detailed[EStopTuple.stopName] = payload.station_name;
    }
    const departures = payload.rows.slice(0, limit).map((row) => mapKpRow(row, stopId, payload.timestamp, fetchedAtMs, feed, payload.directions));
    return { stop: detailed, departures, source: "kiedyprzyjedzie" as const, apiTimestamp: payload.timestamp };
};

type RouteRecord = {
    route_id: string;
    agency_id: string;
    route_short_name: string;
    route_long_name: string;
    route_type: string;
    route_color: string;
};

type StopRecord = { stop_id: string; stop_name: string; stop_lat: string; stop_lon: string };
type TripRecord = { route_id: string; service_id: string; trip_id: string; trip_headsign: string; direction_id: string; shape_id: string };
type StopTimeRecord = { trip_id: string; arrival_time: string; departure_time: string; stop_id: string; stop_sequence: string };
type ShapeRecord = { shape_id: string; shape_pt_lat: string; shape_pt_lon: string; shape_pt_sequence: string };
type CalendarRecord = { service_id: string; monday: string; tuesday: string; wednesday: string; thursday: string; friday: string; saturday: string; sunday: string; start_date: string; end_date: string };
type CalendarDateRecord = { service_id: string; date: string; exception_type: string };

type WstFeed = {
    routes: RouteTuple[];
    stops: StopTuple[];
    trips: TripRecord[];
    stopTimes: StopTimeRecord[];
    // trip_id -> sequence-ordered stop_times (indexed for O(1) lookups).
    stopTimesByTrip: Map<string, StopTimeRecord[]>;
    // shape_id -> ordered [lon, lat] points (GTFS shapes.txt).
    shapes: Map<string, Point[]>;
    calendar: CalendarRecord[];
    calendarDates: CalendarDateRecord[];
};

type WstRouteDetails = { route: RouteTuple; graph: { headsign: string; trunk: StopTuple[] }[]; shapes: string[][] };
type WstTimetable = { stop: StopTupleDetailed; timetable: Record<string, [string, number, number, string, string, string?][]>; legend: never[] };
type WstTripDetails = { stops: [StopTuple, number, number, string, string, number, number][]; shape: string };

const parseCsv = (text: string): Record<string, string>[] => {
    const rows = text.trim().split(/\r?\n/).filter(Boolean);
    if (rows.length === 0) return [];
    const headers = rows[0].split(",");
    return rows.slice(1).map((row) => {
        const values = row.split(",");
        return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });
};

const loadCsv = async <T extends Record<string, string>>(file: string, signal?: AbortSignal): Promise<T[]> => {
    const response = await fetch(`${FEED_BASE}/${file}`, { signal });
    if (!response.ok) throw new Error(`WST_${response.status}`);
    return parseCsv(await response.text()) as T[];
};

const buildStopTimesByTrip = (rows: StopTimeRecord[]) => {
    const byTrip = new Map<string, StopTimeRecord[]>();
    for (const row of rows) {
        const list = byTrip.get(row.trip_id) ?? [];
        list.push(row);
        byTrip.set(row.trip_id, list);
    }
    for (const list of byTrip.values()) list.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    return byTrip;
};

// shapes.txt rows -> shape_id keyed, sequence-ordered [lon, lat] points.
const buildShapes = (rows: ShapeRecord[]) => {
    const raw = new Map<string, [sequence: number, point: Point][]>();
    for (const row of rows) {
        const list = raw.get(row.shape_id) ?? [];
        list.push([Number(row.shape_pt_sequence), [Number(row.shape_pt_lon), Number(row.shape_pt_lat)]]);
        raw.set(row.shape_id, list);
    }
    const shapes = new Map<string, Point[]>();
    for (const [id, list] of raw) shapes.set(id, list.sort((a, b) => a[0] - b[0]).map(([, point]) => point));
    return shapes;
};

const tripShape = (feed: WstFeed, tripId: string): Point[] => {
    const shapeId = feed.trips.find((trip) => trip.trip_id === tripId)?.shape_id;
    return shapeId ? (feed.shapes.get(shapeId) ?? []) : [];
};

// The KP trip_execution payload carries no trip_id, so match a GTFS trip of the
// same line by its ordered stop list (first and last stop) to reach shapes.txt.
const executionShape = (feed: WstFeed, lineName: string, times: { place_id: string }[]): Point[] => {
    if (!times.length) return [];
    const routeId = feed.routes.find((route) => route[ERouteTuple.routeName] === lineName)?.[ERouteTuple.routeId]?.replace(/^WST_/, "");
    if (!routeId) return [];
    const first = times[0].place_id;
    const last = times[times.length - 1].place_id;
    const routes = feed.trips.filter((trip) => trip.route_id === routeId);
    const candidate =
        routes.find((trip) => {
            const rows = tripTimes(feed, trip.trip_id);
            return rows.length === times.length && rows[0]?.stop_id === first && rows[rows.length - 1]?.stop_id === last;
        }) ?? routes.find((trip) => {
            const rows = tripTimes(feed, trip.trip_id);
            return rows[0]?.stop_id === first && rows[rows.length - 1]?.stop_id === last;
        });
    return candidate?.shape_id ? (feed.shapes.get(candidate.shape_id) ?? []) : [];
};

let feedPromise: Promise<WstFeed> | undefined;

// Cached feed; must not be tied to a caller's abort signal, and a failure
// clears the cache so the next caller retries instead of failing forever.
const loadFeed = () => {
    if (!feedPromise) {
        feedPromise = Promise.all([
            loadCsv<RouteRecord>("routes.txt"),
            loadCsv<StopRecord>("stops.txt"),
            loadCsv<TripRecord>("trips.txt"),
            loadCsv<StopTimeRecord>("stop_times.txt"),
            loadCsv<ShapeRecord>("shapes.txt"),
            loadCsv<CalendarRecord>("calendar.txt"),
            loadCsv<CalendarDateRecord>("calendar_dates.txt"),
        ])
            .catch((error) => {
                feedPromise = undefined;
                throw error;
            })
            .then(([routeRows, stopRows, trips, stopTimes, shapeRows, calendar, calendarDates]) => ({
            routes: routeRows.map((route) => [`WST_${route.route_id}`, "krakow", route.route_short_name, route.route_long_name, route.agency_id, Number(route.route_type) === 700 ? 3 : Number(route.route_type), `#${route.route_color}`]),
            stops: stopRows.map((stop) => [stop.stop_id, "krakow", stop.stop_name, "", [Number(stop.stop_lon), Number(stop.stop_lat)], [3], null]),
            trips,
            stopTimes,
            stopTimesByTrip: buildStopTimesByTrip(stopTimes),
            shapes: buildShapes(shapeRows),
            calendar,
            calendarDates,
        }));
    }
    return feedPromise;
};

const routeIdOf = (routeId: string) => routeId.replace(/^WST_/, "");
const dateIndex = (date: string) => Math.round((Date.parse(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00Z`) - Date.parse("2020-01-01T00:00:00Z")) / 86400000);
const dateString = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, "");
const timeMs = (date: string, value: string) => {
    const [hour, minute, second] = value.split(":").map(Number);
    // GTFS service times are local wall-clock times. Treating them as UTC
    // shifts the displayed schedule by 1–2 hours in Poland and pairs the
    // prediction with the wrong-looking neighbouring departure.
    const target = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8)), hour, minute, second);
    let epoch = target;
    const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    for (let attempt = 0; attempt < 3; attempt++) {
        const parts = formatter.formatToParts(new Date(epoch));
        const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? 0);
        const displayedAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
        epoch += target - displayedAsUtc;
    }
    return epoch;
};

const serviceDates = (feed: WstFeed) => {
    const out = new Map<string, Set<string>>();
    for (const service of feed.calendar) {
        const start = new Date(Date.UTC(Number(service.start_date.slice(0, 4)), Number(service.start_date.slice(4, 6)) - 1, Number(service.start_date.slice(6, 8))));
        const end = new Date(Date.UTC(Number(service.end_date.slice(0, 4)), Number(service.end_date.slice(4, 6)) - 1, Number(service.end_date.slice(6, 8))));
        const dates = new Set<string>();
        for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
            const day = date.getUTCDay();
            const enabled = [service.sunday, service.monday, service.tuesday, service.wednesday, service.thursday, service.friday, service.saturday][day] === "1";
            if (enabled) dates.add(dateString(date));
        }
        out.set(service.service_id, dates);
    }
    for (const exception of feed.calendarDates) {
        const dates = out.get(exception.service_id) ?? new Set<string>();
        if (exception.exception_type === "1") dates.add(exception.date);
        if (exception.exception_type === "2") dates.delete(exception.date);
        out.set(exception.service_id, dates);
    }
    return out;
};

const stopOf = (feed: WstFeed, id: string) => feed.stops.find((stop) => stop[0] === id);
const routeOf = (feed: WstFeed, id: string) => feed.routes.find((route) => route[0] === `WST_${id}`);
const tripTimes = (feed: WstFeed, tripId: string) => feed.stopTimesByTrip.get(tripId) ?? [];
const routeStops = (feed: WstFeed, trip: TripRecord) => tripTimes(feed, trip.trip_id).map((row) => stopOf(feed, row.stop_id)).filter((stop): stop is StopTuple => !!stop);
const stopNameKey = (name: string) => name.toLocaleLowerCase("pl").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const stopDistance = (a: StopTuple, b: StopTuple) => {
    const lon = a[4][0] - b[4][0];
    const lat = a[4][1] - b[4][1];
    return Math.sqrt((lon * Math.cos((a[4][1] * Math.PI) / 180)) ** 2 + lat ** 2) * 111320;
};

const mergedWstStopIds = new WeakMap<StopTuple, string[]>();
export const getMergedWstStopIds = (stop: StopTuple) => mergedWstStopIds.get(stop) ?? [];

export const mergeWstStops = (base: StopTuple[], wst: StopTuple[]) => {
    const result = [...base];
    for (const local of wst) {
        if (result.some((stop) => stop[0] === local[0])) continue;
        const duplicateIndex = result.findIndex((stop) => stopNameKey(stop[2]) === stopNameKey(local[2]) && stopDistance(stop, local) <= 35);
        if (duplicateIndex < 0) {
            result.push(local);
            continue;
        }
        // Keep one map marker for the shared physical stop, but retain the WST
        // IDs so its sheet can show departures/routes from both providers.
        const shared = [...result[duplicateIndex]] as StopTuple;
        mergedWstStopIds.set(shared, [...new Set([...getMergedWstStopIds(result[duplicateIndex]), local[0]])]);
        result[duplicateIndex] = shared;
    }
    return result;
};

export const isWstRoute = (routeId: string) => routeId.startsWith("WST_");

export const loadWstRoutes = async (signal?: AbortSignal): Promise<RouteTuple[]> => {
    return (await loadFeed()).routes;
};

export const loadWstStops = async (signal?: AbortSignal): Promise<StopTuple[]> => {
    return (await loadFeed()).stops;
};

export const loadWstRouteDetails = async (routeId: string, signal?: AbortSignal): Promise<WstRouteDetails> => {
    const feed = await loadFeed();
    const rawRoute = routeIdOf(routeId);
    const route = routeOf(feed, rawRoute);
    if (!route) throw new Error("ROUTE_NOT_FOUND");
    const trips = feed.trips.filter((trip) => trip.route_id === rawRoute);
    const directions = [...new Map(trips.map((trip) => [`${trip.direction_id}:${trip.trip_headsign}`, trip])).values()];
    return { route, graph: directions.map((trip) => ({ headsign: trip.trip_headsign, trunk: routeStops(feed, trip) })), shapes: [] };
};

export const loadWstStopDirections = async (stopId: string, signal?: AbortSignal) => {
    const feed = await loadFeed();
    const routeIds = new Set(feed.stopTimes.filter((row) => row.stop_id === stopId).map((row) => feed.trips.find((trip) => trip.trip_id === row.trip_id)?.route_id).filter(Boolean));
    const routes = [...routeIds].map((id) => routeOf(feed, id!)).filter((route): route is RouteTuple => !!route);
    const stop = stopOf(feed, stopId);
    if (!stop) throw new Error("STOP_NOT_FOUND");
    const detailed: StopTupleDetailed = [...stop, "", routes, []];
    return { stop: detailed, directions: routes.map((route) => [route, 0, route[3], false] as [RouteTuple, number, string, boolean]) };
};

export const loadWstStopTimetable = async (stopId: string, routeId: string, signal?: AbortSignal): Promise<WstTimetable> => {
    const feed = await loadFeed();
    const rawRoute = routeIdOf(routeId);
    const stop = stopOf(feed, stopId);
    const route = routeOf(feed, rawRoute);
    if (!stop || !route) throw new Error("NOT_FOUND");
    const dates = serviceDates(feed);
    const timetable: WstTimetable["timetable"] = {};
    for (const trip of feed.trips.filter((entry) => entry.route_id === rawRoute)) {
        const row = tripTimes(feed, trip.trip_id).find((entry) => entry.stop_id === stopId);
        if (!row) continue;
        for (const date of dates.get(trip.service_id) ?? []) {
            const index = String(dateIndex(date));
            const last = row.stop_sequence === String(tripTimes(feed, trip.trip_id).length);
            (timetable[index] ??= []).push([trip.trip_id, timeMs(date, row.departure_time), last ? ALIGHT.IsLastStop : 0, "", trip.trip_headsign]);
        }
    }
    for (const rows of Object.values(timetable)) rows.sort((a, b) => a[1] - b[1]);
    return { stop: [...stop, "", [route], []], timetable, legend: [] };
};

export const loadWstTrip = async (tripId: string, signal?: AbortSignal): Promise<WstTripDetails> => {
    const feed = await loadFeed();
    const trip = feed.trips.find((entry) => entry.trip_id === tripId);
    if (!trip) throw new Error("TRIP_NOT_FOUND");
    const date = [...serviceDates(feed).get(trip.service_id) ?? []][0];
    const stops = tripTimes(feed, trip.trip_id);
    const start = date ?? "20260101";
    return {
        shape: encodePolyline6(tripShape(feed, trip.trip_id)),
        stops: stops.map((row, index) => {
            const stop = stopOf(feed, row.stop_id)!;
            const last = index === stops.length - 1 ? ALIGHT.IsLastStop : 0;
            const arrival = timeMs(start, row.arrival_time);
            const departure = timeMs(start, row.departure_time);
            return [stop, last, 0, "", trip.trip_headsign, arrival, departure];
        }),
    };
};
