import { useCallback } from "react";
import { createPersistedStore } from "./persisted";

// Favourite groups of the original ("Grupy Ulubionych"): named lists of stops, lines and vehicles per city.
export type FavouriteStopData = { id: string; stop_id: string; stop_name: string; type: number[]; city?: string; code?: string };
export type FavouriteRouteData = { id: string; route_id: string; routeId: string; type: number[]; city?: string; color?: string };
export type FavouriteVehicleData = { id: string; vehicleNo: string; type: number[]; city?: string };

export type FavouriteItem =
    | { favouriteType: "stop"; data: FavouriteStopData }
    | { favouriteType: "route_id"; data: FavouriteRouteData }
    | { favouriteType: "vehicle"; data: FavouriteVehicleData };

export type FavouriteType = FavouriteItem["favouriteType"];

export type FavouriteGroup = { id: number; name: string; items: FavouriteItem[]; expanded: boolean; favouriteDeparturesOnly?: boolean };

export const GROUP_NAME_LIMITS = { MIN_NAME_LENGTH: 1, MAX_NAME_LENGTH: 100 };

export const isValidGroupName = (name: string) => {
    const length = name.trim().length;
    return length >= GROUP_NAME_LIMITS.MIN_NAME_LENGTH && length <= GROUP_NAME_LIMITS.MAX_NAME_LENGTH;
};

export const favouriteGroupsStore = createPersistedStore<Record<string, FavouriteGroup[]>>("czynalive:favouriteGroups", {});

export const getGroups = (city: string) => favouriteGroupsStore.get()[city] ?? [];

export const setGroups = (city: string, groups: FavouriteGroup[]) => favouriteGroupsStore.set({ [city]: groups });

export const itemKey = (item: FavouriteItem) => `${item.favouriteType}-${item.data.id}`;

export const groupItems = <T extends FavouriteType>(group: FavouriteGroup, type: T) =>
    group.items.filter((item) => item.favouriteType === type).map((item) => item.data) as Extract<FavouriteItem, { favouriteType: T }>["data"][];

export const useFavouriteGroups = (city: string) => {
    const [all] = favouriteGroupsStore.useStore();
    const groups = all[city] ?? [];

    const addGroup = useCallback((group: FavouriteGroup) => setGroups(city, [...getGroups(city), group]), [city]);
    const updateGroup = useCallback(
        (id: number, group: FavouriteGroup) => setGroups(city, getGroups(city).map((entry) => (entry.id === id ? group : entry))),
        [city],
    );
    const replaceGroups = useCallback((next: FavouriteGroup[]) => setGroups(city, next), [city]);
    const deleteGroup = useCallback((id: number) => setGroups(city, getGroups(city).filter((entry) => entry.id !== id)), [city]);
    const move = useCallback(
        (index: number, delta: number) => {
            const list = [...getGroups(city)];
            const target = index + delta;
            if (target < 0 || target >= list.length) return;
            const [moved] = list.splice(index, 1);
            list.splice(target, 0, moved);
            setGroups(city, list);
        },
        [city],
    );

    return { groups, addGroup, updateGroup, replaceGroups, deleteGroup, moveGroupUp: (index: number) => move(index, -1), moveGroupDown: (index: number) => move(index, 1) };
};
