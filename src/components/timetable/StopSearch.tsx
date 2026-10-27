import EastIcon from "@mui/icons-material/East";
import { Box, List, TextField, Typography } from "@mui/material";
import { ClearButton } from "./SearchField";
import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cityGet } from "@/api/client";
import { ERouteTuple, EStopTuple, type RouteTuple, type StopTuple, type StopTupleDetailed } from "@/api/types";
import { RouteChip } from "@/components/departures/RouteChip";
import { Highlight, ListRow, ShowMoreButton, StopNameBadge } from "@/components/departures/parts";
import { sortRoutesByTypeId, sortTypes, uniqueRoutes } from "./common";

export type SearchStopResult = [firstStopId: string, city: string, groupName: string, stops: StopTupleDetailed[]];
type RawSearch = { stops: SearchStopResult[]; stations: [stopId: string, city: string, name: string][] };

export const MIN_QUERY = 3;

export const useDebounced = <T,>(value: T, delay = 500) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
};

// Stops (posts) matching the query via global search, flattened to detailed tuples.
export const useStopSearch = (city: string, query: string) => {
    const [state, setState] = useState<{ results?: StopTuple[]; loading: boolean; error?: boolean }>({ loading: false });
    useEffect(() => {
        if (query.trim().length < MIN_QUERY) {
            setState({ loading: false });
            return;
        }
        const controller = new AbortController();
        setState({ loading: true });
        cityGet<RawSearch>(city, "/search", { query: query.trim(), raw: true }, controller.signal)
            .then((response) => {
                const results: StopTuple[] = [];
                for (const group of response.stops ?? []) results.push(...(group[3] as unknown as StopTuple[]));
                for (const [stopId, stationCity, name] of response.stations ?? []) {
                    if (!results.some((stop) => stop[EStopTuple.stopId] === stopId)) results.push([stopId, stationCity, name, "", [0, 0], [2], null]);
                }
                setState({ results, loading: false });
            })
            .catch(() => {
                if (!controller.signal.aborted) setState({ loading: false, error: true });
            });
        return () => controller.abort();
    }, [city, query]);
    return state;
};

const MAX_CHIPS = 5;

// Stop result of the original (nge): stop badge with type blocks, direction, first lines + show more.
export const StopItemContent = ({ stop, query }: { stop: StopTuple | StopTupleDetailed; query?: string }) => {
    const [expanded, setExpanded] = useState(false);
    const direction = ((stop as StopTupleDetailed)[EStopTuple.direction] as string | undefined) ?? "";
    const routes = uniqueRoutes(sortRoutesByTypeId(((stop as StopTupleDetailed)[EStopTuple.routes] as RouteTuple[] | undefined) ?? []));
    const types = sortTypes(stop[EStopTuple.vehicleTypes].length ? stop[EStopTuple.vehicleTypes] : routes.map((route) => route[ERouteTuple.routeType]));
    const more = routes.length > MAX_CHIPS;
    const shown = more && !expanded ? routes.slice(0, MAX_CHIPS) : routes;
    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.5, maxWidth: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5, maxWidth: "100%" }}>
                <StopNameBadge stopTypes={types} text={<Highlight text={stop[EStopTuple.stopName]} query={query} />} angledDivider />
                {direction !== "" && (
                    <Typography variant="body2" color="textSecondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <EastIcon fontSize="inherit" /> {direction}
                    </Typography>
                )}
            </Box>
            {routes.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5, alignItems: "center" }}>
                    {shown.map((route, index) => (
                        <Fragment key={`${route[ERouteTuple.city]}/${route[ERouteTuple.routeId]}`}>
                            <RouteChip
                                name={route[ERouteTuple.routeName]}
                                type={route[ERouteTuple.routeType]}
                                animate={false}
                                sx={{ height: "22px", fontSize: "0.875rem", "& .MuiChip-label": { paddingLeft: "8px", paddingRight: "8px" } }}
                            />
                            {more && expanded && index === MAX_CHIPS - 1 && <ShowMoreButton expanded={expanded} onClick={() => setExpanded((value) => !value)} />}
                        </Fragment>
                    ))}
                    {more && <ShowMoreButton expanded={expanded} onClick={() => setExpanded((value) => !value)} />}
                </Box>
            )}
        </Box>
    );
};

export const StopList = ({
    stops,
    linkFor,
    onSelect,
    trailing,
    query,
    style,
}: {
    stops: StopTuple[];
    linkFor?: (stop: StopTuple) => string;
    onSelect?: (stop: StopTuple) => void;
    trailing?: (stop: StopTuple) => ReactNode;
    query?: string;
    style?: CSSProperties;
}) => (
    <List style={style}>
        {stops.map((stop) => (
            <ListRow
                key={`${stop[EStopTuple.city]}/${stop[EStopTuple.stopId]}`}
                to={linkFor?.(stop)}
                onClick={() => onSelect?.(stop)}
                action="navigate"
                trailing={trailing ? trailing(stop) : undefined}
                column
            >
                <StopItemContent stop={stop} query={query} />
            </ListRow>
        ))}
    </List>
);

export const StopSearchField = ({ value, onChange, label, placeholder }: { value: string; onChange: (value: string) => void; label?: string; placeholder?: string }) => {
    const { t } = useTranslation();
    return (
        <form autoComplete="off" noValidate onSubmit={(event) => event.preventDefault()}>
            <TextField
                label={label ?? t("global.stops")}
                placeholder={placeholder ?? t("favourites.searchStop")}
                margin="normal"
                type="search"
                value={value}
                variant="outlined"
                onChange={(event) => onChange(event.target.value)}
                size="small"
                fullWidth
                slotProps={{
                    input: { endAdornment: <ClearButton visible={value !== ""} onClear={() => onChange("")} /> },
                    inputLabel: { shrink: true },
                }}
            />
        </form>
    );
};

export const SearchStatus = ({ query, loading, error, empty }: { query: string; loading: boolean; error?: boolean; empty: boolean }) => {
    const { t } = useTranslation();
    const style = { margin: "10px 0 5px" };
    if (query.length > 0 && query.length < MIN_QUERY)
        return (
            <Typography variant="subtitle2" noWrap style={style}>
                {t("global.atLeastXChars", { count: MIN_QUERY })}
            </Typography>
        );
    if (loading)
        return (
            <Typography variant="subtitle2" noWrap style={style}>
                {t("global.searching")}...
            </Typography>
        );
    if (error)
        return (
            <Typography variant="body2" noWrap style={{ margin: "5px 0" }}>
                {t("global.error")}
            </Typography>
        );
    if (empty && query.length >= MIN_QUERY)
        return (
            <Typography variant="subtitle2" noWrap style={style}>
                {t("global.nothingFound")}
            </Typography>
        );
    return null;
};
