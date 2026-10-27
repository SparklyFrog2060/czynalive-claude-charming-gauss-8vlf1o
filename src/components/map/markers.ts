import { ERouteTuple, EVehiclePosition, RouteType, type VehiclePosition } from "@/api/types";
import { parseVehicleId } from "@/lib/transit";
import { wstExecutionIdFromVehicleId } from "@/api/wst";
import { ICON_PATHS, escapeHtml, svgIcon, typeClass, typeIconPath } from "./icons";

// czynaczas delay buckets (minutes) -> css class
const DELAY_BUCKETS: [from: number, to: number, className: string][] = [
    [-Infinity, -2, "before-time"],
    [-1, 1, "on-time"],
    [2, 9, "delayed-slight"],
    [10, 14, "delayed-minor"],
    [15, 19, "delayed-moderate"],
    [20, 24, "delayed-major"],
    [25, Infinity, "delayed-critical"],
];

export const delayToMinutes = (delayMs: number) => (delayMs > 0 ? Math.floor(delayMs / 60000) : -Math.floor(Math.abs(delayMs) / 60000));

export const delayMinutesClass = (minutes: number | undefined | null): string => {
    if (minutes === undefined || minutes === null) return "delayed-no-data";
    return DELAY_BUCKETS.find(([from, to]) => minutes >= from && minutes <= to)?.[2] ?? "delayed-no-data";
};

export const delayCssColor = (minutes: number | undefined | null) => `var(--${delayMinutesClass(minutes)})`;

export type MarkerOptions = {
    showBrigade: boolean;
    showVehicleNo: boolean;
    colorByDelay: boolean;
    dark: boolean;
    delayMs?: number | null;
};

export const markerColorClasses = (type: number, dark: boolean) => {
    const name = typeClass(type);
    return dark ? `bg-${name} text-default-text border-default-text fill-default-text` : `bg-white text-${name} border-${name} fill-${name}`;
};

export const vehicleMarkerHtml = (position: VehiclePosition, options: MarkerOptions) => {
    const route = position[EVehiclePosition.route];
    const type = route[ERouteTuple.routeType];
    const bearing = position[EVehiclePosition.bearing];
    const brigade = position[EVehiclePosition.brigade];
    const id = position[EVehiclePosition.id];
    const { number: parsedNumber } = parseVehicleId(id);
    const number = wstExecutionIdFromVehicleId(id) ? "" : parsedNumber;
    const delayClass =
        options.colorByDelay && options.delayMs !== undefined ? delayMinutesClass(options.delayMs === null ? null : delayToMinutes(options.delayMs)) : "";
    const arrow =
        bearing !== null && bearing !== undefined
            ? svgIcon(ICON_PATHS.arrow, `transform: rotate(calc(${bearing}deg - var(--map-bearing, 0deg)))`)
            : "";
    const brigadePart = options.showBrigade && brigade ? `<div class="brigade">/${escapeHtml(brigade)}</div>` : "";
    const vehicleNoPart = options.showVehicleNo && type !== RouteType.Subway ? `<div class="vehicle-no">/${escapeHtml(number || "-")}</div>` : "";
    return `<div class="vehicle-marker ${markerColorClasses(type, options.dark)} ${delayClass}"><div class="marker-data-row main">${arrow}${svgIcon(typeIconPath(type))}<div class="route-id-number">${escapeHtml(route[ERouteTuple.routeName])}</div>${brigadePart}${vehicleNoPart}</div></div>`;
};

// Bigger LCD-board variant (czynaczas "lcd-slupsk" marker) with headsign and delay chip.
export const lcdMarkerHtml = (position: VehiclePosition, headsign: string, delayMs: number | null | undefined) => {
    const route = position[EVehiclePosition.route];
    const type = route[ERouteTuple.routeType];
    const name = typeClass(type);
    const bearing = position[EVehiclePosition.bearing];
    const id = position[EVehiclePosition.id];
    const { number: parsedNumber } = parseVehicleId(id);
    const number = wstExecutionIdFromVehicleId(id) ? "" : parsedNumber;
    const minutes = delayMs === null || delayMs === undefined ? undefined : delayToMinutes(delayMs);
    const delayClass = minutes === undefined ? "on-time" : minutes <= -1 ? "before-time" : minutes === 0 ? "on-time" : "delayed-moderate";
    const arrow = bearing !== null && bearing !== undefined ? svgIcon(ICON_PATHS.arrow, `transform: rotate(${bearing}deg)`) : "";
    const delay = minutes !== undefined ? `<div class="delay ${delayClass}">${minutes > 0 ? "+" : ""}${minutes}min</div>` : "";
    return `<div class="vehicle-marker bg-white text-${name} border-${name} fill-${name}" style="flex-direction:column;border-radius:10px"><div class="marker-data-row main lcd-slupsk">${arrow}${svgIcon(typeIconPath(type))}<div class="route-id-number">${escapeHtml(route[ERouteTuple.routeName])}</div>${headsign ? `<div class="trip-headsign">${escapeHtml(headsign)}</div>` : ""}</div><div class="marker-data-row additional lcd-slupsk"><div style="display:flex;align-items:baseline"><div class="brigade">${escapeHtml(position[EVehiclePosition.brigade] || "-")}</div><div class="vehicle-no">/${escapeHtml(number || "-")}</div></div>${delay}</div></div>`;
};
