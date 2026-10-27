import { useCallback, useState } from "react";
import { EStopTuple, type StopTuple } from "@/api/types";

const MAX_RECENT = 10;
const key = (city: string) => `czynalive:recentStops:${city}`;

const read = (city: string): StopTuple[] => {
    try {
        const parsed = JSON.parse(localStorage.getItem(key(city)) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

// "Ostatnio wybierane" stops of the timetable search, newest first.
export const useRecentStops = (city: string) => {
    const [recent, setRecent] = useState<StopTuple[]>(() => read(city));

    const add = useCallback(
        (stop: StopTuple) => {
            const next = [stop, ...read(city).filter((entry) => entry[EStopTuple.stopId] !== stop[EStopTuple.stopId])].slice(0, MAX_RECENT);
            try {
                localStorage.setItem(key(city), JSON.stringify(next));
            } catch {}
            setRecent(next);
        },
        [city],
    );

    const clear = useCallback(() => {
        try {
            localStorage.removeItem(key(city));
        } catch {}
        setRecent([]);
    }, [city]);

    return { recent, add, clear };
};
