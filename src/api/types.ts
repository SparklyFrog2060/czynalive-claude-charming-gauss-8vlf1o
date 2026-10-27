export type Point = [lon: number, lat: number];

export enum RouteType {
    Tram = 0,
    Subway = 1,
    Rail = 2,
    Bus = 3,
    Ferry = 4,
    AerialLift = 6,
    Funicular = 7,
    Trolleybus = 11,
    Monorail = 12,
}

export enum ERouteTuple { routeId, city, routeName, routeLongName, routeAgency, routeType, routeColor }
export type RouteTuple = [routeId: string, city: string, routeName: string, routeLongName: string, routeAgency: string, routeType: RouteType, routeColor: string];

export enum EStopTuple { stopId, city, stopName, stopCode, location, vehicleTypes, bearing, direction, routes, entrances }
export type StopTuple = [stopId: string, city: string, stopName: string, stopCode: string, location: Point, vehicleTypes: RouteType[], bearing: number | null];
export type StopEntranceTuple = [name: string, location: Point];
export type StopTupleDetailed = [...StopTuple, direction: string, routes: RouteTuple[], entrances: StopEntranceTuple[]];
export type StopGroup = [groupName: string, location: Point, stops: StopTuple[]];

export type RouteLegendEntry = {
    letter: string;
    kind: "skipsStops" | "endsAt" | "extendedTo" | "leavesTo" | "via" | "offTrunk";
    direction: number;
    branch: number;
    stops: StopTuple[];
};

export enum ETripTuple { tripId, city, route, headsign, brigade, shortName, description, firstStop, lastStop, totalDistance, notes }
export type TripDescription = [key: "operatedBy" | "note", value: string][];
export type TripTuple = [tripId: string, city: string, route: RouteTuple, headsign: string, brigade: string, shortName: string, description: TripDescription];
export type TripTupleDetailed = [
    ...TripTuple,
    firstStop: [stopName: string, time: number],
    lastStop: [stopName: string, time: number],
    totalDistance: number,
    notes: RouteLegendEntry[],
];

export enum StopDepartureStatus { Scheduled = 0, OnTrip = 1, OnPreviousTrip = 2, Cancelled = 3 }

export const ALIGHT = { Regular: 1, Forbidden: 2, OnDemand: 4, IsLastStop: 8, BoardOnly: 16, AlightOnly: 32 } as const;

export enum EVehiclePosition { id, city, route, brigade, location, bearing, timestamp, tripId, percentTraveled }
export type VehiclePosition = [id: string, city: string, route: RouteTuple, brigade: string, location: Point, bearing: number | null];
export type VehiclePositionDetailed = [...VehiclePosition, timestamp: number, tripId: string | null, percentTraveled: number];

export enum EStopDepartureTuple { trip, vehicle, departure, destinationArrival, dwell }
export enum EDeparture { scheduledDeparture, delay, status, platform, alight, departed }
export enum EDestinationArrival { scheduledArrival, delay, status }
export type DepartureInfo = [scheduledDeparture: number, delay: number, status: StopDepartureStatus, platform: string, alight: number, departed?: true];
export type StopDepartureTuple = [
    trip: TripTuple,
    vehicle: VehiclePosition | null,
    departure: DepartureInfo,
    destinationArrival?: [scheduledArrival: number, delay: number, status: StopDepartureStatus],
    dwell?: number,
];

export enum EItineraryStop { stop, alight, distance, platform, headsign }
export type ItineraryStop = [stop: StopTuple, alight: number, distance: number, platform: string, headsign: string];
export type ItineraryTuple = [stops: ItineraryStop[], shape: string];

export type TimePoint = [scheduled: number, delay: number, status: StopDepartureStatus];
export type TripStopTime = [arrival: TimePoint, departure: TimePoint];

export enum EAlertTuple { title, description, url, publishedAt, activeFrom, activeUntil, language, detected }
export type AlertTuple = [title: string, description: string, url: string, publishedAt: number | null, activeFrom: number | null, activeUntil: number | null, language: string, detected: boolean];

export enum EVehicle { id, model, year, agency, url }
export type VehicleTuple = [id: string, model: string, year: number, agency: string, url: string];

export enum EBrigadeTuple { brigade, tripCount, shifts }
export type BrigadeTuple = [brigade: string, tripCount: number, shifts: [start: number, end: number][]];

export enum EGraphPlacement { fromBranch, fromPosition, toBranch, toPosition, percent }
export type GraphPlacement = [fromBranch: number, fromPosition: number, toBranch: number, toPosition: number, percent: number];
