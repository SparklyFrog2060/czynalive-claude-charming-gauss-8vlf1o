import { cityGet } from "./client";
import type { RouteTuple } from "./types";

export type VirtualCityRef = [cityId: string, showInRouteList: boolean];

const virtualCache = new Map<string, Promise<VirtualCityRef[]>>();
const routeIdsCache = new Map<string, Promise<string[]>>();

// Virtual cities (pkp, flixbus, mld, digitraffic) a city overlays; [] until the cnc endpoint is deployed.
export const virtualCitiesOf = (city: string): Promise<VirtualCityRef[]> => {
    let refs = virtualCache.get(city);
    if (!refs) {
        refs = cityGet<VirtualCityRef[]>(city, "/cnc/virtual").catch(() => {
            virtualCache.delete(city);
            return [];
        });
        virtualCache.set(city, refs);
    }
    return refs;
};

const routeIdsOf = (city: string): Promise<string[]> => {
    let ids = routeIdsCache.get(city);
    if (!ids) {
        ids = cityGet<RouteTuple[]>(city, "/routes")
            .then((routes) => routes.map((route) => route[0]))
            .catch(() => {
                routeIdsCache.delete(city);
                return [];
            });
        routeIdsCache.set(city, ids);
    }
    return ids;
};

// Route ids of the city plus every virtual city it uses, so city-wide streams include their vehicles too.
export const cityRouteIdsWithVirtual = async (city: string): Promise<string[]> => {
    const [own, virtual] = await Promise.all([routeIdsOf(city), virtualCitiesOf(city)]);
    const lists = await Promise.all(virtual.map(([virtualCity]) => routeIdsOf(virtualCity)));
    return [...new Set([...own, ...lists.flat()])];
};
