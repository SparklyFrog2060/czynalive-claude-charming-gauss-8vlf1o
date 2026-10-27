import { getGroups, setGroups, useFavouriteGroups, type FavouriteItem } from "./favouriteGroups";
import { createPersistedStore } from "./persisted";

export type FavouriteStop = { id: string; name: string; code?: string };
export type FavouriteRoute = { id: string; name: string; type: number; color?: string; textColor?: string };
export type FavouriteVehicle = { id: string; name: string; type: number };

export type CityFavourites = {
    stops: FavouriteStop[];
    routes: FavouriteRoute[];
    vehicles: FavouriteVehicle[];
};

export const EMPTY_FAVOURITES: CityFavourites = { stops: [], routes: [], vehicles: [] };

export const favouritesStore = createPersistedStore<Record<string, CityFavourites>>("czynalive:favourites", {});

const DEFAULT_GROUP_NAME = "Moje Ulubione";

const toItem = <K extends keyof CityFavourites>(kind: K, item: CityFavourites[K][number]): FavouriteItem => {
    if (kind === "stops") {
        const stop = item as FavouriteStop;
        return { favouriteType: "stop", data: { id: stop.id, stop_id: stop.id, stop_name: stop.name, code: stop.code, type: [] } };
    }
    if (kind === "routes") {
        const route = item as FavouriteRoute;
        return { favouriteType: "route_id", data: { id: `${route.type}/${route.id}`, route_id: route.name, routeId: route.id, type: [route.type], color: route.color } };
    }
    const vehicle = item as FavouriteVehicle;
    return { favouriteType: "vehicle", data: { id: vehicle.id, vehicleNo: vehicle.name, type: [vehicle.type] } };
};

const matches = (kind: keyof CityFavourites, item: FavouriteItem, id: string) =>
    kind === "stops"
        ? item.favouriteType === "stop" && item.data.id === id
        : kind === "routes"
          ? item.favouriteType === "route_id" && item.data.routeId === id
          : item.favouriteType === "vehicle" && item.data.id === id;

// Legacy flat favourites become one group the first time a city's groups are read.
const migrateLegacy = (city: string) => {
    const legacy = favouritesStore.get()[city];
    if (!legacy || getGroups(city).length > 0) return;
    const items = [
        ...legacy.stops.map((stop) => toItem("stops", stop)),
        ...legacy.routes.map((route) => toItem("routes", route)),
        ...legacy.vehicles.map((vehicle) => toItem("vehicles", vehicle)),
    ];
    if (items.length) setGroups(city, [{ id: Date.now(), name: DEFAULT_GROUP_NAME, items, expanded: true }]);
    favouritesStore.set((prev) => {
        const next = { ...prev };
        delete next[city];
        return next;
    });
};

for (const legacyCity of Object.keys(favouritesStore.get())) migrateLegacy(legacyCity);

// Flat view of all favourite groups of a city (the groups live in favouriteGroups.ts).
export const useFavourites = (city: string) => {
    const { groups } = useFavouriteGroups(city);
    const favourites: CityFavourites = { stops: [], routes: [], vehicles: [] };
    for (const group of groups) {
        for (const item of group.items) {
            if (item.favouriteType === "stop") {
                if (!favourites.stops.some((entry) => entry.id === item.data.id)) favourites.stops.push({ id: item.data.id, name: item.data.stop_name, code: item.data.code });
            } else if (item.favouriteType === "route_id") {
                if (!favourites.routes.some((entry) => entry.id === item.data.routeId))
                    favourites.routes.push({ id: item.data.routeId, name: item.data.route_id, type: item.data.type[0] ?? 3, color: item.data.color });
            } else if (!favourites.vehicles.some((entry) => entry.id === item.data.id)) favourites.vehicles.push({ id: item.data.id, name: item.data.vehicleNo, type: item.data.type[0] ?? 3 });
        }
    }

    const has = (kind: keyof CityFavourites, id: string) => groups.some((group) => group.items.some((item) => matches(kind, item, id)));

    const toggle = <K extends keyof CityFavourites>(kind: K, item: CityFavourites[K][number]) => {
        const current = getGroups(city);
        if (current.some((group) => group.items.some((entry) => matches(kind, entry, item.id)))) {
            setGroups(
                city,
                current.map((group) => ({ ...group, items: group.items.filter((entry) => !matches(kind, entry, item.id)) })),
            );
            return;
        }
        if (!current.length) {
            setGroups(city, [{ id: Date.now(), name: DEFAULT_GROUP_NAME, items: [toItem(kind, item)], expanded: true }]);
            return;
        }
        setGroups(city, current.map((group, index) => (index === 0 ? { ...group, items: [...group.items, toItem(kind, item)] } : group)));
    };

    const reorder = <K extends keyof CityFavourites>(kind: K, items: CityFavourites[K]) => {
        const current = getGroups(city);
        if (!current.length) return;
        const first = current[0];
        const others = first.items.filter((entry) => !items.some((item) => matches(kind, entry, item.id)));
        setGroups(city, [{ ...first, items: [...others, ...items.map((item) => toItem(kind, item))] }, ...current.slice(1)]);
    };

    return { favourites, toggle, reorder, has };
};
