# zbiorkom.live public API v6 — frontend reference

Base URL: **`https://api.zbiorkom.live/api6`**. The prefix is part of every route in `src/server/endpoints/v6/*.ts`, e.g. `"/api6/:city/stops/:stopId"`. There is no rewrite layer.

Sources: the backend repo `src/server/**` and `src/db/helpers/**`, checked on 2026-09-25 against live responses from `api.zbiorkom.live`. The live server matched the code for every endpoint tried. There was one small difference, noted under `/vehicles/vehicle/:vehicleId`. The samples below are real but trimmed; `…` marks a cut.

---

## 0. General conventions (read first)

### 0.1 Transport, CORS, caching

- Everything is `GET` except `OPTIONS` preflight. Responses are JSON (`application/json;charset=utf-8`), except the SSE streams (`text/event-stream`).
- **CORS**: `basicMiddleware` echoes the request `Origin`: `Access-Control-Allow-Origin: <your origin>` (or `*` without an Origin), `Access-Control-Allow-Credentials: true`, `Vary: Origin`. Preflight (`OPTIONS`) returns 204 with `Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`, and `Allow-Headers` echoes `Access-Control-Request-Headers` (default `Content-Type`), `Max-Age: 86400`. Verified live with `Origin: http://localhost:5173`. A browser SPA on any origin works without a proxy.
- Every response carries an `X-Response-Time: 1.37 ms` header.
- **Caching** happens only at Cloudflare's edge. Endpoints marked "TTL n min" send `Cache-Control: public, s-maxage=<n*60>, max-age=0` and `Cloudflare-CDN-Cache-Control: max-age=<n*60>`. The browser always revalidates; the edge caches. Endpoints without a TTL are not cached (`cf-cache-status: BYPASS/MISS`).
- **Errors**: `{"error": "ERROR_CODE"}` with an HTTP status. Codes shared by every endpoint:
  - `404 CITY_NOT_FOUND`: `:city` is not a loaded city.
  - `500 UNKNOWN_ERROR`: an unhandled exception. No stack trace is returned.
  - An unknown path returns 404 with Bun's default body, which is not JSON.
- `:city` is a city id from the city list (§1), e.g. `warsaw`, `krakow`, `pkp`, `tricity`. Ids are camelCase and case-sensitive.

### 0.2 Units and encodings (everything is consistent unless noted)

| Thing | Encoding |
|---|---|
| Coordinates (`Point`) | `[lon, lat]` as decimal degrees (floats with 6 decimals). **Longitude first.** |
| Timestamps | **epoch milliseconds, UTC** (`1790366220000`). |
| Realtime delay in departures / trip stop times | **milliseconds** (`983000` = 16 min 23 s late; negative = early). |
| Delay in history / dispatches / speed endpoints | **seconds** (named `…S`, or documented per field). |
| Durations in the trip planner | **seconds**. Distances are **metres**. |
| Service date ("date index") | integer **days since 2020-01-01**, as a local service day (`2459` = 2026-09-25). Convert with `new Date(Date.UTC(2020,0,1) + idx*86400000)`. Used by `/dates`, timetable keys, `/brigades/...:date`, `days` of trip search, `/history/trip`. |
| ISO dates | `YYYY-MM-DD` only where stated (`/history/*`, `/dispatches*`). The month is `YYYY-MM`. |
| Polylines | **Google encoded-polyline algorithm with precision 1e6** ("polyline6"), point order **lat, lon**. Decode with `@mapbox/polyline` `decode(str, 6)`, which returns `[lat, lon]`; swap for GeoJSON. |
| Colors | `"#rrggbb"` strings in route tuples. Exception: a vehicle with no static route (realtime-only line) has a synthesized route tuple whose color is the default color **without `#`** (e.g. `"2b6c00"`). Normalise on the client. |
| `undefined` in arrays | JSON-serialised as `null`. For example, a stop tuple's `bearing` is `null` when unknown. Object fields that are `undefined` are **omitted**. |

### 0.3 Identifiers

- **City id**: `warsaw`.
- **Stop id (slug)**: e.g. `centrum01-0fb5f`. Built from the name slug, the stop code and a 5-char location suffix. It is stable while the stop doesn't move.
- **Route id (slug)**: e.g. `520`, `m1`, `OTWOCKm1`, `ICeip`. Different from the displayed `routeName` (`M1`).
- **Trip reference** (`:tripId` params): either
  - a **trip slug** `"<routeId>_<firstStopId>_<lastStopId>_<dd.mm.yyyy>_<HH.MM>"` (the first departure, local time), e.g. `520_dw-centralny25-04w5i_marysin03-5kmj8_25.09.2026_21.54`. `TripTuple[0]` holds this.
  - or `idx:<n>` (e.g. `idx:26850`) returned by the timetable, trip search and planner endpoints. **`idx:` refs are internal array indices and change whenever the city's schedule is recompiled (nightly).** Don't persist them; use them right away or persist the slug instead.
- **Vehicle id**: `"<routeType>:<agency>_<number>"`, with the `<agency>_` part omitted for the default agency: `3:7809` (bus 7809 of the default agency), `0:4117` (tram), `3:GPA_123`. The prefix number is a `RouteType` (§2.1).
- **Virtual cities**: `pkp` (Polish rail), `flixbus`, `mld`, `digitraffic` are "virtual" cities overlaid on normal ones. Several endpoints of a normal city (stop search, route list, route search, trip search, map vehicles) also return data from its virtual cities. **Every tuple carries its own `city` field; always use that field, not the URL city, when calling a detail endpoint.** For example, a stop found via `/warsaw/stops/search` might be `["...", "pkp", ...]`, and you then call `/pkp/stops/...`. The city list does not tell you which virtual cities a city includes.

---

## 1. City list / app config

### `GET /api6`
Query:
- `h`: the `hash` from a previous response. When it matches, `cities` is omitted, so you can cache the list client-side.
- `b`: client build number. When `b` < 1 (or missing), `shouldUpdate: true` is returned. If it is below the minimum (currently 0), the response is `426 OUTDATED_CLIENT`. A web SPA can send `b=1` or ignore the field.

Response (no TTL):
```ts
{
  hash: string;                 // e.g. "ms3m9z2ee4tr"
  shouldUpdate?: true;
  cities?: City[];              // omitted when h === hash
}
type City = {
  id: string; name: string; description?: string;
  category: CityCategory;       // see §2.6
  virtual?: true;               // pkp, flixbus, mld, digitraffic
  location: Point;              // default map centre
  timezone: string;             // "Europe/Warsaw", "Europe/Helsinki", …
  agencies: Record<string /*agencyId*/, {
    id: string; name: string;
    location?: Point;
    icon?: string;              // SVG <path …/> markup (24×24 viewBox) — inject into <svg viewBox="0 0 24 24">
    faresUrl?: string;
    dataSources?: { type: "officialGTFS"|"GTFS"|"officialGPS"|"GPS"|"officialDelays"|"Delays"; provider: string; providerUrl?: string }[];
  }>;
}
```
There are 67 cities live, 4 of them virtual. The agency id `"default"` is the main operator; route tuples use the same agency ids.

Sample:
```json
{"hash":"ms3m9z2ee4tr","shouldUpdate":true,"cities":[{"id":"warsaw","name":"Warszawa","category":"masovian","location":[21.0122,52.2297],"timezone":"Europe/Warsaw","agencies":{"default":{"id":"default","name":"Warszawski Transport Publiczny","faresUrl":"https://www.wtp.waw.pl/ceny-i-rodzaje-biletow/","dataSources":[{"type":"officialGTFS","provider":"Mikołaj Kuranowski","providerUrl":"https://mkuran.pl/gtfs/"}, …]},"GPA":{"id":"GPA","name":"Grodziskie Przewozy Autobusowe","icon":"<path d=\"M23.988 9.828v4.32…\"/>"}, …}}, …]}
```

---

## 2. Tuples and enums (the core vocabulary)

All compact records are **positional arrays**. Define TS enums on the client exactly like these.

### 2.1 `RouteType` (route / vehicle / stop type)
| value | name | default color (no `#`) |
|---|---|---|
| 0 | Tram | `be0d05` |
| 1 | Subway | `ba0059` |
| 2 | Rail | `415f91` |
| 3 | Bus | `2b6c00` |
| 4 | Ferry | `0061a4` |
| 6 | AerialLift | `88511e` |
| 7 | Funicular | `705289` |
| 11 | Trolleybus | `006c46` |
| 12 | Monorail | `895120` |

Values 5, 8, 9 and 10 are unused. Real routes carry their own compiled color, a tone derived from the GTFS color (e.g. Warsaw buses `#bd0c00`, express `#a5248c`, night `#9c4163`). The defaults above are used only for realtime-only vehicles (§0.2).

### 2.2 `RouteTuple`
```ts
enum ERouteTuple { routeId, city, routeName, routeLongName, routeAgency, routeType, routeColor }
type RouteTuple = [routeId: string, city: string, routeName: string, routeLongName: string,
                   routeAgency: string /* agency id, "default" */, routeType: RouteType, routeColor: string];
```
`["520","warsaw","520","Dw. Centralny — Marysin","default",3,"#bd0c00"]`, `["m1","warsaw","M1","Młociny — Kabaty","default",1,"#4249e7"]`

For a realtime-only vehicle the route tuple is synthesized as `[routeName, city, routeName, "", agency|"" , type, "rrggbb"]`.

### 2.3 `StopTuple`
```ts
enum EStopTuple { stopId, city, stopName, stopCode, location, vehicleTypes, bearing,
                  /* detailed only: */ direction, routes, entrances }
type StopTuple = [stopId: string, city: string, stopName: string, stopCode: string /* "" if none */,
                  location: Point, vehicleTypes: RouteType[], bearing: number | null /* degrees 0-359 */];
type StopTupleDetailed = [...StopTuple, direction: string /* "towards" label, may be "" */,
                  routes: RouteTuple[] /* lines serving the stop */, entrances: StopEntranceTuple[]];
enum EStopEntranceTuple { name, location }
type StopEntranceTuple = [name: string, location: Point];   // metro/rail station entrances; [] for plain stops
```
Basic: `["centrum01-0fb5f","warsaw","Centrum","01",[21.011909,52.229076],[3],154]`
Detailed: `[…same 7…, "Hoża", [["175","warsaw","175",…], …], []]`

The "detailed" variant is returned by `/stops/:id`, `/stops/:id/meta`, `/stops/:id/directions`, `/stops/:id/timetable/:route`, the stop SSE `initial` event, and `/search` stops.

### 2.4 `TripTuple`
```ts
enum ETripTuple { tripId, city, route, headsign, brigade, shortName, description,
                  /* detailed only: */ firstStop, lastStop, totalDistance, notes }
type TripTuple = [tripId: string /* slug, see §0.3 */, city: string, route: RouteTuple,
                  headsign: string /* can differ per stop, see below */,
                  brigade: string /* "" if none; Polish "brygada" = vehicle duty/block number */,
                  shortName: string /* train number e.g. "1306/7", else "" */,
                  description: [key: "operatedBy" | "note", value: string][]];
type TripTupleDetailed = [...TripTuple,
                  firstStop: [stopName: string, arrival: number /* epoch ms, scheduled */],
                  lastStop:  [stopName: string, departure: number /* epoch ms, scheduled */],
                  totalDistance: number /* metres */,
                  notes: RouteLegendEntry[] /* timetable notes applying to this trip */];
```
When a TripTuple comes from a departure board, `headsign` is the headsign valid at that stop, so a trip can change headsign mid-route.

Basic: `["520_dw-centralny25-04w5i_marysin03-5kmj8_25.09.2026_21.39","warsaw",["520",…],"Marysin","1","",[]]`
Detailed: `[…, ["Dw. Centralny",1790365140000], ["Marysin",1790367180000], 13384, []]`

### 2.5 `RouteLegendEntry` (timetable notes, object not tuple)
```ts
type RouteLegendEntry = {
  letter: string;         // single char shown in timetables, e.g. "M"
  kind: "skipsStops" | "endsAt" | "extendedTo" | "leavesTo" | "via" | "offTrunk";
  direction: number;      // 0/1, index into the route graph directions
  branch: number;         // index into that direction's branches, -1 = not a variant
  stops: StopTuple[];     // one or two (basic) stop tuples
};
```
What each kind means (the stops are called stopA and stopB):
- `skipsStops`: skips the stops between stopA and stopB.
- `endsAt`: terminates at stopA.
- `extendedTo`: runs to the end of the line and on to stopA.
- `leavesTo`: follows the line to stopA, then continues to stopB.
- `via`: takes a branch that leaves and rejoins the trunk, stopA..stopB.
- `offTrunk`: takes a branch that never touches the trunk.

The enum order (`ETripNote`) is 0..5 in the order listed. The API sends the string `kind`.

### 2.6 Other enums
```ts
enum StopDepartureStatus { Scheduled = 0, OnTrip = 1, OnPreviousTrip = 2, Cancelled = 3 }
```
- `Scheduled`: no live data. The delay is 0.
- `OnTrip`: live data for this very trip.
- `OnPreviousTrip`: the vehicle is still finishing an earlier trip of the same block. The delay is a prediction.
- `Cancelled`: the trip is cancelled.

The alight / boarding bitmask (`alight` fields) is `MASKS.AlightType`:
| bit | value | meaning |
|---|---|---|
| Regular | 1 | normal stop |
| Forbidden | 2 | no boarding/alighting |
| OnDemand | 4 | request stop ("na żądanie") |
| IsLastStop | 8 | last stop of the trip |
| BoardOnly | 16 | boarding only |
| AlightOnly | 32 | alighting only |

`CityCategory` (string values): `lowerSilesian, kuyavianPomeranian, lodz, lublin, lubusz, lesserPoland, masovian, opole, subcarpathian, podlasie, pomeranian, silesian, holyCross, warmianMasurian, greaterPoland, westPomeranian, finland, sweden, netherlands, ukraine, switzerland, iceland, virtual`.

Vehicle state (`VehicleState`: 0 Unknown, 1 OnTrip, 2 Finished, 3 OffRoute, 4 Stuck, 5 LostTrip) is internal and **not exposed** by any v6 endpoint.

### 2.7 `VehiclePositionTuple`
```ts
enum EVehiclePosition { id, city, route, brigade, location, bearing,
                        /* detailed only: */ timestamp, tripId, percentTraveled }
type VehiclePosition = [id: string /* vehicle id §0.3 */, city: string, route: RouteTuple,
                        brigade: string, location: Point, bearing: number | null /* degrees */];
type VehiclePositionDetailed = [...VehiclePosition,
                        timestamp: number /* epoch ms of the GPS fix */,
                        tripId: string | null /* trip slug */,
                        percentTraveled: number /* 0-100 along the current trip */];
```
Basic: `["3:7809","warsaw",["520","warsaw","520","Dw. Centralny — Marysin","default",3,"#bd0c00"],"2",[21.003536,52.230053],73]`
Detailed: `[…, 1790366341000, "520_dw-centralny25-04w5i_marysin03-5kmj8_25.09.2026_21.54", 0]`

### 2.8 `StopDepartureTuple` (departure boards)
```ts
enum EStopDepartureTuple { trip, vehicle, departure, destinationArrival, dwell }
enum EDeparture { scheduledDeparture, delay, status, platform, alight, departed }
enum EDestinationArrival { scheduledArrival, delay, status }
type StopDepartureTuple = [
  trip: TripTuple,                         // basic tuple, headsign as valid at this stop
  vehicle: VehiclePosition | null,         // vehicle assigned (by block), basic tuple
  departure: [scheduledDeparture: number /* epoch ms */, delay: number /* ms */,
              status: StopDepartureStatus, platform: string /* "" if none */,
              alight: number /* AlightType bitmask for this stop */, departed?: true],
  destinationArrival?: [scheduledArrival: number, delay: number /* ms, same as departure delay */, status],  // only with ?destinations=
  dwell?: number,                           // ms, only with ?minDwell=
];
```
The expected departure is `scheduledDeparture + delay`. `departed: true` appears only on the `before` entries (§3.2).

Sample:
```json
[["520_dw-centralny25-04w5i_marysin03-5kmj8_25.09.2026_21.39","warsaw",["520","warsaw","520","Dw. Centralny — Marysin","default",3,"#bd0c00"],"Marysin","1","",[]],
 ["3:7740","warsaw",["520",…],"1",[21.009402,52.229319],76],
 [1790365320000,983000,1,"",1]]
```

### 2.9 `ItineraryStopTuple` (stop list of a trip)
```ts
type ItineraryStop = [stop: StopTuple /* location = the stop's point projected on the shape */,
                      alight: number /* AlightType bitmask */, distance: number /* metres from trip start along the shape */,
                      platform: string, headsign: string /* headsign change from this stop on, "" = unchanged */];
type ItineraryTuple = [stops: ItineraryStop[], shape: string /* polyline6 of the whole trip */];
```

### 2.10 `TripStopTime` (live times per stop, SSE)
```ts
type TimePoint = [scheduled: number /* epoch ms */, delay: number /* ms */, status: StopDepartureStatus];
type TripStopTime = [arrival: TimePoint, departure: TimePoint];   // one per stop, same order as the itinerary
```

### 2.11 `AlertTuple` (service alerts)
```ts
enum EAlertTuple { title, description, url, publishedAt, activeFrom, activeUntil, language, detected }
type AlertTuple = [title: string, description: string /* Markdown */, url: string /* "" if none */,
                   publishedAt: number | null, activeFrom: number | null, activeUntil: number | null, /* epoch ms */
                   language: string /* ISO 639-1, e.g. "pl", "en", "fi" */,
                   detected: boolean /* true = auto-detected traffic jam alert (Polish text), not from the operator */];
```
**v6 has no "all alerts of a city" endpoint.** Alerts come only per trip (`/trips/:id`, the trip and position streams) and per route (the mapFeatures stream with `graph=1`).

### 2.12 `VehicleTuple` (fleet)
```ts
enum EVehicle { id, model, year, agency, url }
type VehicleTuple = [id: string /* vehicle id */, model: string, year: number, agency: string /* operator NAME, not id */, url: string /* phototrans/ilostan page */];
```
Live: `["3:7809","Autosan M18LF LNG",2022,"MZA Warszawa","15,845907,54.html"]`. Currently `url` can be relative to `https://phototrans.eu/`. Prefix it when it doesn't start with `http`.

### 2.13 Bike-share tuples
```ts
enum EBikeStationTuple { uid, number, name, location, domain }
type BikeStationTuple = [uid: number, number: number, name: string, location: Point, domain: string /* nextbike system code, e.g. "ap" */];
enum EBikeTuple { number, domain, type, battery }
type BikeTuple = [number: number, domain: string, type: number /* nextbike bike type id */, battery: number | null /* % for e-bikes */];
```

### 2.14 `BrigadeTuple`
```ts
enum EBrigadeTuple { brigade, tripCount, shifts }
type BrigadeTuple = [brigade: string, tripCount: number, shifts: [start: number, end: number][] /* epoch ms; split where a break > 3 h */];
```

### 2.15 `GraphPlacement`
```ts
enum EGraphPlacement { fromBranch, fromPosition, toBranch, toPosition, percent }
type GraphPlacement = [fromBranch: number /* -1 = trunk, else index in branches */, fromPosition: number,
                       toBranch: number, toPosition: number, percent: number /* 0-100 between the two */];
type VehiclePlacement = [vehicleId: string, city: string, placement: GraphPlacement];
```
When both nodes are equal, the vehicle is standing at that stop.

---

## 3. Stops

### 3.1 `GET /api6/:city/stops/search`
Query: `query` (a text search over stop *groups*, i.e. same-name clusters) and/or `lat` & `lon`.
- With a `query`: up to 20 groups, ranked. When `lat`/`lon` are also given, nearer groups get a proximity boost.
- With only `lat`/`lon`: the 5 nearest groups within 5 km.
- It also searches the city's virtual cities (e.g. pkp stations).

Response (no TTL): `StopGroup[]`, where `StopGroup = [groupName: string, location: Point, stops: StopTuple[] /* basic */]`.
Errors: `400 MISSING_QUERY`.
```json
[["Centrum",[21.011366,52.230221],[["centrum01-0fb5f","warsaw","Centrum","01",[21.011909,52.229076],[3],154],["centrum07-0esn2","warsaw","Centrum","07",[21.01148,52.230212],[0],160],["centruma13-0d4go","warsaw","Centrum","A13",[21.01021,52.23118],[1],null], …]], …]
```

### 3.2 `GET /api6/:city/stops/:stopId` (departure board, one-shot)
Query (all optional):
| param | meaning |
|---|---|
| `time` | epoch ms, board as of this time (default now) |
| `limit` | number of upcoming departures (default 20) |
| `before` | also include up to N already-departed ones (they get `departed: true`, sorted first) |
| `destinations` | comma-separated stop ids. Only trips that later call at one of them are kept, and each gets `destinationArrival` |
| `routes` | comma-separated **route ids**. Only these lines are kept |
| `minDwell` | seconds. Only trips that dwell at least that long at this stop are kept, and each gets `dwell` (ms) |

Departures are sorted by expected time (scheduled + delay). A departure stays listed until it has actually left, up to ~9 h late.

Response (no TTL): `{ stop: StopTupleDetailed, departures: StopDepartureTuple[] }`.
Errors: `404 STOP_NOT_FOUND`, `404 DESTINATION_STOP_NOT_FOUND`.
Prefer the SSE version (§8.2) for a live board.

### 3.3 `GET /api6/:city/stops/:stopId/meta`
Response: `{ stop: StopTupleDetailed }`. No TTL. Errors: `404 STOP_NOT_FOUND`.

### 3.4 `GET /api6/:city/stops/:stopId/directions`
The lines and directions leaving from this stop.
Response (TTL 15 min):
```ts
{ stop: StopTupleDetailed,
  directions: [route: RouteTuple, direction: number /* 0/1 index into /routes/:id graph */, headsign: string, terminus: boolean /* this stop is that direction's last stop */][] }
```
`[["175","warsaw","175","Pl. Piłsudskiego — Lotnisko Chopina","default",3,"#a5248c"],0,"Pl. Piłsudskiego",true]`

### 3.5 `GET /api6/:city/stops/:stopId/destinations`
Every stop reachable by a direct ride from this stop. Use it as the picker for the `destinations` filter.
Response (TTL 15 min): `StopTuple[]` (basic), sorted by name, then code.

### 3.6 `GET /api6/:city/stops/:stopId/timetable/:routeId`
The printed-style timetable of one line at one stop, covering all loaded service days (usually about 8 days ahead).
Response (TTL 15 min):
```ts
{ stop: StopTupleDetailed,
  timetable: Record<string /* date index, see §0.2 */, [tripRef: string /* "idx:n" */, departure: number /* scheduled epoch ms */, alight: number /* AlightType mask */, notes: string /* legend letters, e.g. "" or "MK" */][]>,
  legend: RouteLegendEntry[] }
```
Rows are sorted by departure. Open a row with `/trips/<tripRef>`.
```json
{"timetable":{"2459":[["idx:26850",1790305800000,1,""],["idx:26893",1790307240000,1,""], …], "2460":[…]},
 "legend":[{"letter":"M","kind":"endsAt","direction":0,"branch":-1,"stops":[["metro-politechnika08-0jxqd","warsaw","Metro Politechnika","08",[21.015484,52.218088],[3],359]]}, …]}
```
Errors: `404 STOP_NOT_FOUND`, `404 ROUTE_NOT_FOUND`.

### 3.7 `GET /api6/:city/dates[?route=<routeId>]`
Service days with at least one trip, for the whole city or for one route.
Response (TTL 15 min): `number[]`, a list of date indices (`[2459,2460,…,2466]`). Errors: `404 ROUTE_NOT_FOUND`.

---

## 4. Routes

### 4.1 `GET /api6/:city/routes`
Response (TTL 15 min): `RouteTuple[]`, all routes of the city plus the routes of virtual cities flagged for inclusion. The order is the storage order and is **not sorted**. Sort on the client, the way the backend does: `"default"` agency first, then by agency, then `routeType`, then by name with a numeric collator.
Warsaw returns 467 routes.

### 4.2 `GET /api6/:city/routes/search?query=`
Response (TTL 15 min): `RouteTuple[]` (≤ 50), ranked. It matches the name, words of the name, agency, and long name (typo-tolerant). Errors: `400 MISSING_QUERY`.

### 4.3 `GET /api6/:city/routes/nearby?lat=&lon=`
Routes serving stops within 700 m. Response (no TTL): `RouteTuple[]`, sorted default agency first, then agency, type and name. Errors: `400 MISSING_LOCATION`.

### 4.4 `GET /api6/:city/routes/:routeId` (details: graph + shapes)
`/routes/:routeId/graph` is a deprecated alias with the same response.
Response (TTL 15 min):
```ts
{
  route: RouteTuple,
  graph: Direction[],        // at most 2: [0] = most frequent direction, [1] = opposite
  shapes: string[][],        // shapes[d][0] = trunk polyline6, shapes[d][1+i] = polyline of graph[d].branches[i]
}
type Direction = {
  headsign: string,          // terminus name
  trunk: StopTuple[],        // basic tuples, the main stop sequence
  branches: {
    from: number,            // trunk position the variant leaves after; -1 = it starts off the trunk
    to: number,              // trunk position it rejoins at;              -1 = it ends off the trunk
    stops: StopTuple[],      // the variant's own stops (not on the trunk)
    collapse: [first: number, last: number] | null   // inclusive stop positions to hide by default (branches ≥ 4 stops)
  }[]
}
```
This is a line diagram. Draw the trunk as a vertical line and attach each branch from trunk position `from` to trunk position `to`. The backend sends no SVG. Express/short-turn variants that are a subset of the trunk are not branches; they appear only as timetable notes.
```json
{"route":["520","warsaw","520","Dw. Centralny — Marysin","default",3,"#bd0c00"],
 "graph":[{"headsign":"Dw. Centralny","trunk":[["marysin03-5kmj8","warsaw","Marysin","03",[21.155991,52.240382],[3],268], … 26 stops],
           "branches":[{"from":19,"to":-1,"stops":[[…1 stop…]],"collapse":null}, …]},
          {"headsign":"Marysin","trunk":[… 24 stops],"branches":[{"from":-1,"to":3,…},{"from":15,"to":-1,…},{"from":22,"to":-1,…}]}],
 "shapes":[["o`osbB_ngjg@d@rEzArClEj@…", "…", "…"], ["…","…","…","…"]]}
```
Errors: `404 ROUTE_NOT_FOUND`.

### 4.5 `GET /api6/:city/routes/:routeId/speed[?dayType=0|1|2&hour=0-23]`
Historical average speed per graph edge, from ClickHouse. `dayType` is 0 = weekday, 1 = Saturday, 2 = Sunday/holiday. The defaults are the current day type and the current Warsaw hour.
Response (TTL 10 min):
```ts
{ dayType: number, hour: number,
  speed: { trunk: (EdgeSpeed | null)[],            // trunk[i] = edge trunk[i] → trunk[i+1]
           branches: (EdgeSpeed | null)[][] }[] }  // per branch: [entry edge from trunk, …inner edges…, exit edge to trunk]; entry/exit null when from/to = -1
type EdgeSpeed = { avgSpeedKmh: number, medianSpeedKmh: number, avgDelayS: number /* s */, samples: number };
```
`null` means fewer than 5 samples. Errors: `404 ROUTE_NOT_FOUND`, `400 INVALID_DAY_TYPE`, `400 INVALID_HOUR`.

---

## 5. Trips

### 5.1 `GET /api6/:city/trips/:tripId`
`:tripId` is a trip slug or `idx:n`.
Response (no TTL):
```ts
{ trip: TripTuple,                      // basic
  stops: [...ItineraryStop, arrival: number, departure: number][],   // ItineraryStop (§2.9) + scheduled epoch ms
  shape: string,                        // polyline6 of the whole trip
  alerts: AlertTuple[] }
```
```json
{"trip":["520_dw-centralny25-04w5i_marysin03-5kmj8_25.09.2026_05.07","warsaw",["520",…],"Marysin","5","",[]],
 "stops":[[["dw-centralny25-04w5i","warsaw","Dw. Centralny","25",[21.003782,52.229358],[3],71],1,13,"","",1790305620000,1790305620000], …,
          [["marysin03-5kmj8","warsaw","Marysin","03",[21.156085,52.240409],[3],268],9,13384,"","",1790307660000,1790307660000]],
 "shape":"mkyrbBis}`g@cE{\\VsS…","alerts":[]}
```
Errors: `404 TRIP_NOT_FOUND`. This endpoint has no live delays; use the trip stream (§8.3).

### 5.2 `GET /api6/:city/trips/:tripId/summary`
Response (TTL 15 min): `TripTupleDetailed`.
```json
["520_dw-centralny25-04w5i_marysin03-5kmj8_25.09.2026_05.07","warsaw",["520",…],"Marysin","5","",[],["Dw. Centralny",1790305620000],["Marysin",1790307660000],13384,[]]
```

### 5.3 `GET /api6/:city/trips/search?query=`
It finds trips by line, train number or name, destination text, and an optional `HH:MM` first-departure time. Examples: `520 21:39`, `1307`, `Sztygar`, `Kraków`. It searches the city plus its virtual cities.
Response (TTL 15 min):
```ts
{ results: { trip: TripTupleDetailed /* next service day's run, else the last one */,
             days: [date: number /* date index */, tripRef: string /* "idx:n" */][] }[],   // ≤ 50
  truncated: boolean }
```
```json
{"results":[{"trip":["ICeip_warszawa-wschodnia-1v9oy_krakow-glowny-xuxpa_25.09.2026_15.29","pkp",["ICeip","pkp","EIP","Bielsko-Biała Główna — Gdynia Główna","IC",2,"#3959ad"],"Kraków Główny","","1306/7",[],["Warszawa Wschodnia",1790342940000],["Kraków Główny",1790351940000],296771,[{"letter":"K","kind":"leavesTo",…}]],
  "days":[[2458,"idx:4043"],[2459,"idx:4044"], …]}],"truncated":false}
```
Errors: `400 MISSING_QUERY`.

---

## 6. Brigades (vehicle duties / blocks)

### 6.1 `GET /api6/:city/brigades/:routeId/:date`
`:date` is a **date index** (§0.2).
Response (TTL 60 min): `BrigadeTuple[]`.
`[["1",22,[[1790305560000,1790372580000]]],["08",9,[[1790311080000,1790319420000],[1790336760000,1790354700000]]], …]`
Errors: `400 INVALID_DATE`, `404 ROUTE_NOT_FOUND`.

### 6.2 `GET /api6/:city/brigades/:routeId/:brigade/:date`
Response (TTL 60 min): `TripTupleDetailed[]`, the trips of that duty on that day in order. The list can include trips of other lines when the duty interlines. It returns `[]` when nothing is found. Errors: as in §6.1.

---

## 7. Vehicles: live positions and fleet

### 7.1 `GET /api6/:city/positions/search?query=`
It searches **live** vehicles. The query matches the vehicle number (`.` is a single-character wildcard), the route name or id, or `route/brigade` (e.g. `520/2`).
Response (no TTL): `[position: VehiclePosition, headsign: string, model: string /* "" if unknown */][]`. Errors: `400 MISSING_QUERY`.
`[[["3:7809","warsaw",["520",…],"2",[21.003536,52.230053],73],"Marysin","Autosan M18LF LNG"], …]`

### 7.2 `GET /api6/:city/positions/vehicle/:vehicleId`
`:vehicleId` is either a full id (`3:7809`) or a bare fleet number (`7809`).
Response: `[VehiclePosition | null, headsign: string, model: string]`. The position is `null` when the vehicle is known from the fleet but is not live now.
Errors: `404 VEHICLE_NOT_FOUND`.

### 7.3 Fleet database (static; from phototrans.eu / ilostan)
| endpoint | response |
|---|---|
| `GET /api6/:city/vehicles/vehicle/:vehicleId` | `VehicleTuple`, or `404 VEHICLE_NOT_FOUND`. Live, `3:default_7809` was not found, so use the canonical id `3:7809`. |
| `GET /api6/:city/vehicles/search?query=` | `VehicleTuple[]` whose number has exactly the query's length (`.` = wildcard), e.g. `78..`. `400 MISSING_QUERY`. |
| `GET /api6/:city/vehicles/models[?query=]` | `string[]` of model names (a trigram search when `query` is given). |
| `GET /api6/:city/vehicles/model/:modelName` | `VehicleTuple[]` of that model, or `404 MODEL_NOT_FOUND`. URL-encode the name. |

None of these set a TTL.

### 7.4 Bike-share station: `GET /api6/bikes/station/:uid` (no city segment)
Response:
```ts
{ uid: number, number: number, name: string, location: Point, domain: string,
  bikes: [number, domain, type, battery: number|null, rentals: number /* historical count */, medianRentalS: number|null /* seconds */][] }
```
Errors: `404 STATION_NOT_FOUND`, `503 BIKES_UNAVAILABLE`. Station uids come from the planner (`rentStation` / `returnStation`). **There is no "list stations in bbox" endpoint in v6.**

---

## 8. Live streams (Server-Sent Events)

### 8.1 How streams work
- These are plain SSE over GET, so use `new EventSource(url)`. With credentials the CORS headers above already allow it; `withCredentials` isn't needed.
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`.
- The first frame is `retry: <4000–12000>`, the randomised reconnect delay that `EventSource` honours automatically.
- **Event types** (use `addEventListener(type, …)`, not `onmessage` only):
  - `initial`: `data` is JSON, static context. It is sent once at open, and again when the context changes (trip or headsign change).
  - `message`: `data` is JSON, the live update. It is pushed whenever the city's realtime data updates (every 10–30 s depending on the city). **Identical consecutive messages are suppressed**, so silence means nothing changed.
  - `errorCode`: fatal. **The server closes the stream after it, so call `es.close()` to stop EventSource reconnecting.** The payload format varies: errors raised **before** the stream starts (`STOP_NOT_FOUND`, `TRIP_NOT_FOUND`, `DESTINATION_STOP_NOT_FOUND`, `FILTER_ROUTES_REQUIRED`) are sent as a **bare string** (`data: TRIP_NOT_FOUND`), while errors raised mid-stream (`POSITION_NOT_FOUND`) are **JSON strings** (`data: "POSITION_NOT_FOUND"`). Strip quotes before comparing, e.g. `e.data.replace(/"/g,"")`.
- Heartbeat: an SSE comment line `:` after 25 s of silence.
- Hard limit: a stream is closed after **2 h**. EventSource reconnects on its own.
- A stream for a non-existent city returns the JSON 404 `CITY_NOT_FOUND`, not SSE, so EventSource fires `onerror`.

Example:
```js
const es = new EventSource(`${BASE}/warsaw/stops/centrum01-0fb5f/stream?limit=10`);
es.addEventListener("initial", e => setStop(JSON.parse(e.data)));
es.addEventListener("message", e => setDepartures(JSON.parse(e.data)));
es.addEventListener("errorCode", e => { es.close(); showError(e.data.replace(/"/g, "")); });
```

### 8.2 Stop departures: `GET /api6/:city/stops/:stopId/stream`
Query: the same as §3.2 (`time`, `limit`, `before`, `destinations`, `routes`, `minDwell`). Without `time`, each update is computed for "now".
- `initial`: `StopTupleDetailed`.
- `message`: `StopDepartureTuple[]`.
- `errorCode`: `STOP_NOT_FOUND` or `DESTINATION_STOP_NOT_FOUND`.

### 8.3 Trip: `GET /api6/:city/trips/:tripId/stream`
- `initial` (sent at open and whenever the headsign changes mid-trip): `{ trip: TripTuple /* basic, headsign as of current stop */, itinerary: ItineraryTuple }`.
- `message`:
  ```ts
  { position: VehiclePositionDetailed | null,  // null when no vehicle is assigned
    stops: TripStopTime[],                     // live arrival/departure per stop (§2.10)
    sequence: number,                          // index of the next stop / the stop the vehicle is at; = stops.length when finished
    alerts?: AlertTuple[] }                    // present only when the set changed (the first message always has it); omitted = unchanged
  ```
- `errorCode`: `TRIP_NOT_FOUND`.
```
event: message
data: {"position":["3:7809","warsaw",["520",…],"2",[21.003108,52.22993],13,1790366341000,"520_dw-centralny25-04w5i_marysin03-5kmj8_25.09.2026_21.54",0],"stops":[[[1790366040000,301000,1],[1790366040000,301000,1]],[[1790366220000,301000,1],[1790366220000,301000,1]], …],"sequence":0,"alerts":[]}
```

### 8.4 Vehicle: `GET /api6/:city/positions/:vehicleId/stream[?details=false]`
`:vehicleId` is a full vehicle id (`3:7809`, URL-encode the `:` if your router needs it).
- Vehicle live on a trip:
  - `initial` is `{ trip: TripTuple, itinerary: ItineraryTuple }`. It is resent when the vehicle changes trip or headsign; with `details=false` it contains only `{ trip }`.
  - `message` is `{ position: VehiclePositionDetailed, stops: TripStopTime[], sequence: number, alerts?: AlertTuple[] }`. With `details=false` it contains only `{ position }`.
- Vehicle live with no trip: `message` = `{ position: VehiclePosition /* basic */, alerts?: [] }`.
- `errorCode`: `"POSITION_NOT_FOUND"` (JSON-quoted). This is sent when the vehicle disappears or never existed, and the stream closes.

### 8.5 Map: `GET /api6/:city/mapFeatures/:zoom/:bounds/stream`
- `:zoom` is the map zoom (float OK). `:bounds` is `minLon,minLat,maxLon,maxLat`. `0/0,0,0,0` means "whole city, no viewport".
- **Bounds are fixed per connection. Reopen the stream (debounced) when the viewport changes.** It includes the city's virtual cities (e.g. pkp trains on the Warsaw map).
- Query:
  - `filterRoutes`: comma-separated route ids.
  - `filterModels`: comma-separated vehicle model names.
  - `filterDirection`: `0` or `1`.
  - `graph=1`: route-diagram mode. It **requires `filterRoutes`**, otherwise `errorCode FILTER_ROUTES_REQUIRED`.
- `initial` (once, at open): `{ stops: StopTuple[] /* basic, in bounds; [] when zoom < 14.5 or no viewport */, suggestedCity?: string /* another city's id when the viewport centre lies inside it (zoom ≥ 12), omitted otherwise */ }`.
- `message`:
  ```ts
  { positions: VehiclePosition[],          // basic tuples; [] when dots are used
    dots: [color: string, location: Point][],   // lightweight markers instead of positions, see rule below
    bbox?: [minLon, minLat, maxLon, maxLat],     // extent of the returned vehicles; omitted when none
    placements?: VehiclePlacement[],       // graph=1 only: where each vehicle sits on the /routes/:id graph (§2.15)
    alerts?: AlertTuple[] }                // graph=1 only: alerts of the filtered routes, sent when changed
  ```
  Dots are used instead of full positions when `graph≠1` and either (a) a viewport is given, zoom ≤ 14.5 and more than 40 vehicles are in view, or (b) more than 150 vehicles are in view. Only vehicles with a route or trip are included.

Samples:
```
# /warsaw/mapFeatures/16/21.005,52.227,21.015,52.232/stream
event: initial
data: {"stops":[["centrum01-0fb5f","warsaw","Centrum","01",[21.011909,52.229076],[3],154],["hoza03-0gzbl","warsaw","Hoża","03",[21.013243,52.227265],[0],160], …]}
event: message
data: {"positions":[["0:4117","warsaw",["18","warsaw","18","Żerań FSO — PKP Służewiec","default",0,"#bd0c00"],"10",[21.013046,52.227043],168], …],"dots":[],"bbox":[21.00626,52.227043,…]}

# /warsaw/mapFeatures/12/20.8,52.1,21.2,52.35/stream  → 1078 dots
data: {"positions":[],"dots":[["#4a51c6",[21.018385,52.105]],["#086d00",[21.018548,52.113168]], …],"bbox":[20.807396,52.102618,21.196624,…]}

# /warsaw/mapFeatures/0/0,0,0,0/stream?filterRoutes=520&graph=1
data: {"positions":[["3:3460","warsaw",["520",…],"5",[21.15597,52.240379],334], …],"dots":[],"bbox":[…],
       "placements":[["3:3460","warsaw",[-1,0,-1,0,0]],["3:7824","warsaw",[-1,8,-1,9,73]]],"alerts":[]}
```

---

## 9. Global search

### `GET /api6/:city/search?query=[&raw=true]`
It searches, in this order: live vehicles, stops of the city, PKP rail stations, routes of the city (≤ 5), and PKP train relations (the train number or name; the query must be at least 3 chars).
The result item types:
```ts
type SearchVehicle  = [vehicleId: string, route: RouteTuple, brigade: string, headsign: string | null, model: string | null];
type SearchStop     = [firstStopId: string, city: string, groupName: string, stops: StopTupleDetailed[]];   // query ≥ 2 chars
type SearchStation  = [stopId: string, "pkp", name: string];
type SearchRoute    = RouteTuple;
type SearchRelation = [tripRef: string /* idx:n in city "pkp" */, route: RouteTuple, shortName: string, departure: number, arrival: number /* epoch ms */, headsign: string];
```
- `raw=true` returns `{ positions: SearchVehicle[], stops: SearchStop[], stations: SearchStation[], routes: RouteTuple[], relations: SearchRelation[] }`.
- Without `raw`, the response is a flat list for a sectioned UI:
  ```ts
  { results: ({ vehicle?: SearchVehicle; stop?: SearchStop; station?: SearchStation; route?: RouteTuple; relation?: SearchRelation;
               borderTop?: true; borderBottom?: true })[],   // first / last item of its section
    groups: number[],           // item count per non-empty section
    groupNames: string[] }      // "vehicles" | "stops" | "stations" | "routes" | "relations", same order
  ```
- Errors: `400 MISSING_QUERY`. No TTL.

Samples:
```json
{"results":[{"vehicle":["3:7740",["520","warsaw","520","Dw. Centralny — Marysin","default",3,"#bd0c00"],"1","Marysin","Solaris Urbino 18 CNG"],"borderTop":true}, …,
            {"route":["520","warsaw","520",…],"borderTop":true,"borderBottom":true}],
 "groups":[7,1],"groupNames":["vehicles","routes"]}
```
`?query=1307&raw=true` gives `relations: [["idx:4044",["ICeip","pkp","EIP","Bielsko-Biała Główna — Gdynia Główna","IC",2,"#3959ad"],"1306/7",1790342940000,1790351940000,"Kraków Główny"]]`.

---

## 10. Trip planner

Places are `"lon,lat"` strings (**lon first**), e.g. `fromPlace=21.0122,52.2297`. The planner is in-process RAPTOR. It can return `503 ROUTER_UNAVAILABLE` or `504 ROUTER_TIMEOUT`.

### 10.1 `GET /api6/:city/plan`
Query:
| param | meaning |
|---|---|
| `fromPlace`, `toPlace` | required, `"lon,lat"` |
| `time` | **ISO-8601 string** parsed by `Date.parse`, e.g. `2026-09-25T22:00:00+02:00`. **Epoch numbers do NOT work** (they become NaN). Default now. |
| `isArrivalTime` | `"true"` = `time` is an arrive-by deadline. The list is then ordered latest departure first. |
| `timeTolerance` | minutes (0–120). The page starts that much earlier (or later for arrive-by). |
| `pageCursor` | a `previousPageCursor` / `nextPageCursor` value from the previous response. It overrides `time` and `isArrivalTime`. |
| `ownBike` | `"true"`: the rider has their own bike (first mile, or last mile with `bikeAt`) |
| `bikeAt` | `"lon,lat"` where the own bike is parked |
| `maxBikeTime` | minutes (≤ 120). The own-bike reach, or the cap on one rental ride. The app sends 20. |
| `rentalBikes` | `"true"`: bike-share rides are allowed |
| `pedestrianSpeed` | m/s |

Response (no TTL):
```ts
{ maxPreTransitTime: number,    // s, the walk budget used from the origin
  maxPostTransitTime: number,   // s, and to the destination
  previousPageCursor: string,   // base64url, earlier journeys
  nextPageCursor: string,       // later journeys
  itineraries: {
    key: string,                // opaque base64url, the input of every /plan/* endpoint below
    startTime: number, endTime: number,      // epoch ms, scheduled
    legs: ({ mode: "WALK" | "BIKE" | "OWN_BIKE", duration: number /* s */ }
          | { mode: "TRANSIT", route: RouteTuple, duration: number /* s */ })[]
  }[] }
```
Itineraries are sorted by departure. The response lists every Pareto-optimal journey in the departure window, and the same line repeats for each of its departures. `BIKE` is a rental bike; `OWN_BIKE` is the rider's own bike.
Errors: `400 MISSING_FROM_OR_TO`, `400 INVALID_CURSOR`, 503, 504.
```json
{"maxPreTransitTime":1923,"maxPostTransitTime":1923,"previousPageCursor":"opUI-QCQ7IKiDXpCAA","nextPageCursor":"hNLAxACQ3MykDXpCAg",
 "itineraries":[{"key":"5ARIcAIAwLXIog16QgBJAADonkABRPYc…","startTime":1790366747484,"endTime":1790368097484,
   "legs":[{"mode":"WALK","duration":73},{"mode":"TRANSIT","route":["7","warsaw","7","Banacha — Kawęczyńska - Bazylika","default",0,"#bd0c00"],"duration":660},
           {"mode":"WALK","duration":221},{"mode":"TRANSIT","route":["202",…],"duration":240},{"mode":"WALK","duration":138}]}, …]}
```

### 10.2 `GET /api6/:city/plan/details?key=`
The geometry and stops for one itinerary. The data is static; live data is in §10.3.
```ts
{ startTime: number, endTime: number,
  legs: (StreetLeg | BikeLeg | TransitLeg)[],
  transfers: { fromLeg: number, toLeg: number, stops: StopTuple[], suggested: number, current: number }[] }
     // optional hint: a better stop to change between two lines on a shared corridor (indexes into stops)
type StreetLeg = { mode: "WALK" | "OWN_BIKE" | "BIKE", polyline: string, distance: number /* m */, duration: number /* s */,
                   exit: StopEntranceTuple | null,      // station entrance left through
                   entrance: StopEntranceTuple | null } // station entrance entered through
type BikeLeg = StreetLeg & { mode: "BIKE", rentStation: BikeStationTuple | null, returnStation: BikeStationTuple | null };
type TransitLeg = { mode: "TRANSIT", trip: TripTuple | null /* null if the timetable changed under the key */,
                    stops: StopTuple[] /* board … alight */, polyline: string,
                    departure: number, arrival: number /* scheduled epoch ms */, duration: number /* s */ };
```
Walk durations here are recomputed on the real street path, so they can differ slightly from the summary.
Errors: `400 MISSING_KEY`, `400 INVALID_KEY`.
```json
{"startTime":1790366747484,"endTime":1790368097484,"legs":[
 {"mode":"WALK","polyline":"gczrbBomnag@qQcGvIkA…","distance":124,"duration":95,"exit":null,"entrance":null},
 {"mode":"TRANSIT","trip":["7_banacha05-z2v1e_kaweczynska-bazylika02-24npi_25.09.2026_21.50","warsaw",["7",…],"Kawęczyńska - Bazylika","1","",[]],
  "stops":[["centrum09-0ea49","warsaw","Centrum","09",[21.011146,52.229687],[0],71], …,["krucza05-0kgcj",…]],"polyline":"abzrbByklag@…","departure":1790366820000,"arrival":1790367480000,"duration":660}, …],
 "transfers":[]}
```

### 10.3 `GET /api6/:city/plan/realtime?key=[&leg=<i>&trip=<tripRef>]`
The live state of an itinerary. Poll it; there is no SSE for this.
```ts
{ key: string,               // same as input, or the NEW key after a re-time (see below)
  startTime: number, endTime: number,
  legs: ({ mode: "WALK" | "OWN_BIKE" }
       | { mode: "BIKE", rentBikes: BikeTuple[] | null, returnBikes: BikeTuple[] | null }
       | { mode: "TRANSIT", departures: StopDepartureTuple[] /* ≤ 20 departures from the boarding stop that reach the alighting stop, any line, −10…+90 min around the plan; each has destinationArrival */,
           selected: number /* index of the planned ride in departures, -1 if absent */ })[] }
```
Re-time: pass `leg` (the leg index) together with `trip` (the chosen departure's `TripTuple[0]` slug or `idx:n`). The journey is then re-planned around that ride, and the response `key` is the new key to use from then on.
Errors: `400 MISSING_KEY`, `400 MISSING_LEG_OR_TRIP` (only one of the two was given), `400 INVALID_KEY | INVALID_LEG | INVALID_TRIP`, `404 TRIP_NOT_FOUND | NO_CONNECTION`.

### 10.4 Batch helpers (take `keys=<k1>,<k2>,…`, max 30)
Every response is an array aligned with `keys`; an entry is `null` when that key is invalid or has no data. Errors: `400 MISSING_KEYS`, `400 TOO_MANY_KEYS`.
| endpoint | entry shape |
|---|---|
| `GET /plan/etas` | `{ leaveTime: number, arrivalTime: number /* epoch ms, realtime-adjusted */, realtimeCoverage: number /* % of transit legs with live data */ }` |
| `GET /plan/travel` | `{ legs: ({ scheduledS, typicalS, p85S, samples, confidence /* 0-1 */ } \| null)[] /* per leg, null for walks */, typicalDelayS, p85DelayS, confidence }` (historical ride times) |
| `GET /plan/reliability` | `{ origin: StopReliability \| null, destination: StopReliability \| null }`, where `StopReliability = { route: string, samples, onTimePct, earlyPct, latePct, avgDelay, medianDelay, p85Delay /* s */ }` |
| `GET /plan/confidence` | `{ confidence: number \| null /* 0-1 chance all transfers hold */, coverage: number, transfers: { city, stopIdx, bufferS, pHold: number \| null, samples }[] }` |

Live samples for one key: etas `[{"leaveTime":1790366670000,"arrivalTime":1790368097000,"realtimeCoverage":100}]`; travel `[{"legs":[null,{"scheduledS":660,"typicalS":661,"p85S":763,"samples":102,"confidence":1},null,{…},null],"typicalDelayS":80,"p85DelayS":254,"confidence":1}]`; reliability `[null]`; confidence `[{"confidence":0.913,"coverage":1,"transfers":[{"city":"warsaw","stopIdx":1783,"bufferS":19,"pHold":0.913,"samples":396}]}]`.

### 10.5 `GET /api6/:city/plan/eta?fromPlace=&toPlace=[&time=ISO]`
A quick "how long to get home" estimate: the single earliest-arrival journey.
Response: `{ leaveTime: number, arrivalTime: number /* epoch ms */, duration: number /* s from the asked time */, transfers: number }`.
Errors: `404 NO_JOURNEY`, 400, 503, 504.
Live: `{"leaveTime":1790366747484,"arrivalTime":1790368097570,"duration":1620,"transfers":1}`.

### 10.6 Street routes
- `GET /plan/walk?fromPlace=&toPlace=[&pedestrianSpeed=m/s]` returns `{ fastest: StreetRoute | null, mainRoads: StreetRoute | null }`.
- `GET /plan/bike?fromPlace=&toPlace=` returns `{ fastest, safe, quiet }` (each a `StreetRoute | null`).
- `GET /plan/bike/rental?fromPlace=&toPlace=[&pedestrianSpeed=]` plans a bike-share trip door to door. It returns `{ rentStation: BikeStationTuple, returnStation: BikeStationTuple, walkIn: StreetRoute|null, ride: { fastest, safe, quiet }, walkOut: StreetRoute|null }`, and `404 NO_STATION` when no station is within 1.5 km, `503 BIKES_UNAVAILABLE`.

Common errors: `400 MISSING_FROM_OR_TO`, `400 TOO_FAR` (> 60 km straight line), `503 GRAPH_UNAVAILABLE`.
```ts
type StreetRoute = { distance: number /* m */, duration: number /* s */, polyline: string, steps: StreetStep[] };
enum EStreetStep { maneuver, name, distance, duration, from, count, wayClass, flags, exit }
type StreetStep = [maneuver: "start"|"continue"|"slightLeft"|"left"|"sharpLeft"|"slightRight"|"right"|"sharpRight"|"uTurn"|"roundabout"|"arrive",
                   name: string /* street name, "" if unnamed */, distance: number /* m */, duration: number /* s */,
                   from: number /* index of first polyline point */, count: number /* points in step */,
                   wayClass: "other"|"motorway"|"trunk"|"primary"|"secondary"|"tertiary"|"unclassified"|"residential"|"livingStreet"|"service"|"pedestrian"|"footway"|"steps"|"path"|"track"|"cycleway",
                   flags: number /* bitmask: 1 protected (cycle infra), 2 lane, 4 calm street, 8 sidewalk, 16 lit, 32 green */,
                   exit: number /* roundabout exit number, 0 otherwise */];
```
Live samples:
- Walk: `["start","",23,17,0,10,"footway",16,0]`.
- Bike: `["start","Rondo Romana Dmowskiego",57,10,0,11,"secondary",24,0]`.
- Rental station: `[2585477,9522,"Marszałkowska - Hoża",[21.013571,52.226288],"ap"]`.

### 10.7 `GET /api6/:city/travel-time?via=<stopId>,<stopId>,…[&time=epochMs]`
Historical ride time along 2–30 consecutive stops. Here `time` is an **epoch ms number**, not ISO.
```ts
{ time, dayType: 0|1|2, hour, totalScheduledS, totalTypicalS, totalP85S, confidence,
  segments: ({ from: string, to: string, scheduledS, typicalS, p85S, samples, confidence } | { from, to, error: "NO_MATCH" })[] }
```
Errors: `400 MISSING_VIA`, `400 INVALID_VIA`, `404 STOP_NOT_FOUND`.

---

## 11. History and statistics (ClickHouse; can be slow, ~0.1–2 s)

| endpoint | response | TTL |
|---|---|---|
| `GET /api6/:city/history/trip/:tripId` | `[date: number /* date index */, delay: number /* s at the terminus */][]` for the last 30 days of this scheduled run. Errors: `404 TRIP_NOT_FOUND`, `400 TRIP_TOO_SHORT`. | 5 min |
| `GET /api6/:city/history/departures/:stopId/:routeId/:date` (`YYYY-MM-DD`) | `{ today: number[24], history: number[24] }`: departures per local hour on that date, and the average of the same weekday over the 4 prior weeks. `:routeId` is the route id. | none |
| `GET /api6/:city/history/jams/:date/:bucket[?minSamples=1..1000]` (`YYYY-MM-DD`, bucket 0–95 = 15-min slot of the local day) | `{ bucket, segments: [extraSeconds: number, polyline: string][] }`: stop-to-stop segments slower (+) or faster (−) than scheduled. Errors: `INVALID_BUCKET`, `INVALID_DATE`. | none |
| `GET /api6/:city/history/punctuality/:month[?thresholds=2,5,10]` (`YYYY-MM`, thresholds in minutes, ascending) | `{ month, thresholds, agencies: { agency: string, stops: number /* stop calls */, totalAbsDelay: number /* s */, buckets: { threshold0: n /* ≤ t0 */, threshold1: n /* t0<…≤t1 */, …, thresholdN: n /* > last */ } }[] }`. Errors: `INVALID_MONTH`, `INVALID_THRESHOLDS`. | none |

Samples: history/trip `[[2429,-90],[2430,10],[2431,50], …]`; history/departures `{"today":[0,0,0,0,0,6,10,12,10,8,…],"history":[0,0,0,0,0,3,5,6,5,…]}`.

### Dispatch log (which vehicle ran which trip)
| endpoint | response | TTL |
|---|---|---|
| `GET /api6/:city/dispatches/autocomplete` | `{ routes: RouteTuple[], vehicles: string[] /* fleet numbers */ }` | 10 min |
| `GET /api6/:city/dispatches/autocomplete?route=<routeId>` | `{ brigades: string[] }` | 10 min |
| `GET /api6/:city/dispatches/dates?route=…\|vehicle=…[&brigade=]` | `string[]` of `YYYY-MM-DD`, newest first. `400 MISSING_FILTER`. | 10 min |
| `GET /api6/:city/dispatches?date=YYYY-MM-DD&(route=…\|vehicle=…)[&brigade=]` | `DispatchRow[]` (below). `400 MISSING_FILTER`, `400 INVALID_DATE`. | 2 min |
| `GET /api6/:city/dispatches/trip?trip=<DispatchRow[0]>&date=YYYY-MM-DD[&vehicle=]` | `{ stops: [stopId: string /* "" if unknown */, label: string /* "name code" */, scheduledArrival: number, actualArrival: number /* epoch ms */, delay: number /* s */][] }`. `400 MISSING_TRIP`, `400 INVALID_DATE`. | 2 min |

```ts
type DispatchRow = [trip: string /* its own id format, e.g. "520_metro-politechnika12_plowiecka03_24.09.2026_00.03" — not a /trips slug */,
  routeId: string, brigade: string, vehicle: string /* fleet number */,
  originStopId: string, originName: string, destStopId: string, destName: string,
  scheduledStart: number, actualStart: number, startDelay: number /* s */,
  scheduledEnd: number, actualEnd: number, endDelay: number /* s */, segments: number];
```
Live: `["520_metro-politechnika12_plowiecka03_24.09.2026_00.03","520","6","7870","metro-politechnika12-0jxqk","Metro Politechnika","plowiecka03-4hefz","Płowiecka",1790200946000,1790200996000,50,1790202365000,1790202355000,-10,14]`

---

## 12. Other endpoints (FYI)

- `GET /api6/:city/seo/poi` (TTL 24 h): `[poiName, location: Point, lines: [RouteTuple, otherPoiIndexes: number[]][]][]`. These are notable POIs and the frequent lines near them, for SEO landing pages. It can return `404 CITY_BBOX_MISSING` or `503 OSR_UNAVAILABLE | POI_RANKS_MISSING`.
- `/api6/admin/*` and `/api6/connections/*` are auth-protected internal tools (WebAuthn / session cookies). **They are not for the public SPA.**
- The open-data API lives at `https://api.zbiorkom.live/api6-open/…`, with GTFS/NeTEx/SIRI/GTFS-RT exports, `/:city/stops`, `/:city/positions/:bbox`, and an OpenAPI spec at `/api6-open` (docs page `/api6-open/docs`). Its CORS is `*` without credentials. The SPA doesn't need it.

---

## 13. Quick cheat sheet

```
GET  /api6                                          city list (+hash)
GET  /api6/:city/stops/search?query=|lat=&lon=       stop groups
GET  /api6/:city/stops/:stop[?time&limit&before&destinations&routes&minDwell]   departures (one-shot)
SSE  /api6/:city/stops/:stop/stream[?same]          initial=StopDetailed, message=StopDepartureTuple[]
GET  /api6/:city/stops/:stop/meta | /directions | /destinations
GET  /api6/:city/stops/:stop/timetable/:route       per-day rows + legend
GET  /api6/:city/dates[?route=]                     date indices with service
GET  /api6/:city/routes | /routes/search?query= | /routes/nearby?lat=&lon=
GET  /api6/:city/routes/:route                      {route, graph, shapes}
GET  /api6/:city/routes/:route/speed[?dayType&hour]
GET  /api6/:city/trips/:trip | /trips/:trip/summary | /trips/search?query=
SSE  /api6/:city/trips/:trip/stream                 initial={trip,itinerary}, message={position,stops,sequence,alerts?}
SSE  /api6/:city/positions/:vehicleId/stream[?details=false]
SSE  /api6/:city/mapFeatures/:zoom/:minLon,minLat,maxLon,maxLat/stream[?filterRoutes&filterModels&filterDirection&graph=1]
GET  /api6/:city/positions/search?query= | /positions/vehicle/:id
GET  /api6/:city/vehicles/vehicle/:id | /vehicles/search?query= | /vehicles/models[?query=] | /vehicles/model/:name
GET  /api6/:city/brigades/:route/:dateIdx | /brigades/:route/:brigade/:dateIdx
GET  /api6/:city/search?query=[&raw=true]
GET  /api6/:city/plan?fromPlace=lon,lat&toPlace=lon,lat[&time=ISO&isArrivalTime&pageCursor&ownBike&bikeAt&maxBikeTime&rentalBikes&pedestrianSpeed&timeTolerance]
GET  /api6/:city/plan/details?key= | /plan/realtime?key=[&leg&trip] | /plan/eta
GET  /api6/:city/plan/etas|travel|reliability|confidence?keys=k1,k2
GET  /api6/:city/plan/walk | /plan/bike | /plan/bike/rental ?fromPlace&toPlace
GET  /api6/:city/travel-time?via=s1,s2,…[&time=ms]
GET  /api6/bikes/station/:uid
GET  /api6/:city/history/trip/:trip | /history/departures/:stop/:route/:YYYY-MM-DD | /history/jams/:YYYY-MM-DD/:bucket | /history/punctuality/:YYYY-MM
GET  /api6/:city/dispatches/autocomplete | /dispatches/dates | /dispatches | /dispatches/trip
```
