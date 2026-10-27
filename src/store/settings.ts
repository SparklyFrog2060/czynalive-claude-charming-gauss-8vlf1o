import { createPersistedStore } from "./persisted";

export type BottomNavItem = "favourites" | "alerts" | "map" | "timetable" | "menu" | "brigades" | "multiBrigades" | "delays" | "stats" | "cancelled";

export type Settings = {
    city: string | null;
    theme: "light" | "dark" | "system";
    language: "pl" | "en";
    markerShowBrigade: boolean;
    markerShowVehicleNo: boolean;
    colorByDelay: boolean;
    showVehiclePhotos: boolean;
    noAcBadgeMode: "hot" | "always" | "never";
    showRampBadge: boolean;
    departuresShowBrigade: boolean;
    departuresShowVehicleNo: boolean;
    useLastMapLocation: boolean;
    startLocations: Record<string, [lon: number, lat: number, zoom: number]>;
    lastMapLocations: Record<string, [lon: number, lat: number, zoom: number]>;
    bottomNav: BottomNavItem[];
    mapStyle: "streets" | "satellite" | "osm";
    mapFilters: Record<string, { routes: string[]; vehicleTypes: number[] }>;
    brigadeSearchType: "ROUTE_ID/BRIGADE" | "BRIGADE/ROUTE_ID";
};

export const DEFAULT_BOTTOM_NAV: BottomNavItem[] = ["favourites", "alerts", "map", "timetable", "menu"];

export const settingsStore = createPersistedStore<Settings>("czynalive:settings", {
    city: null,
    theme: "light",
    language: "pl",
    markerShowBrigade: false,
    markerShowVehicleNo: false,
    colorByDelay: false,
    showVehiclePhotos: true,
    noAcBadgeMode: "hot",
    showRampBadge: false,
    departuresShowBrigade: false,
    departuresShowVehicleNo: false,
    useLastMapLocation: false,
    startLocations: {},
    lastMapLocations: {},
    bottomNav: DEFAULT_BOTTOM_NAV,
    mapStyle: "osm",
    mapFilters: {},
    brigadeSearchType: "ROUTE_ID/BRIGADE",
});

export const useSettings = settingsStore.useStore;
