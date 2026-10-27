import { useEffect, useState } from "react";
import { StopDepartureStatus } from "@/api/types";

// czynaczas thresholds, whole minutes (floor towards zero).
const DELAY_RANGES: [from: number, to: number, className: string][] = [
    [-Infinity, -2, "before-time"],
    [-1, 3, "on-time"],
    [4, 9, "delayed-slight"],
    [10, 14, "delayed-minor"],
    [15, 19, "delayed-moderate"],
    [20, 24, "delayed-major"],
    [25, Infinity, "delayed-critical"],
];

export const delayMinutes = (delayMs: number): number => (delayMs > 0 ? Math.floor(delayMs / 60000) : -Math.floor(Math.abs(delayMs) / 60000));

export const delayClassName = (delayMin: number | undefined): string => {
    if (delayMin === undefined) return "delayed-no-data";
    return DELAY_RANGES.find(([from, to]) => delayMin >= from && delayMin <= to)?.[2] ?? "delayed-no-data";
};

export const isLiveStatus = (status: StopDepartureStatus) => status === StopDepartureStatus.OnTrip || status === StopDepartureStatus.OnPreviousTrip;

export const hhmm = (epochMs: number, timeZone = "Europe/Warsaw") =>
    new Date(epochMs).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone });

// Re-renders every `intervalMs`, aligned to the wall clock.
export const useNow = (intervalMs = 15000) => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        let timer: ReturnType<typeof setInterval> | undefined;
        const first = setTimeout(() => {
            setNow(Date.now());
            timer = setInterval(() => setNow(Date.now()), intervalMs);
        }, intervalMs - (Date.now() % intervalMs));
        return () => {
            clearTimeout(first);
            clearInterval(timer);
        };
    }, [intervalMs]);
    return now;
};
