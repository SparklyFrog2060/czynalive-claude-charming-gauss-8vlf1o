import { ERouteTuple } from "@/api/types";
import { compareNatural, typeRank, type CityBrigade } from "./data";

export type BrigadeSearchType = "ROUTE_ID/BRIGADE" | "BRIGADE/ROUTE_ID";

// "007" and "7" are the same brigade unless the query itself starts with a zero.
const stripZeros = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? value : parsed.toString();
};

const brigadeEquals = (brigade: string, query: string) =>
    query.startsWith("0") ? brigade.toUpperCase() === query.toUpperCase() : stripZeros(brigade).toUpperCase() === stripZeros(query).toUpperCase();

const brigadeStarts = (brigade: string, query: string) =>
    query.startsWith("0")
        ? brigade.toUpperCase().startsWith(query.toUpperCase())
        : stripZeros(brigade).toUpperCase().startsWith(stripZeros(query).toUpperCase());

const lineName = (item: CityBrigade) => item.route[ERouteTuple.routeName];

export const sortBrigades = (items: CityBrigade[], type: BrigadeSearchType) =>
    [...items].sort((a, b) => {
        const byType = typeRank(a.route[ERouteTuple.routeType]) - typeRank(b.route[ERouteTuple.routeType]);
        if (byType) return byType;
        if (type === "ROUTE_ID/BRIGADE") return compareNatural(lineName(a), lineName(b)) || compareNatural(a.brigade, b.brigade);
        return compareNatural(a.brigade, b.brigade) || compareNatural(lineName(a), lineName(b));
    });

export const filterBrigades = (items: CityBrigade[], rawQuery: string, type: BrigadeSearchType): CityBrigade[] => {
    const query = rawQuery.trim();
    if (!query) return sortBrigades(items, type);
    const [first, second] = query.split("/").map((part) => part.trim());

    const matches = items.filter((item) => {
        const line = lineName(item).toUpperCase();
        const lineId = item.route[ERouteTuple.routeId].toUpperCase();
        const lineIs = (value: string) => line === value.toUpperCase() || lineId === value.toUpperCase();
        const lineStarts = (value: string) => line.startsWith(value.toUpperCase());

        if (type === "ROUTE_ID/BRIGADE") {
            if (second === undefined) return lineStarts(first);
            if (second.length > 0) return lineIs(first) && brigadeStarts(item.brigade, second);
            return lineIs(first);
        }
        if (second === undefined) return brigadeStarts(item.brigade, first);
        if (second.length > 0) return brigadeEquals(item.brigade, first) && lineStarts(second);
        return brigadeEquals(item.brigade, first);
    });
    return sortBrigades(matches, type);
};
