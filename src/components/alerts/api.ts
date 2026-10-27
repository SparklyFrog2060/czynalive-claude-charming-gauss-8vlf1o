import dayjs from "dayjs";
import "dayjs/locale/pl";
import relativeTime from "dayjs/plugin/relativeTime";
import { ApiError, cityGet } from "@/api/client";
import type { RouteTuple, StopTuple } from "@/api/types";

dayjs.extend(relativeTime);
dayjs.locale("pl");

export type AlertKind = "CHANGE" | "IMPEDIMENT";

export const ALERT_KINDS: AlertKind[] = ["CHANGE", "IMPEDIMENT"];

export const ALERT_KIND_LABEL: Record<AlertKind, string> = { CHANGE: "alerts.alerts", IMPEDIMENT: "alerts.impediments" };

// Response of GET /api6/:city/cnc/alerts (backend cnc-joke.ts).
export type CityAlert = {
    id: string;
    kind: AlertKind;
    title: string;
    description: string; // markdown
    url: string;
    publishedAt: number | null;
    activeFrom: number | null;
    activeUntil: number | null;
    language: string;
    detected: boolean;
    routes: RouteTuple[];
    stops: StopTuple[];
    agencies: string[];
    trips: number;
};

export type CityAlertsResponse = { updatedAt: number; alerts: CityAlert[] };

export type CancelledTrip = {
    tripId: string;
    route: RouteTuple;
    brigade: string;
    headsign: string;
    startTime: number;
    endTime: number;
    startStop: string;
    endStop: string;
    partial: boolean;
};

export type CancelledTripsResponse = { date: string; updatedAt: number; trips: CancelledTrip[] };

export const fetchCityAlerts = (city: string, signal: AbortSignal) => cityGet<CityAlertsResponse>(city, "/cnc/alerts", undefined, signal);

export const fetchCancelledTrips = (city: string, signal: AbortSignal) =>
    cityGet<CancelledTripsResponse>(city, "/cnc/cancelled", undefined, signal);

// The cnc endpoints exist only on a backend with cnc-joke.ts deployed.
export const isMissingEndpoint = (error: unknown) => error instanceof ApiError && (error.status === 404 || error.status === 405);

export const fromNow = (epochMs: number) => dayjs(epochMs).fromNow();

export const formatDateTime = (epochMs: number, seconds = false) => dayjs(epochMs).format(seconds ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD HH:mm");

export const alertTimestamp = (alert: CityAlert) => alert.publishedAt ?? alert.activeFrom ?? 0;

export const alertTitle = (alert: CityAlert) => (alert.detected ? `⚠ ${alert.title}` : alert.title);
