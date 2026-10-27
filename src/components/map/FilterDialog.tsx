import { virtualCitiesOf } from "@/api/virtualCities";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DirectionsBusIcon from "@mui/icons-material/DirectionsBus";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import RouteIcon from "@mui/icons-material/Route";
import ShareIcon from "@mui/icons-material/Share";
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    Divider,
    FormControl,
    IconButton,
    InputLabel,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemSecondaryAction,
    ListItemText,
    MenuItem,
    Select,
    Skeleton,
    Tab,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useCity } from "@/api/cities";
import { cityGet } from "@/api/client";
import { ERouteTuple, EVehiclePosition, RouteType, type RouteTuple, type StopTuple, type VehiclePosition } from "@/api/types";
import { ShowMoreButton, VehicleTypeChip } from "@/components/departures/parts";
import { typeIcons, vehicleTypeName } from "@/components/departures/VehicleTypeIcon";
import { typeReadableKey, useThemeMode } from "@/components/timetable/common";
import { ClearButton, LineSearchField } from "@/components/timetable/SearchField";
import { parseVehicleId } from "@/lib/transit";
import { DialogTitleBar } from "./DialogTitleBar";
import { openSse } from "./sse";
import { shareLink } from "./share";

export type MapFilter = { routes: string[]; vehicleTypes: number[]; vehicles: string[] };

type Props = {
    open: boolean;
    city: string;
    value: MapFilter;
    showStops: boolean;
    onClose: () => void;
    onApply: (value: MapFilter, showStops: boolean) => void;
    onReset: () => void;
    onToast: (text: string) => void;
};

// czynaczas type order of the filter (ferry, metro, tram, trolleybus, bus, rail).
const TYPE_ORDER = [RouteType.Ferry, RouteType.Subway, RouteType.Tram, RouteType.Trolleybus, RouteType.Bus, RouteType.Rail];
const typeRank = (type: number) => (TYPE_ORDER.includes(type) ? TYPE_ORDER.indexOf(type) : TYPE_ORDER.length);
const collator = new Intl.Collator("pl", { numeric: true, sensitivity: "base" });
const lineKey = (route: RouteTuple) => `${route[ERouteTuple.routeType]}/${route[ERouteTuple.routeId]}`;
const STOP_PATH = "M17 10H7v2h10zm2-7h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m0 16H5V8h14zm-5-5H7v2h7z";
const SELECTED_PREVIEW = 2;
const MIN_SEARCH = 3;

type Overview = { routes: RouteTuple[]; lineCounts: Record<string, number>; typeCounts: Record<number, number>; stopsCount: number };
const overviewCache = new Map<string, Overview>();

// Every route of the city with its live vehicle count and the city's stop count (one whole-city snapshot per dialog).
const useCityOverview = (city: string, open: boolean) => {
    const cityInfo = useCity(city);
    const [overview, setOverview] = useState<Overview | null>(() => overviewCache.get(city) ?? null);
    useEffect(() => {
        if (!open || !cityInfo) return;
        let closed = false;
        let handle: { close: () => void } | null = null;
        virtualCitiesOf(city)
            .then((virtual) => Promise.all([cityGet<RouteTuple[]>(city, "/routes"), ...virtual.map(([virtualCity]) => cityGet<RouteTuple[]>(virtualCity, "/routes").catch(() => []))]))
            .then(([ownRoutes, ...virtualLists]) => {
                const ownKeys = new Set(ownRoutes.map(lineKey));
                const virtualRoutes = virtualLists.flat().filter((route) => !ownKeys.has(lineKey(route)));
                const routes = ownRoutes;
                if (closed) return;
                const base: Overview = overviewCache.get(city) ?? { routes, lineCounts: {}, typeCounts: {}, stopsCount: 0 };
                setOverview({ ...base, routes });
                const [lon, lat] = cityInfo.location;
                const bounds = [lon - 0.9, lat - 0.6, lon + 0.9, lat + 0.6].map((value) => value.toFixed(4)).join(",");
                let stopsCount = base.stopsCount;
                handle = openSse<{ stops: StopTuple[] }, { positions: VehiclePosition[] }>(
                    `/${city}/mapFeatures/15/${bounds}/stream`,
                    { graph: 1, filterRoutes: [...new Set([...routes, ...virtualRoutes].map((route) => route[ERouteTuple.routeId]))].join(",") },
                    {
                        onInitial: (initial) => {
                            stopsCount = initial.stops?.length ?? 0;
                        },
                        onMessage: (message) => {
                            const lineCounts: Record<string, number> = {};
                            const typeCounts: Record<number, number> = {};
                            for (const position of message.positions ?? []) {
                                const route = position[EVehiclePosition.route];
                                const key = lineKey(route);
                                lineCounts[key] = (lineCounts[key] ?? 0) + 1;
                                typeCounts[route[ERouteTuple.routeType]] = (typeCounts[route[ERouteTuple.routeType]] ?? 0) + 1;
                            }
                            // Virtual-city lines (trains, coaches) are listed only while they run in the city's area.
                            const next = { routes: [...routes, ...virtualRoutes.filter((route) => lineCounts[lineKey(route)])], lineCounts, typeCounts, stopsCount };
                            overviewCache.set(city, next);
                            setOverview(next);
                            handle?.close();
                        },
                    },
                );
            })
            .catch(() => undefined);
        return () => {
            closed = true;
            handle?.close();
        };
    }, [open, city, !!cityInfo]);
    return overview;
};

const LineButton = ({ route, selected, count, onClick }: { route: RouteTuple; selected: boolean; count?: number; onClick: () => void }) => {
    const { t } = useTranslation();
    const dark = useThemeMode() === "dark";
    const type = route[ERouteTuple.routeType];
    const name = vehicleTypeName(type);
    const className = selected ? `border-tiny-${name} bg-${name} text-white` : dark ? `border-tiny-${name} text-default-text bg-default-bg` : `border-tiny-${name} text-${name} bg-white`;
    return (
        <Button fullWidth variant="outlined" className={className} sx={[{ flexDirection: "column", height: "100%" }, count !== undefined ? { p: 0 } : { p: 0.5 }]} onClick={onClick}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {selected ? typeIcons(type).whiteIcon : dark ? typeIcons(type).whiteIcon : typeIcons(type).icon}
                {route[ERouteTuple.routeName]}
            </Box>
            {count !== undefined && <Box sx={[{ fontSize: "0.625rem" }, count === 0 ? { opacity: 0.7 } : { opacity: 1 }]}>{t("plural.vehicle", { count })}</Box>}
        </Button>
    );
};

const TypeButton = ({ type, selected, count, onClick }: { type: number; selected: boolean; count?: number; onClick: () => void }) => {
    const { t } = useTranslation();
    const dark = useThemeMode() === "dark";
    const name = vehicleTypeName(type);
    const className = selected ? `border-tiny-${name} bg-${name} text-white` : dark ? `border-tiny-${name} text-default-text bg-default-bg` : `border-tiny-${name} text-${name} bg-white`;
    return (
        <Button fullWidth variant="outlined" onClick={onClick} className={className} sx={[{ flexDirection: "column", height: "100%" }, count !== undefined ? { p: 0 } : { p: 0.5 }]}>
            <Box sx={{ display: "flex", alignItems: "center" }}>{selected || dark ? typeIcons(type).whiteIcon : typeIcons(type).icon}</Box>
            {count !== undefined && <Box sx={[{ fontSize: "0.625rem" }, count === 0 ? { opacity: 0.7 } : { opacity: 1 }]}>{t("plural.vehicle", { count })}</Box>}
        </Button>
    );
};

const StopsButton = ({ selected, count, onClick }: { selected: boolean; count: number; onClick: () => void }) => {
    const { t } = useTranslation();
    const dark = useThemeMode() === "dark";
    const className = selected ? "border-tiny-primary bg-primary text-white" : dark ? "border-tiny-primary text-default-text bg-default-bg" : "border-tiny-primary text-primary bg-white";
    return (
        <Button fullWidth variant="outlined" className={className} onClick={onClick} sx={[{ flexDirection: "column", height: "100%" }, { p: 0 }]}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
                <svg className="MuiSvgIcon-root" viewBox="0 0 24 24" style={{ width: "1.5em", height: "1.5em", fill: "currentColor" }}>
                    <path d={STOP_PATH} />
                </svg>
            </Box>
            <div style={{ fontSize: "0.625rem", opacity: count === 0 ? 0.7 : 1 }}>{t("plural.stop", { count })}</div>
        </Button>
    );
};

const TabLabel = ({ label, count }: { label: string; count: number }) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        {label}
        {count > 0 && <Chip label={count} size="small" color="primary" sx={{ height: 20, minWidth: 20, "& .MuiChip-label": { px: 0.75 } }} />}
    </Box>
);

const vehicleChip = (vehicleId: string, onClick?: () => void) => {
    const { number, type } = parseVehicleId(vehicleId);
    return (
        <Chip
            key={vehicleId}
            label={number}
            icon={<span style={{ display: "inline-flex", marginLeft: 6 }}>{typeIcons(type).chipIcon}</span>}
            size="small"
            className={`bg-${vehicleTypeName(type)} text-white`}
            sx={{ borderRadius: "6px", cursor: onClick ? "pointer" : undefined }}
            onClick={onClick}
        />
    );
};

type PositionSearch = [VehiclePosition, string, string][];

// "Pojazdy" tab: chosen vehicles, live search by fleet number and manual entry.
const VehiclesTab = ({ city, selected, onChange }: { city: string; selected: string[]; onChange: (next: string[]) => void }) => {
    const { t } = useTranslation();
    const dark = useThemeMode() === "dark";
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState("");
    const [debounced, setDebounced] = useState("");
    const [results, setResults] = useState<PositionSearch | null>(null);
    const [searching, setSearching] = useState(false);
    const [manualType, setManualType] = useState<number>(RouteType.Bus);
    const [manualNumber, setManualNumber] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(query.trim()), 500);
        return () => clearTimeout(timer);
    }, [query]);
    useEffect(() => {
        if (debounced.length < MIN_SEARCH) return setResults(null);
        const controller = new AbortController();
        setSearching(true);
        cityGet<PositionSearch>(city, "/positions/search", { query: debounced }, controller.signal)
            .then((found) => setResults(found))
            .catch(() => setResults([]))
            .finally(() => setSearching(false));
        return () => controller.abort();
    }, [debounced, city]);

    const toggle = (vehicleId: string) => onChange(selected.includes(vehicleId) ? selected.filter((id) => id !== vehicleId) : [...selected, vehicleId]);
    const shown = expanded ? selected : selected.slice(0, 4);
    const addManual = () => {
        const number = manualNumber.trim();
        if (!number) return;
        const vehicleId = `${manualType}:${number}`;
        if (!selected.includes(vehicleId)) onChange([...selected, vehicleId]);
        setManualNumber("");
    };

    return (
        <Box sx={{ mx: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle1">
                    <strong>{t("map.filterVehiclesHeader")}:</strong>
                </Typography>
                {selected.length > 0 && (
                    <Button variant={dark ? "contained" : "outlined"} size="small" onClick={() => onChange([])}>
                        {t("global.clear")}
                    </Button>
                )}
            </Box>
            <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mt: 1 }}>
                    {t("map.filterSelectedVehicles")}:
                </Typography>
                {selected.length === 0 ? (
                    <Typography variant="subtitle2" noWrap sx={{ mb: 1 }}>
                        {t("map.filterNoSelectedVehicles")}.
                    </Typography>
                ) : (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1, alignItems: "center" }}>
                        {shown.map((vehicleId) => vehicleChip(vehicleId, () => toggle(vehicleId)))}
                        {selected.length > 4 && (
                            <Box sx={{ display: "flex", alignItems: "center" }}>
                                {!expanded && (
                                    <Box sx={{ fontSize: "0.875rem" }}>
                                        <Trans i18nKey="alerts.andXMore" values={{ count: selected.length - 4 }} components={[<strong key="1" />]} />
                                    </Box>
                                )}
                                <ShowMoreButton expanded={expanded} onClick={() => setExpanded((value) => !value)} />
                            </Box>
                        )}
                    </Box>
                )}
            </Box>
            <Box>
                <Typography variant="subtitle2" noWrap>
                    {t("map.filterSearchVehicle")}:
                </Typography>
                <form autoComplete="off" noValidate onSubmit={(event) => event.preventDefault()}>
                    <TextField
                        label={t("global.vehicles")}
                        placeholder={t("favourites.searchVehiclesByVehicleNo")}
                        margin="normal"
                        type="search"
                        value={query}
                        variant="outlined"
                        onChange={(event) => setQuery(event.target.value)}
                        size="small"
                        fullWidth
                        slotProps={{ input: { endAdornment: <ClearButton visible={query !== ""} onClear={() => setQuery("")} /> }, inputLabel: { shrink: true } }}
                    />
                </form>
                {query.length > 0 && debounced.length > 0 && debounced.length < MIN_SEARCH && (
                    <Typography variant="subtitle2" noWrap sx={{ my: "10px 0 5px" }}>
                        {t("global.atLeastXChars", { count: MIN_SEARCH })}
                    </Typography>
                )}
                {searching && results === null && (
                    <div>
                        <Typography variant="subtitle2" noWrap sx={{ my: "10px 0 5px" }}>
                            {t("global.searching")}...
                        </Typography>
                        <Skeleton animation="wave" variant="text" height={50} />
                    </div>
                )}
                {results && results.length === 0 && debounced === query.trim() && (
                    <Typography variant="subtitle2" noWrap sx={{ my: "10px 0 5px" }}>
                        {t("global.nothingFound")}
                    </Typography>
                )}
                {results && results.length > 0 && (
                    <Box>
                        <Typography variant="subtitle2" noWrap sx={{ my: "10px 0 5px" }}>
                            {t("global.searchResults")}:
                        </Typography>
                        <List dense>
                            {results.map(([position]) => {
                                const vehicleId = position[EVehiclePosition.id];
                                const { number } = parseVehicleId(vehicleId);
                                const type = position[EVehiclePosition.route][ERouteTuple.routeType];
                                const isSelected = selected.includes(vehicleId);
                                return (
                                    <Box key={vehicleId}>
                                        <ListItemButton onClick={() => toggle(vehicleId)}>
                                            <ListItemIcon>
                                                <VehicleTypeChip types={[type]} />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Typography variant="body1">
                                                        {t("global.vehicleNoShort")} {number}
                                                    </Typography>
                                                }
                                            />
                                            <ListItemSecondaryAction>
                                                <IconButton size="large" onClick={() => toggle(vehicleId)}>
                                                    {isSelected ? <RemoveCircleOutlineIcon /> : <AddCircleOutlineIcon />}
                                                </IconButton>
                                            </ListItemSecondaryAction>
                                        </ListItemButton>
                                        <Divider sx={{ opacity: "0.6" }} />
                                    </Box>
                                );
                            })}
                        </List>
                    </Box>
                )}
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" noWrap sx={{ mt: 1, mb: 2 }}>
                {t("map.filterManualAddVehicle")}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 100 }, flex: { xs: "1 1 100%", sm: "0 0 auto" } }}>
                        <InputLabel>{t("global.type")}</InputLabel>
                        <Select value={manualType} label={t("global.type")} onChange={(event) => setManualType(Number(event.target.value))}>
                            {[RouteType.Bus, RouteType.Tram, RouteType.Trolleybus, RouteType.Subway, RouteType.Rail, RouteType.Ferry].map((type) => (
                                <MenuItem key={type} value={type}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        {typeIcons(type).verticalLineIcon}
                                        {t(typeReadableKey(type))}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        label={t("global.vehicleNo")}
                        placeholder={t("map.filterVehicleNoPlaceholder")}
                        size="small"
                        value={manualNumber}
                        onChange={(event) => setManualNumber(event.target.value)}
                        sx={{ flex: { xs: "1 1 100%", sm: 1 }, minWidth: { xs: "100%", sm: 120 } }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                addManual();
                            }
                        }}
                    />
                    <Button variant="contained" onClick={addManual} disabled={!manualNumber.trim()} sx={{ height: 40, display: { xs: "none", sm: "flex" } }}>
                        {t("global.add")}
                    </Button>
                </Box>
                <Button variant="contained" onClick={addManual} disabled={!manualNumber.trim()} fullWidth sx={{ height: 40, display: { xs: "flex", sm: "none" } }}>
                    {t("global.add")}
                </Button>
            </Box>
            <Divider sx={{ my: 2 }} />
        </Box>
    );
};

// "Filtruj mapę": lines (per type or one by one), stops toggle and individual vehicles.
export const FilterDialog = ({ open, city, value, showStops, onClose, onApply, onReset, onToast }: Props) => {
    const { t } = useTranslation();
    const dark = useThemeMode() === "dark";
    const [tab, setTab] = useState<"lines" | "vehicles">("lines");
    const [lines, setLines] = useState<string[]>(value.routes);
    const [vehicles, setVehicles] = useState<string[]>(value.vehicles);
    const [stops, setStops] = useState(showStops);
    const [query, setQuery] = useState("");
    const [expanded, setExpanded] = useState(false);
    const overview = useCityOverview(city, open);

    useEffect(() => {
        if (!open) return;
        setLines(value.routes);
        setVehicles(value.vehicles);
        setStops(showStops);
    }, [open]);

    const routes = useMemo(
        () =>
            [...(overview?.routes ?? [])].sort(
                (a, b) =>
                    typeRank(a[ERouteTuple.routeType]) - typeRank(b[ERouteTuple.routeType]) ||
                    collator.compare(a[ERouteTuple.routeName], b[ERouteTuple.routeName]) ||
                    Number(b[ERouteTuple.routeAgency] === "default") - Number(a[ERouteTuple.routeAgency] === "default"),
            ),
        [overview?.routes],
    );
    const types = useMemo(() => [...new Set(routes.map((route) => route[ERouteTuple.routeType]))].sort((a, b) => typeRank(a) - typeRank(b)), [routes]);
    const byId = useMemo(() => new Map(routes.map((route) => [route[ERouteTuple.routeId], route])), [routes]);
    const text = query.trim().toUpperCase();
    const visible = text ? routes.filter((route) => route[ERouteTuple.routeName].toUpperCase().includes(text)) : routes;
    const selectedTypes = new Set(types.filter((type) => routes.filter((route) => route[ERouteTuple.routeType] === type).every((route) => lines.includes(route[ERouteTuple.routeId]))));
    const filtering = value.routes.length > 0 || value.vehicles.length > 0 || !showStops;
    const hasSelection = lines.length > 0 || vehicles.length > 0;

    const toggleLine = (routeId: string) => setLines((prev) => (prev.includes(routeId) ? prev.filter((id) => id !== routeId) : [...prev, routeId]));
    const toggleType = (type: number) => {
        const ids = routes.filter((route) => route[ERouteTuple.routeType] === type).map((route) => route[ERouteTuple.routeId]);
        setLines((prev) => (selectedTypes.has(type) ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
    };

    const share = async () => {
        const params = new URLSearchParams();
        if (lines.length) params.set("lines", lines.join(","));
        if (vehicles.length) params.set("vehicles", vehicles.join(","));
        const result = await shareLink(t("map.filterShareDescription"), t("map.filterShareCustomDescription"), `${window.location.origin}/${city}?${params}`);
        if (result === "copied") onToast(t("global.copied"));
    };

    const shownSelected = expanded ? lines : lines.slice(0, SELECTED_PREVIEW);

    return (
        <Dialog open={open} onClose={onClose} scroll="paper" sx={{ overflowX: "hidden" }} fullScreen>
            <DialogTitleBar title={t("map.filterDialogHeader")} onClose={onClose}>
                <Tooltip title={t("global.share")}>
                    <span>
                        <IconButton onClick={share} size="large" disabled={!hasSelection}>
                            <ShareIcon />
                        </IconButton>
                    </span>
                </Tooltip>
            </DialogTitleBar>
            <Tabs
                value={tab}
                onChange={(_, next) => setTab(next)}
                variant="fullWidth"
                indicatorColor="primary"
                textColor="primary"
                aria-label={t("map.filterTabs")}
                sx={{ borderBottom: 1, borderColor: "divider", minHeight: "35px" }}
            >
                <Tab icon={<RouteIcon fontSize="small" />} iconPosition="start" label={<TabLabel label={t("map.filterTabLines")} count={lines.length} />} value="lines" sx={{ minHeight: "35px", py: 0 }} />
                <Tab icon={<DirectionsBusIcon fontSize="small" />} iconPosition="start" label={<TabLabel label={t("map.filterTabVehicles")} count={vehicles.length} />} value="vehicles" sx={{ minHeight: "35px", py: 0 }} />
            </Tabs>
            <DialogContent dividers sx={{ p: 0, pb: 2, pt: 2 }}>
                {tab === "lines" &&
                    (!overview ? (
                        <Box sx={{ mx: 2 }}>
                            {["a", "b", "c"].map((key) => (
                                <Skeleton key={key} animation="wave" variant="text" height={50} />
                            ))}
                        </Box>
                    ) : (
                        <Box sx={{ mx: 2 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                                <Typography variant="subtitle1">
                                    <strong>{t("map.filterHeader")}:</strong>
                                </Typography>
                                {lines.length > 0 && (
                                    <Button variant={dark ? "contained" : "outlined"} size="small" onClick={() => setLines([])}>
                                        {t("global.clear")}
                                    </Button>
                                )}
                            </Box>
                            <Typography variant="subtitle2" noWrap sx={{ mt: 1 }}>
                                {t("map.filterSelectedLines")}:
                            </Typography>
                            <Grid container spacing={1} sx={{ alignItems: "center" }}>
                                {lines.length === 0 && (
                                    <Grid size={12}>
                                        <Typography variant="subtitle2" noWrap sx={{ mb: 1 }}>
                                            {t("map.filterNoSelectedLines")}.
                                        </Typography>
                                    </Grid>
                                )}
                                {shownSelected.map((routeId) => {
                                    const route = byId.get(routeId);
                                    return route ? (
                                        <Grid key={routeId} size={{ xs: 4, sm: 3, md: 2, lg: 1 }}>
                                            <LineButton route={route} selected onClick={() => toggleLine(routeId)} />
                                        </Grid>
                                    ) : null;
                                })}
                                {lines.length > SELECTED_PREVIEW && (
                                    <Grid size={{ xs: 4, sm: 3, md: 2, lg: 1 }} sx={{ display: "flex", alignItems: "center" }}>
                                        {!expanded && (
                                            <Box sx={{ fontSize: "0.875rem" }}>
                                                <Trans i18nKey="alerts.andXMore" values={{ count: lines.length - SELECTED_PREVIEW }} components={[<strong key="1" />]} />
                                            </Box>
                                        )}
                                        <ShowMoreButton expanded={expanded} onClick={() => setExpanded((value) => !value)} />
                                    </Grid>
                                )}
                            </Grid>
                            <LineSearchField value={query} onChange={setQuery} headerLabel={`${t("map.filterSearchLine")}:`} />
                            <Grid container spacing={1} sx={{ pt: 1 }}>
                                {types.map((type) => (
                                    <Grid key={type} size="grow">
                                        <TypeButton type={type} selected={selectedTypes.has(type)} count={overview.typeCounts[type] ?? 0} onClick={() => toggleType(type)} />
                                    </Grid>
                                ))}
                                <Grid size="grow">
                                    <StopsButton selected={stops} count={overview.stopsCount} onClick={() => setStops((value) => !value)} />
                                </Grid>
                            </Grid>
                            <Divider sx={{ my: 2 }} />
                            {visible.length === 0 ? (
                                <Typography variant="subtitle2" noWrap sx={{ mt: 2, mx: 0 }}>
                                    {t("global.nothingFound")}
                                </Typography>
                            ) : (
                                <Grid container spacing={1} sx={{ alignItems: "center" }}>
                                    {visible.map((route) => (
                                        <Grid key={`${route[ERouteTuple.city]}/${route[ERouteTuple.routeId]}`} size={{ xs: 4, sm: 3, md: 2, lg: 1 }}>
                                            <LineButton
                                                route={route}
                                                selected={lines.includes(route[ERouteTuple.routeId])}
                                                count={overview.lineCounts[lineKey(route)] ?? 0}
                                                onClick={() => toggleLine(route[ERouteTuple.routeId])}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </Box>
                    ))}
                {tab === "vehicles" && <VehiclesTab city={city} selected={vehicles} onChange={setVehicles} />}
            </DialogContent>
            <DialogActions sx={{ justifyContent: "space-between", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0))" }}>
                <div>
                    {filtering && (
                        <Button
                            color="primary"
                            size="small"
                            variant={dark ? "contained" : "text"}
                            onClick={() => {
                                onReset();
                                onClose();
                            }}
                        >
                            {t("global.reset")}
                        </Button>
                    )}
                </div>
                <div>
                    <Button onClick={onClose} className="text-default-text">
                        {t("global.cancel")}
                    </Button>
                    <Button
                        onClick={() => {
                            onApply({ routes: lines, vehicleTypes: [], vehicles }, stops);
                            onClose();
                        }}
                        color="primary"
                        size="small"
                        variant={dark ? "contained" : "text"}
                    >
                        {t("global.save")}
                    </Button>
                </div>
            </DialogActions>
        </Dialog>
    );
};
