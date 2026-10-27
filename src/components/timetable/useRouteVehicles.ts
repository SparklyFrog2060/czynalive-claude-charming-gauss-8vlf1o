import { useEffect, useState } from "react";
import { apiUrl } from "@/api/client";
import type { AlertTuple, GraphPlacement, VehiclePosition } from "@/api/types";

export type VehiclePlacement = [vehicleId: string, city: string, placement: GraphPlacement];
type Message = { positions: VehiclePosition[]; placements?: VehiclePlacement[]; alerts?: AlertTuple[] };

// Live vehicles of routes placed on the /routes/:id graph (mapFeatures stream, graph mode).
export const useRouteVehicles = (city: string, routeIds: string[], direction?: number, enabled = true) => {
    const [positions, setPositions] = useState<VehiclePosition[]>([]);
    const [placements, setPlacements] = useState<VehiclePlacement[]>([]);
    const [alerts, setAlerts] = useState<AlertTuple[] | undefined>();
    const key = routeIds.join(",");

    useEffect(() => {
        setPositions([]);
        setPlacements([]);
        if (!enabled || !city || !key || typeof EventSource === "undefined") return;
        const source = new EventSource(apiUrl(`/${city}/mapFeatures/0/0,0,0,0/stream`, { filterRoutes: key, graph: 1, filterDirection: direction }));
        source.addEventListener("message", (event) => {
            try {
                const data = JSON.parse((event as MessageEvent).data) as Message;
                setPositions(data.positions ?? []);
                setPlacements(data.placements ?? []);
                if (data.alerts) setAlerts(data.alerts);
            } catch {}
        });
        source.addEventListener("errorCode", () => source.close());
        return () => source.close();
    }, [city, key, direction, enabled]);

    return { positions, placements, alerts };
};
