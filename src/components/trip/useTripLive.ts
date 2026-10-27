import { useEffect, useState } from "react";
import type { AlertTuple, ItineraryTuple, TripStopTime, TripTuple, VehiclePosition, VehiclePositionDetailed } from "@/api/types";
import { openSse } from "@/components/map/sse";
import { loadWstTripExecution, wstExecutionIdFromVehicleId } from "@/api/wst";

export type TripLiveState = {
    city: string;
    trip?: TripTuple;
    itinerary?: ItineraryTuple;
    position?: VehiclePositionDetailed | VehiclePosition | null;
    stops?: TripStopTime[];
    sequence?: number;
    alerts: AlertTuple[];
    fatal?: string;
    connectionError: boolean;
};

type Initial = { trip: TripTuple; itinerary?: ItineraryTuple };
type Message = { position: VehiclePositionDetailed | VehiclePosition | null; stops?: TripStopTime[]; sequence?: number; alerts?: AlertTuple[] };

// Virtual cities overlaid on a normal city's map; deep links carry only the map city.
const FALLBACK_CITIES = ["pkp"];

// Live trip / vehicle: `trips/:id/stream` or `positions/:id/stream` (same message shape).
export const useTripLive = (kind: "vehicle" | "trip", city: string, id: string | null): TripLiveState => {
    const [state, setState] = useState<TripLiveState>({ city, alerts: [], connectionError: false });

    useEffect(() => {
        setState({ city, alerts: [], connectionError: false });
        if (!id) return;
        const wstExecutionId = kind === "vehicle" ? wstExecutionIdFromVehicleId(id) : null;
        if (wstExecutionId) {
            let cancelled = false;
            let timer: ReturnType<typeof setTimeout> | undefined;
            let controller: AbortController | undefined;
            const poll = async () => {
                controller = new AbortController();
                try {
                    const data = await loadWstTripExecution(wstExecutionId, controller.signal);
                    if (cancelled) return;
                    setState({
                        city: "krakow",
                        trip: data.trip,
                        itinerary: data.itinerary,
                        position: data.position,
                        stops: data.stops,
                        sequence: data.sequence,
                        alerts: [],
                        fatal: data.canceled ? "TRIP_CANCELLED" : undefined,
                        connectionError: false,
                    });
                } catch {
                    if (!cancelled && !controller.signal.aborted) setState((prev) => ({ ...prev, city: "krakow", connectionError: true }));
                } finally {
                    if (!cancelled) timer = setTimeout(poll, 10000);
                }
            };
            void poll();
            return () => {
                cancelled = true;
                clearTimeout(timer);
                controller?.abort();
            };
        }
        let handle: { close: () => void } | null = null;
        let cancelled = false;
        const candidates = [city, ...FALLBACK_CITIES.filter((value) => value !== city)];
        const open = (attempt: number) => {
            const currentCity = candidates[attempt];
            let gotData = false;
            const path = kind === "vehicle" ? `/${currentCity}/positions/${encodeURIComponent(id)}/stream` : `/${currentCity}/trips/${encodeURIComponent(id)}/stream`;
            handle = openSse<Initial, Message>(path, undefined, {
                onInitial: (initial) => {
                    gotData = true;
                    setState((prev) => ({
                        ...prev,
                        city: currentCity,
                        trip: initial.trip,
                        itinerary: initial.itinerary ?? prev.itinerary,
                        connectionError: false,
                    }));
                },
                onMessage: (message) => {
                    gotData = true;
                    setState((prev) => ({
                        ...prev,
                        city: currentCity,
                        position: message.position,
                        stops: message.stops ?? prev.stops,
                        sequence: message.sequence ?? prev.sequence,
                        alerts: message.alerts ?? prev.alerts,
                        trip: kind === "vehicle" && !message.stops ? undefined : prev.trip,
                        itinerary: kind === "vehicle" && !message.stops ? undefined : prev.itinerary,
                        connectionError: false,
                    }));
                },
                onFatal: (code) => {
                    if (cancelled) return;
                    if (!gotData && attempt + 1 < candidates.length) return open(attempt + 1);
                    setState((prev) => ({ ...prev, fatal: code || "ERROR" }));
                },
                onError: () => setState((prev) => ({ ...prev, connectionError: true })),
            });
        };
        open(0);
        return () => {
            cancelled = true;
            handle?.close();
        };
    }, [kind, city, id]);

    return state;
};
