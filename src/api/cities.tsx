import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGet } from "./client";

export type Agency = { id: string; name: string; url?: string; phone?: string };

export type City = {
    id: string;
    name: string;
    description?: string;
    category: string;
    location: [lon: number, lat: number];
    timezone: string;
    agencies: Record<string, Agency>;
    [extra: string]: unknown;
};

type CitiesResponse = { hash: string; cities?: City[] };

const CACHE_KEY = "czynalive:cities";

const CitiesContext = createContext<{ cities: City[]; byId: Record<string, City>; ready: boolean }>({
    cities: [],
    byId: {},
    ready: false,
});

const readCache = (): { hash: string; cities: City[] } | null => {
    try {
        return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    } catch {
        return null;
    }
};

export const CitiesProvider = ({ children }: { children: ReactNode }) => {
    const cached = readCache();
    const [cities, setCities] = useState<City[]>(cached?.cities ?? []);
    const [ready, setReady] = useState(!!cached);

    useEffect(() => {
        apiGet<CitiesResponse>("", { h: cached?.hash })
            .then((response) => {
                if (response.cities) {
                    setCities(response.cities);
                    try {
                        localStorage.setItem(CACHE_KEY, JSON.stringify({ hash: response.hash, cities: response.cities }));
                    } catch {}
                }
            })
            .catch(() => {})
            .finally(() => setReady(true));
    }, []);

    const byId = Object.fromEntries(cities.map((city) => [city.id, city]));
    return <CitiesContext.Provider value={{ cities, byId, ready }}>{children}</CitiesContext.Provider>;
};

export const useCities = () => useContext(CitiesContext);

export const useCity = (id: string | undefined) => {
    const { byId } = useCities();
    return id ? byId[id] : undefined;
};
