import IosShareIcon from "@mui/icons-material/IosShare";
import ShareIcon from "@mui/icons-material/Share";
import { Box, Button, IconButton, Snackbar, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ERouteTuple, type RouteTuple } from "@/api/types";
import { ShowMoreButton, VehicleTypeChip } from "@/components/departures/parts";
import { typeIcons, vehicleTypeName } from "@/components/departures/VehicleTypeIcon";
import { useSettings } from "@/store/settings";

// czynaczas type order: ferry, metro, tram, trolleybus, bus, rail.
export const ROUTE_TYPE_ORDER = [4, 1, 0, 11, 3, 2, 6, 7, 12];

const collator = new Intl.Collator("pl", { numeric: true, sensitivity: "base" });

export const compareRouteNames = (a: string, b: string) => collator.compare(a, b);

const typeRank = (type: number) => {
    const index = ROUTE_TYPE_ORDER.indexOf(type);
    return index === -1 ? ROUTE_TYPE_ORDER.length : index;
};

export const sortRoutes = <T extends RouteTuple>(routes: T[]): T[] =>
    [...routes].sort(
        (a, b) =>
            typeRank(a[ERouteTuple.routeType]) - typeRank(b[ERouteTuple.routeType]) ||
            compareRouteNames(a[ERouteTuple.routeName], b[ERouteTuple.routeName]) ||
            Number(b[ERouteTuple.routeAgency] === "default") - Number(a[ERouteTuple.routeAgency] === "default"),
    );

// One entry per (type, displayed name), as the original keys lines by name.
export const uniqueRoutes = <T extends RouteTuple>(routes: T[]): T[] => {
    const seen = new Set<string>();
    return routes.filter((route) => {
        const key = `${route[ERouteTuple.routeType]}/${route[ERouteTuple.routeName]}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

export const sortTypes = (types: number[]) => [...new Set(types)].sort((a, b) => typeRank(a) - typeRank(b));

const cityQuery = (pageCity: string, dataCity?: string) => (dataCity && dataCity !== pageCity ? `?miasto=${encodeURIComponent(dataCity)}` : "");

export const routeLink = (city: string, routeId: string, dataCity?: string) =>
    `/${city}/rozklad-jazdy/linia/${encodeURIComponent(routeId)}${cityQuery(city, dataCity)}`;

export const stopLink = (city: string, stopId: string, routeId?: string, dataCity?: string) =>
    `/${city}/rozklad-jazdy/przystanek/${encodeURIComponent(stopId)}${routeId ? `/linia/${encodeURIComponent(routeId)}` : ""}${cityQuery(city, dataCity)}`;

export const typeReadableKey = (type: number) => {
    switch (vehicleTypeName(type)) {
        case "tram":
            return "global.tram";
        case "subway":
            return "global.subway";
        case "train":
            return "global.train";
        case "ferry":
            return "global.ferry";
        case "trolleybus":
            return "global.trolleybus";
        default:
            return "global.bus";
    }
};

export const useThemeMode = () => {
    const [settings] = useSettings();
    if (settings.theme === "system") return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    return settings.theme;
};

export const buttonClass = (type: number, selected: boolean, dark: boolean) => {
    const name = vehicleTypeName(type);
    if (selected) return `border-tiny-${name} bg-${name} text-white`;
    return dark ? `border-tiny-${name} text-default-text bg-default-bg` : `border-tiny-${name} text-${name} bg-white`;
};

// Type glyph without a circle (VehicleTypeIcon rounded=false): coloured, white in dark mode.
export const TypeGlyph = ({ type }: { type: number }) => {
    const dark = useThemeMode() === "dark";
    const icons = typeIcons(type);
    return (
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {dark ? icons.whiteIcon : icons.icon}
        </Box>
    );
};

// Outlined line button in the vehicle-type colour (route grid of the original).
export const RouteButton = ({ route, to, selected = false, onClick, sx }: { route: RouteTuple; to?: string; selected?: boolean; onClick?: () => void; sx?: object }) => {
    const dark = useThemeMode() === "dark";
    const type = route[ERouteTuple.routeType];
    const linkProps = to ? { component: Link, to } : { onClick };
    return (
        <Button fullWidth variant="outlined" className={buttonClass(type, selected, dark)} {...(linkProps as object)} sx={[{ flexDirection: "column", height: "100%" }, { p: 0.5 }, sx ?? {}]}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {!to && selected ? typeIcons(type).whiteIcon : <TypeGlyph type={type} />}
                {route[ERouteTuple.routeName]}
            </Box>
        </Button>
    );
};

export const RouteGrid = ({ routes, linkFor, onSelect, selected }: { routes: RouteTuple[]; linkFor?: (route: RouteTuple) => string; onSelect?: (route: RouteTuple) => void; selected?: string }) => (
    <Grid container spacing={1} sx={{ alignItems: "center" }}>
        {routes.map((route) => (
            <Grid key={`${route[ERouteTuple.routeType]}/${route[ERouteTuple.city]}/${route[ERouteTuple.routeId]}`} size={{ xs: 4, sm: 3, md: 2, lg: 1 }}>
                <RouteButton route={route} to={linkFor?.(route)} onClick={onSelect ? () => onSelect(route) : undefined} selected={selected === route[ERouteTuple.routeId]} />
            </Grid>
        ))}
    </Grid>
);

// Type filter buttons (one per vehicle type, glyph only).
export const TypeFilter = ({ types, selected, onToggle }: { types: number[]; selected: number | null; onToggle: (type: number) => void }) => {
    const dark = useThemeMode() === "dark";
    return (
        <Grid container spacing={1} sx={{ pt: 1 }}>
            {types.map((type) => (
                <Grid key={type} size="grow">
                    <Button fullWidth variant="outlined" onClick={() => onToggle(type)} className={buttonClass(type, selected === type, dark)} sx={[{ flexDirection: "column", height: "100%" }, { p: 0.5 }]}>
                        <Box sx={{ display: "flex", alignItems: "center" }}>{selected === type ? typeIcons(type).whiteIcon : <TypeGlyph type={type} />}</Box>
                    </Button>
                </Grid>
            ))}
        </Grid>
    );
};

// Vehicle type block(s) of a stop / line header.
export const TypeCircles = ({ types, size = 32 }: { types: number[]; size?: number }) => <VehicleTypeChip types={sortTypes(types.length ? types : [3])} size={size} />;

const CLAMP = { overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 1, whiteSpace: "pre-wrap", lineHeight: "34px" } as const;

// One-line clamped caption with the faded drop-arrow toggle.
export const ExpandableText = ({ children }: { children: ReactNode }) => {
    const [expanded, setExpanded] = useState(false);
    return (
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "flex-start" }}>
            <Box style={expanded ? { display: "flex" } : CLAMP} sx={{ flexDirection: "column" }}>
                {children}
            </Box>
            <ShowMoreButton expanded={expanded} onClick={() => setExpanded((value) => !value)} />
        </Box>
    );
};

const isApple = typeof navigator !== "undefined" && /iPhone|iPad|Macintosh/.test(navigator.userAgent) && "ontouchend" in document;

export const ShareIconAuto = (props: { fontSize?: "small" | "inherit" }) => (isApple ? <IosShareIcon {...props} /> : <ShareIcon {...props} />);

export const useShare = () => {
    const [message, setMessage] = useState<string>();
    const share = async (text: string) => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({ title: "czynalive", text, url });
            } catch {}
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            setMessage("Skopiowano URL!");
        } catch {
            setMessage("BŁĄD. Skopiuj link ręcznie.");
        }
    };
    const snackbar = <Snackbar open={!!message} autoHideDuration={2000} onClose={() => setMessage(undefined)} message={message} />;
    return { share, snackbar };
};

// "Udostępnij link:" + share icon button.
export const ShareUrl = ({ text }: { text: string }) => {
    const { t } = useTranslation();
    const { share, snackbar } = useShare();
    return (
        <Typography variant="caption" data-nosnippet>
            <strong>{t("global.shareUrl")}: </strong>
            <IconButton size="small" color="primary" onClick={() => share(text)} aria-label={t("global.share")}>
                <ShareIconAuto fontSize="small" />
            </IconButton>
            {snackbar}
        </Typography>
    );
};

export const ShareLine = ({ text, children }: { text: string; children?: ReactNode }) => {
    if (!children) return <ShareUrl text={text} />;
    return (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div>
                <ShareUrl text={text} />
            </div>
            <div>{children}</div>
        </Box>
    );
};

export const SmallAction = ({ to, icon, label }: { to: string; icon: ReactNode; label: string }) => (
    <IconButton size="small" color="primary" component={Link} to={to}>
        {icon}
        <Typography variant="caption">{label}</Typography>
    </IconButton>
);

const readParam = (key: string) => new URLSearchParams(globalThis.location.search).get(key);

const writeParam = (key: string, value: string | null) => {
    const url = new URL(globalThis.location.href);
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    url.search = url.searchParams.toString();
    globalThis.history.replaceState(globalThis.history.state, "", url);
};

// Tab state mirrored in a query param through history.replaceState (outside the router, as in the original).
export const useUrlTab = <T extends string>(key: string, tabs: readonly T[], fallback: T): [T, (value: T) => void] => {
    const [value, setValue] = useState<T>(() => {
        const stored = readParam(key) as T | null;
        return stored !== null && tabs.includes(stored) ? stored : fallback;
    });
    const update = (next: T) => {
        setValue(next);
        writeParam(key, next === fallback ? null : next);
    };
    return [value, update];
};

// Short agency names used in the original's headings where the city list carries a long form.
const AGENCY_SHORT_NAMES: Record<string, string> = { warsaw: "WTP Warszawa" };

export const agencyNameOf = (city: string, cityInfo?: { name?: string; agencies?: { default?: { name?: string } } }) =>
    AGENCY_SHORT_NAMES[city] ?? cityInfo?.agencies?.default?.name ?? cityInfo?.name ?? "";

// Lines grouped by numeric type id (the original iterates an object keyed by type), then by name.
export const sortRoutesByTypeId = <T extends RouteTuple>(routes: T[]): T[] =>
    [...routes].sort((a, b) => a[ERouteTuple.routeType] - b[ERouteTuple.routeType] || compareRouteNames(a[ERouteTuple.routeName], b[ERouteTuple.routeName]));
