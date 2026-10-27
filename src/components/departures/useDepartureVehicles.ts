import { useEffect, useState } from "react";
import { cityGet } from "@/api/client";

// [delay ms | null, current headsign, model, current/next stop name, standing at that stop]
export type DepartureVehicle = [delay: number | null, headsign: string, model: string, stop?: string, atStop?: boolean];
export type DepartureVehicles = Record<string, DepartureVehicle>;

// Live state of every vehicle of a city (cnc endpoint); stays empty when the backend does not have it.
export const useDepartureVehicles = (city: string, enabled: boolean, refreshMs = 15000): DepartureVehicles => {
    const [vehicles, setVehicles] = useState<DepartureVehicles>({});
    useEffect(() => {
        if (!enabled || !city) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const controller = new AbortController();
        let failures = 0;
        const run = () => {
            cityGet<DepartureVehicles>(city, "/cnc/timetable/vehicles", undefined, controller.signal)
                .then((data) => {
                    failures = 0;
                    setVehicles(data);
                })
                .catch(() => {
                    failures++;
                })
                .finally(() => {
                    if (!controller.signal.aborted && failures < 2) timer = setTimeout(run, refreshMs);
                });
        };
        run();
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [city, enabled, refreshMs]);
    return vehicles;
};
