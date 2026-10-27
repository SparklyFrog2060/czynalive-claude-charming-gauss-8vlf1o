import { useEffect, useRef, useState } from "react";
import { apiUrl, cityGet } from "@/api/client";
import { EVehiclePosition, StopDepartureStatus, type TripStopTime, type VehiclePosition, type VehiclePositionDetailed } from "@/api/types";
import type { LiveBrigadeRow } from "./data";

export type LiveVehicle = { vehicleId: string; tripId: string | null; delay: number | null };

type VehicleMessage = { position: VehiclePositionDetailed | VehiclePosition; stops?: TripStopTime[]; sequence?: number };

const POLL_MS = 20000;
const MAX_STREAMS = 3;

// Vehicles running the duty now. Uses the cnc live endpoint when the backend has it, otherwise
// finds them via /positions/search and follows each one over its SSE stream for the trip and delay.
export const useBrigadeLive = (city: string, routeId: string, brigade: string, tripIds: string[], enabled: boolean): LiveVehicle[] => {
    const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
    const tripKey = tripIds.join("|");
    const tripSet = useRef(new Set<string>());
    tripSet.current = new Set(tripIds);

    useEffect(() => {
        setVehicles([]);
        if (!enabled) return;
        let cancelled = false;
        const streams = new Map<string, EventSource>();
        const streamed = new Map<string, LiveVehicle>();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let cncAvailable = true;

        const publishStreamed = () => {
            if (!cancelled) setVehicles([...streamed.values()]);
        };

        const follow = (vehicleIds: string[]) => {
            for (const [id, source] of streams) {
                if (!vehicleIds.includes(id)) {
                    source.close();
                    streams.delete(id);
                    streamed.delete(id);
                }
            }
            for (const id of vehicleIds) {
                if (streams.has(id)) continue;
                streamed.set(id, { vehicleId: id, tripId: null, delay: null });
                const source = new EventSource(apiUrl(`/${city}/positions/${encodeURIComponent(id)}/stream`));
                source.addEventListener("message", (event) => {
                    try {
                        const data = JSON.parse((event as MessageEvent).data) as VehicleMessage;
                        const position = data.position;
                        const tripId = (position as VehiclePositionDetailed)[EVehiclePosition.tripId] ?? null;
                        let delay: number | null = null;
                        if (data.stops?.length) {
                            const index = Math.min(data.sequence ?? 0, data.stops.length - 1);
                            const point = data.stops[index][index === data.stops.length - 1 ? 0 : 1];
                            if (point && point[2] !== StopDepartureStatus.Scheduled) delay = point[1];
                        }
                        streamed.set(id, { vehicleId: id, tripId, delay });
                        publishStreamed();
                    } catch {}
                });
                source.addEventListener("errorCode", () => {
                    source.close();
                    streams.delete(id);
                    streamed.delete(id);
                    publishStreamed();
                });
                streams.set(id, source);
            }
            publishStreamed();
        };

        const poll = async () => {
            try {
                if (!cncAvailable) throw new Error("NO_CNC");
                const rows = await cityGet<LiveBrigadeRow[]>(city, "/cnc/brigades/live");
                if (cancelled) return;
                follow([]);
                setVehicles(
                    rows
                        .filter(([, rowRoute, rowBrigade, tripId]) => (tripId && tripSet.current.has(tripId)) || (rowRoute === routeId && rowBrigade === brigade))
                        .map(([vehicleId, , , tripId, delay]) => ({ vehicleId, tripId, delay })),
                );
            } catch {
                if (cancelled) return;
                cncAvailable = false;
                try {
                    const found = await cityGet<[VehiclePosition, string, string][]>(city, "/positions/search", { query: `${routeId}/${brigade}` });
                    if (cancelled) return;
                    const ids = found
                        .map(([position]) => position)
                        .filter((position) => position[EVehiclePosition.brigade] === brigade && position[EVehiclePosition.route][0] === routeId)
                        .map((position) => position[EVehiclePosition.id])
                        .slice(0, MAX_STREAMS);
                    follow(ids);
                } catch {}
            }
            if (!cancelled) timer = setTimeout(poll, POLL_MS);
        };
        poll();

        return () => {
            cancelled = true;
            clearTimeout(timer);
            for (const source of streams.values()) source.close();
        };
    }, [city, routeId, brigade, enabled, tripKey]);

    return vehicles;
};
