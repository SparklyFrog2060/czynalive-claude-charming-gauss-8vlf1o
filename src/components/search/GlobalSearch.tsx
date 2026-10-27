import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CloseIcon from "@mui/icons-material/Close";
import EastIcon from "@mui/icons-material/East";
import SearchIcon from "@mui/icons-material/Search";
import { Box, Button, Dialog, DialogActions, DialogContent, Divider, IconButton, InputAdornment, List, Skeleton, Slide, TextField, Typography } from "@mui/material";
import type { TransitionProps } from "@mui/material/transitions";
import { forwardRef, Fragment, useEffect, useMemo, useState, type ReactElement, type ReactNode, type Ref } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cityGet } from "@/api/client";
import { ERouteTuple, EStopTuple, type RouteTuple, type StopTupleDetailed } from "@/api/types";
import { ListRow, RouteNameBadge, StopNameBadge } from "@/components/departures/parts";
import { RouteChip } from "@/components/departures/RouteChip";
import { ShowMoreButton } from "@/components/ShowMoreButton";
import { useThemeMode } from "@/components/timetable/common";
import { setShowSearch, useShell } from "@/lib/shell";
import { useSettings } from "@/store/settings";
import { parseVehicleId } from "@/lib/transit";

const SlideUp = forwardRef(function SlideUp(props: TransitionProps & { children: ReactElement }, ref: Ref<unknown>) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const PLACEHOLDERS = ["search.searchPlaceholder1", "search.searchPlaceholder2", "search.searchPlaceholder3", "search.searchPlaceholder4", "search.searchPlaceholder5"];
const IS_MOBILE = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);
const DEBOUNCE_MS = 1000;
const RECENT_LIMIT = 10;
const ROUTES_PREVIEW = 5;

type SearchVehicle = [vehicleId: string, route: RouteTuple, brigade: string, headsign: string | null, model: string | null];
type SearchStop = [firstStopId: string, city: string, groupName: string, stops: StopTupleDetailed[]];
type RawSearch = { positions: SearchVehicle[]; stops: SearchStop[]; routes: RouteTuple[] };

const recentKey = (city: string) => `czynalive:${city}.lastSearches`;
const readRecent = (city: string): string[] => {
    try {
        const value = JSON.parse(localStorage.getItem(recentKey(city)) ?? "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
};
const pushRecent = (city: string, query: string) => {
    const next = [...new Set([...readRecent(city).filter((item) => item !== query), query])].slice(-RECENT_LIMIT);
    try {
        localStorage.setItem(recentKey(city), JSON.stringify(next));
    } catch {}
    return next;
};

const escapeRegExp = (char: string) => char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Bold every fragment of `text` matching the query, ignoring spaces, dots and dashes like the original.
export const Highlight = ({ text, query }: { text: string; query: string }) => {
    if (!query || !text) return <>{text}</>;
    const pattern = new RegExp(query.split("").map(escapeRegExp).join("[-\\s.]*"), "ig");
    const parts: ReactNode[] = [];
    let last = 0;
    let match = pattern.exec(text);
    while (match !== null) {
        if (match.index > last) parts.push(<Fragment key={`t-${last}`}>{text.slice(last, match.index)}</Fragment>);
        parts.push(<b key={`m-${match.index}`}>{match[0]}</b>);
        last = match.index + match[0].length;
        if (match.index === pattern.lastIndex) pattern.lastIndex++;
        match = pattern.exec(text);
    }
    if (last < text.length) parts.push(<Fragment key={`t-${last}`}>{text.slice(last)}</Fragment>);
    return <>{parts}</>;
};

const HowToUse = () => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    return (
        <Box>
            <Typography variant="subtitle2" style={{ margin: "10px 0 5px" }}>
                {t("search.howToUse")}
                <ShowMoreButton expanded={open} onClick={() => setOpen((value) => !value)} />
            </Typography>
            {open && (
                <ul>
                    {[1, 2, 3, 4].map((part) => (
                        <li key={part}>
                            <Typography variant="body2" style={{ margin: "10px 0 5px" }}>
                                <Trans i18nKey={`search.searchInstructionPart${part}`} components={[<strong key="1" />]} />
                            </Typography>
                        </li>
                    ))}
                </ul>
            )}
        </Box>
    );
};

const VehicleResult = ({ city, vehicle, query }: { city: string; vehicle: SearchVehicle; query: string }) => {
    const { t } = useTranslation();
    const [vehicleId, route, brigade, headsign] = vehicle;
    const number = parseVehicleId(vehicleId).number;
    const brigadeQuery = query.split("/")[1] || "";
    return (
        <ListRow to={`/${city}?pojazd=${encodeURIComponent(vehicleId)}`} onClick={() => setShowSearch(false)} action="navigate" column>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", maxWidth: "100%" }}>
                <RouteNameBadge routeName={route[ERouteTuple.routeName]} type={route[ERouteTuple.routeType]} isLive text={headsign ? <Highlight text={headsign} query={query} /> : ""} angledDivider />
                <Typography component="div" variant="body2" color="textSecondary">
                    <span>
                        {route[ERouteTuple.routeName] === "WKD" ? t("global.trainNo") : t("global.vehicleNo")} <Highlight text={number} query={query} />
                    </span>
                    {brigade && (
                        <span>
                            , {t("global.brigade").toLowerCase()} <Highlight text={brigade} query={brigadeQuery} />
                        </span>
                    )}
                    <br />
                </Typography>
            </Box>
        </ListRow>
    );
};

const StopResult = ({ city, stop, query }: { city: string; stop: StopTupleDetailed; query: string }) => {
    const [expanded, setExpanded] = useState(false);
    const routes = stop[EStopTuple.routes] ?? [];
    const direction = stop[EStopTuple.direction] ?? "";
    const long = routes.length > ROUTES_PREVIEW;
    const shown = long && !expanded ? routes.slice(0, ROUTES_PREVIEW) : routes;
    const cityQuery = stop[EStopTuple.city] !== city ? `&miasto=${stop[EStopTuple.city]}` : "";
    return (
        <ListRow to={`/${city}?przystanek=${encodeURIComponent(stop[EStopTuple.stopId])}${cityQuery}`} onClick={() => setShowSearch(false)} action="navigate" column>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.5, maxWidth: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5, maxWidth: "100%" }}>
                    <StopNameBadge stopTypes={stop[EStopTuple.vehicleTypes]} text={<Highlight text={stop[EStopTuple.stopName]} query={query} />} angledDivider />
                    {direction !== "" && (
                        <Typography variant="body2" color="textSecondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <EastIcon fontSize="inherit" /> {direction}
                        </Typography>
                    )}
                </Box>
                {routes.length > 0 && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5, alignItems: "center" }}>
                        {shown.map((route, index) => (
                            <Fragment key={`${route[ERouteTuple.city]}-${route[ERouteTuple.routeId]}`}>
                                <RouteChip
                                    name={route[ERouteTuple.routeName]}
                                    type={route[ERouteTuple.routeType]}
                                    animate={false}
                                    sx={{ height: "22px", fontSize: "0.875rem", "& .MuiChip-label": { paddingLeft: "8px", paddingRight: "8px" } }}
                                />
                                {long && expanded && index === ROUTES_PREVIEW - 1 && <ShowMoreButton expanded={expanded} onClick={() => setExpanded((value) => !value)} />}
                            </Fragment>
                        ))}
                        {long && <ShowMoreButton expanded={expanded} onClick={() => setExpanded((value) => !value)} />}
                    </Box>
                )}
            </Box>
        </ListRow>
    );
};

// "Pokaż wszystkie pojazdy tej linii na mapie" / "no vehicle on line X" above the results.
const RouteShortcut = ({ city, query, data }: { city: string; query: string; data: RawSearch }) => {
    const { t } = useTranslation();
    const lower = query.toLowerCase();
    const vehicle = data.positions.find(([, route]) => route[ERouteTuple.routeName].toLowerCase() === lower);
    if (vehicle) {
        const route = vehicle[1];
        return (
            <>
                <Box sx={{ px: 0 }}>
                    <Button
                        component={Link}
                        to={`/${city}?lines=${encodeURIComponent(`${route[ERouteTuple.routeType]}/${route[ERouteTuple.routeId]}`)}`}
                        onClick={() => setShowSearch(false)}
                        variant="outlined"
                        fullWidth
                        sx={{
                            justifyContent: "space-between",
                            textTransform: "none",
                            gap: 1,
                            px: 1.25,
                            py: 0.75,
                            color: "text.primary",
                            borderColor: "divider",
                            "&:hover": { borderColor: "text.secondary" },
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
                            <RouteChip name={route[ERouteTuple.routeName]} type={route[ERouteTuple.routeType]} animate={false} sx={{ flexShrink: 0 }} />
                            <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, textAlign: "left" }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
                                    {t("search.showLineVehicles")}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic", lineHeight: 1.25 }}>
                                    {t("search.willFilterMap")}
                                </Typography>
                            </Box>
                        </Box>
                        <ArrowForwardIcon sx={{ color: "text.secondary", flexShrink: 0 }} />
                    </Button>
                </Box>
                <Divider style={{ margin: "10px 0" }} sx={{ opacity: "0.6" }} />
            </>
        );
    }
    if (!data.routes.some((route) => route[ERouteTuple.routeName].toLowerCase() === lower)) return null;
    return (
        <>
            <Typography variant="subtitle2" style={{ margin: "5px 0" }}>
                <Trans i18nKey="search.noRouteIdVehicleFound" values={{ route_id: query.toUpperCase() }} components={[<strong key="1" />]} />
            </Typography>
            <Divider style={{ margin: "10px 0" }} sx={{ opacity: "0.6" }} />
        </>
    );
};

const Results = ({ city, query, debounced }: { city: string; query: string; debounced: string }) => {
    const { t } = useTranslation();
    const [state, setState] = useState<{ query: string; data?: RawSearch; error?: boolean }>({ query: "" });

    useEffect(() => {
        if (!debounced) return;
        const controller = new AbortController();
        cityGet<RawSearch>(city, "/search", { query: debounced, raw: true }, controller.signal)
            .then((data) => setState({ query: debounced, data }))
            .catch((error) => {
                if (!controller.signal.aborted) setState({ query: debounced, error: !!error });
            });
        return () => controller.abort();
    }, [city, debounced]);

    if (query.trim() === "") return null;
    if (state.query !== debounced || query.trim() !== debounced) {
        return (
            <div>
                <Typography variant="subtitle2" noWrap style={{ margin: "10px 0 5px" }}>
                    {t("global.searching")}...
                </Typography>
                <div style={{ margin: 10 }}>
                    {["a", "b", "c"].map((key) => (
                        <Skeleton key={key} animation="wave" variant="text" height={50} width="100%" style={{ marginBottom: 5 }} />
                    ))}
                </div>
            </div>
        );
    }
    if (state.error || !state.data) {
        return (
            <Typography variant="body2" noWrap style={{ margin: "5px 0" }}>
                {t("global.error")}
            </Typography>
        );
    }
    const data = state.data;
    const stops = (data.stops ?? []).flatMap((group) => group[3]);
    const total = (data.positions?.length ?? 0) + stops.length;
    if (total === 0) {
        const isRoute = (data.routes ?? []).some((route) => route[ERouteTuple.routeName].toLowerCase() === debounced.toLowerCase());
        return (
            <Typography variant="subtitle2" style={{ margin: "10px 0" }}>
                {isRoute ? <Trans i18nKey="search.noRouteIdVehicleFound" values={{ route_id: debounced.toUpperCase() }} components={[<strong key="1" />]} /> : t("global.nothingFound")}
            </Typography>
        );
    }
    const items: ReactNode[] = [
        ...(data.positions ?? []).map((vehicle) => <VehicleResult key={`v-${vehicle[0]}`} city={city} vehicle={vehicle} query={debounced} />),
        ...stops.map((stop) => <StopResult key={`s-${stop[EStopTuple.stopId]}`} city={city} stop={stop} query={debounced} />),
    ];
    return (
        <List sx={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            <RouteShortcut city={city} query={debounced} data={{ positions: data.positions ?? [], stops: data.stops ?? [], routes: data.routes ?? [] }} />
            {items.map((item, index) => (
                <div key={index} style={{ marginBottom: index === items.length - 1 ? "max(65px, calc(var(--sab) + 65px))" : "0" }}>
                    {item}
                </div>
            ))}
        </List>
    );
};

const RecentSearches = ({ recent, onPick, onClear }: { recent: string[]; onPick: (value: string) => void; onClear: () => void }) => {
    const { t } = useTranslation();
    const dark = useThemeMode() === "dark";
    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <Typography variant="subtitle2" noWrap style={{ margin: "10px 0 5px" }}>
                    {t("search.lastSearched")}:
                </Typography>
                <Button size="small" color="primary" variant={dark ? "contained" : "outlined"} onClick={onClear}>
                    {t("global.clear")}
                </Button>
            </div>
            <List style={{ overflowY: "auto", flex: 1, minHeight: 0, paddingBottom: "max(80px, calc(var(--sab) + 80px))" }}>
                {recent.map((item) => (
                    <ListRow
                        key={item}
                        onClick={() => onPick(item)}
                        primary={<Typography variant="body1">{item}</Typography>}
                        trailing={
                            <IconButton edge="end" size="large">
                                <SearchIcon />
                            </IconButton>
                        }
                    />
                ))}
            </List>
        </div>
    );
};

// Global search opened from the top bar lupa (original: full-screen dialog with live results and recent queries).
export default function GlobalSearch() {
    const { t } = useTranslation();
    const [settings] = useSettings();
    const city = settings.city ?? "";
    const open = useShell((shell) => shell.showSearch);
    const [query, setQuery] = useState("");
    const [debounced, setDebounced] = useState("");
    const [recent, setRecent] = useState<string[]>(() => [...readRecent(city)].reverse());
    const close = () => setShowSearch(false);
    const placeholder = useMemo(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)], []);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [query]);
    useEffect(() => {
        if (debounced && city) setRecent([...pushRecent(city, debounced)].reverse());
    }, [debounced]);
    useEffect(() => setRecent([...readRecent(city)].reverse()), [city]);

    return (
        <Dialog open={open} onClose={close} scroll="paper" style={{ overflowX: "hidden" }} fullScreen slots={{ transition: SlideUp }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="subtitle1" style={{ padding: "4px 10px" }}>
                    {t("search.search")}
                </Typography>
                <IconButton onClick={close} size="large">
                    <CloseIcon />
                </IconButton>
            </Box>
            <DialogContent dividers style={{ padding: "0 5px 16px 5px", overflowY: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ flexShrink: 0 }}>
                    <HowToUse />
                    <form autoComplete="off" noValidate onSubmit={(event) => event.preventDefault()}>
                        <TextField
                            autoFocus={!IS_MOBILE}
                            label={t("search.search")}
                            placeholder={t(placeholder)}
                            margin="normal"
                            type="search"
                            value={query}
                            variant="outlined"
                            onChange={(event) => setQuery(event.target.value)}
                            onFocus={() => window.scrollTo({ top: 0, behavior: "auto" })}
                            size="small"
                            fullWidth
                            sx={{ mb: 0 }}
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            {query !== "" && (
                                                <IconButton aria-label="clear" size="small" onClick={() => setQuery("")}>
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                            <IconButton type="submit" edge="end" size="large">
                                                <SearchIcon />
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                },
                                inputLabel: { shrink: true },
                            }}
                        />
                    </form>
                    <Divider sx={{ opacity: 0.6 }} />
                </div>
                <div style={{ margin: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                    {city && <Results city={city} query={query} debounced={debounced} />}
                    {recent.length > 0 && !debounced && !query.trim() && (
                        <RecentSearches
                            recent={recent}
                            onPick={(value) => {
                                setQuery(value);
                                setDebounced(value);
                            }}
                            onClear={() => {
                                try {
                                    localStorage.removeItem(recentKey(city));
                                } catch {}
                                setRecent([]);
                            }}
                        />
                    )}
                </div>
            </DialogContent>
            <DialogActions style={{ justifyContent: "flex-end", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0))" }}>
                <Button onClick={close} className="text-default-text">
                    {t("global.close")}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
