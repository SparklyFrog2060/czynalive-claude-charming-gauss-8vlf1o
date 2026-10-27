import { ETripTuple, type TripTupleDetailed } from "@/api/types";

// "1h 5min" / "35min" like the original brigade schedule.
export const formatDuration = (ms: number) => {
    const totalMinutes = Math.round(Math.max(0, ms) / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
};

export const formatKm = (metres: number) => `${(metres / 1000).toFixed(2)}km`;

export const tripStart = (trip: TripTupleDetailed) => trip[ETripTuple.firstStop][1];
export const tripEnd = (trip: TripTupleDetailed) => trip[ETripTuple.lastStop][1];

// dayjs "H[h] m[min]" / "m[min]" of the original (minutes truncated).
export const formatBreak = (ms: number) => {
    const totalMinutes = Math.floor(Math.max(0, ms) / 60000);
    const hours = Math.floor(totalMinutes / 60);
    return ms >= 3600000 ? `${hours}h ${totalMinutes % 60}min` : `${totalMinutes % 60}min`;
};
