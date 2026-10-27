import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { Box, Button, Divider, IconButton, InputAdornment, Link as MuiLink, TextField, Tooltip, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import Grid from "@mui/material/Grid2";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ERouteTuple } from "@/api/types";
import { RouteChip } from "@/components/departures/RouteChip";
import { formatDelay } from "@/lib/transit";
import { delayMinutes, delayMinutesClass, mapLinesUrl, mapVehicleUrl, type LiveVehicle } from "./api";
import { compareValues } from "./StatsDataGrid";

const COLUMN_WIDTH = 130;
const MIN_COLUMNS = 2;

export type RouteVehicles = { key: string; routeId: string; routeName: string; city: string; type: number; vehicles: LiveVehicle[] };

const VehicleEntry = memo(({ vehicle, city, duplicateBrigade }: { vehicle: LiveVehicle; city: string; duplicateBrigade: boolean }) => {
    const { t } = useTranslation();
    const minutes = vehicle.delay !== null ? delayMinutes(vehicle.delay) : undefined;
    const details = (
        <Box>
            <Typography variant="caption" sx={{ display: "block" }}>
                {t("global.vehicleNo")}: {vehicle.vehicleNo}
            </Typography>
            {vehicle.brigade && (
                <Typography variant="caption" sx={{ display: "block" }}>
                    {t("global.brigade")}: {vehicle.brigade}
                </Typography>
            )}
            {vehicle.headsign && (
                <Typography variant="caption" sx={{ display: "block" }}>
                    {t("global.tripHeadsign")}: {vehicle.headsign}
                </Typography>
            )}
            {vehicle.stop && (
                <Typography variant="caption" sx={{ display: "block" }}>
                    {t("global.stop")}: {vehicle.stop}
                </Typography>
            )}
            <Typography variant="caption" sx={{ display: "block" }}>
                {vehicle.delay !== null ? `${t("delays.delay")}: ${formatDelay(vehicle.delay * 1000)}` : t("settings.delayNoData")}
            </Typography>
        </Box>
    );
    return (
        <Box sx={{ display: "inline-flex", flexDirection: "row", gap: "4px", alignItems: "center", justifyContent: "space-around" }}>
            <MuiLink component={Link} to={mapVehicleUrl(city, vehicle.id)} sx={{ minWidth: "40px" }}>
                {vehicle.vehicleNo}
            </MuiLink>
            {vehicle.brigade && (
                <Typography
                    variant="caption"
                    sx={{
                        textDecoration: duplicateBrigade ? "underline" : "none",
                        textDecorationColor: duplicateBrigade ? "var(--error)" : "inherit",
                        textDecorationThickness: duplicateBrigade ? "2px" : "auto",
                    }}
                >
                    {vehicle.brigade}
                </Typography>
            )}
            <Tooltip title={details} enterTouchDelay={0} leaveTouchDelay={4000} arrow>
                <Box sx={{ display: "flex", gap: "4px", alignItems: "center", minWidth: "28px", justifyContent: "center", cursor: "pointer" }}>
                    {minutes !== undefined ? (
                        <Box
                            className={`bg-${delayMinutesClass(minutes)} text-white`}
                            sx={{ minWidth: "20px", px: 0.5, height: "20px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "12px", fontSize: "0.875rem", whiteSpace: "nowrap" }}
                        >
                            <Typography variant="caption" sx={{ lineHeight: 1, color: "#fff" }}>
                                {minutes > 0 ? `+${minutes}` : minutes}
                            </Typography>
                        </Box>
                    ) : (
                        <Box sx={{ width: "20px", height: "20px" }} />
                    )}
                </Box>
            </Tooltip>
        </Box>
    );
});

const duplicateBrigades = (vehicles: LiveVehicle[]) => {
    const counts = new Map<string, number>();
    for (const vehicle of vehicles) {
        if (vehicle.brigade) counts.set(vehicle.brigade, (counts.get(vehicle.brigade) ?? 0) + 1);
    }
    return new Set([...counts].filter(([, count]) => count > 1).map(([brigade]) => brigade));
};

export const RoutesVehiclesGrid = ({ routes, city, selected, onSelectedChange }: { routes: RouteVehicles[]; city: string; selected: Set<string>; onSelectedChange: (selected: Set<string>) => void }) => {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<Set<string>>(selected);
    const [search, setSearch] = useState("");

    useLayoutEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        setWidth(element.getBoundingClientRect().width);
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) setWidth(entry.contentRect.width);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const columns = Math.max(MIN_COLUMNS, Math.floor(width / COLUMN_WIDTH) || MIN_COLUMNS);
    const visibleRoutes = useMemo(() => routes.filter((route) => selected.has(route.key)), [routes, selected]);
    const rows = useMemo(() => {
        const result: RouteVehicles[][] = [];
        for (let i = 0; i < visibleRoutes.length; i += columns) result.push(visibleRoutes.slice(i, i + columns));
        return result;
    }, [visibleRoutes, columns]);
    const searched = useMemo(() => {
        const query = search.trim().toUpperCase();
        return query ? routes.filter((route) => route.routeName.toUpperCase().includes(query)) : routes;
    }, [routes, search]);

    const toggleDraft = (key: string) =>
        setDraft((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    const cancel = () => {
        setDraft(new Set(selected));
        setEditing(false);
    };
    const save = () => {
        onSelectedChange(new Set(draft));
        setEditing(false);
    };

    const cellBorder = (index: number, count: number) => ({
        borderLeft: index > 0 ? "1px solid var(--neutral-light)" : "none",
        borderRight: index === count - 1 && count < columns ? "1px solid var(--neutral-light)" : "none",
        borderBottom: "1px solid var(--neutral-light)",
        p: 1,
    });

    return (
        <Box sx={{ width: "100%" }} ref={containerRef}>
            <Box sx={{ mb: 2 }}>
                <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                        setDraft(new Set(selected));
                        setSearch("");
                        setEditing(true);
                    }}
                >
                    {t("stats.selectLines")} ({selected.size}/{routes.length})
                </Button>
            </Box>
            {editing && (
                <Box sx={{ mb: 2, p: 2, border: "1px solid var(--neutral-light)", borderRadius: "4px" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Typography variant="subtitle1">{t("stats.selectLines")}</Typography>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                            <IconButton aria-label={t("global.close")} onClick={cancel} size="small">
                                <CloseIcon />
                            </IconButton>
                            <IconButton aria-label={t("global.save")} onClick={save} size="small">
                                <CheckIcon />
                            </IconButton>
                        </Box>
                    </Box>
                    <TextField
                        fullWidth
                        size="small"
                        label={`${t("map.filterSearchLine")}:`}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
                    />
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: "flex", gap: 1, mb: 2, alignItems: "center" }}>
                        <Button size="small" onClick={() => setDraft(new Set(routes.map((route) => route.key)))} variant={draft.size === routes.length ? "contained" : "outlined"}>
                            {t("global.all")}
                        </Button>
                        <Button size="small" onClick={() => setDraft(new Set())} variant={draft.size === 0 ? "contained" : "outlined"}>
                            {t("global.none")}
                        </Button>
                    </Box>
                    <Grid container spacing={1} sx={{ alignItems: "center", mb: 2 }}>
                        {searched.length === 0 ? (
                            <Grid size={12}>
                                <Typography variant="subtitle2" noWrap sx={{ mb: 1 }}>
                                    {t("global.nothingFound")}
                                </Typography>
                            </Grid>
                        ) : (
                            searched.map((route) => (
                                <Grid key={route.key} size={{ xs: 3, sm: 2, md: 1.5 }}>
                                    <RouteChip
                                        name={route.routeName}
                                        type={route.type}
                                        onClick={() => toggleDraft(route.key)}
                                        sx={{ opacity: draft.has(route.key) ? 1 : 0.3, width: "100%" }}
                                    />
                                </Grid>
                            ))
                        )}
                    </Grid>
                    <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                        <Button variant="outlined" size="small" onClick={cancel}>
                            {t("global.cancel")}
                        </Button>
                        <Button variant="contained" size="small" onClick={save}>
                            {t("global.save")}
                        </Button>
                    </Box>
                </Box>
            )}
            {visibleRoutes.length > 0 && (
                <Box sx={{ width: "100%", border: "3px solid var(--neutral-light)" }}>
                    {rows.map((row, rowIndex) => (
                        <Box key={row.map((route) => route.key).join("-")} sx={{ borderBottom: rowIndex < rows.length - 1 ? "3px solid var(--neutral-light)" : "none" }}>
                            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(${COLUMN_WIDTH}px, 1fr))`, width: "100%" }}>
                                {row.map((route, index) => (
                                    <Box key={route.key} sx={{ ...cellBorder(index, row.length), backgroundColor: "var(--default-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, alignItems: "center", width: "100%", py: 1 }}>
                                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "center" }}>
                                                <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                                                    {route.routeName}
                                                </Typography>
                                                <Typography variant="caption">{t("plural.vehicle", { count: route.vehicles.length })}</Typography>
                                            </Box>
                                            <Button
                                                component={Link}
                                                to={mapLinesUrl(route.city, route.type, route.routeId)}
                                                variant="outlined"
                                                size="small"
                                                sx={{ textTransform: "none", fontSize: "0.8125rem", py: 0.25, px: 1, minWidth: "auto" }}
                                            >
                                                {t("map.map")}
                                            </Button>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(${COLUMN_WIDTH}px, 1fr))`, width: "100%" }}>
                                {row.map((route, index) => {
                                    const duplicates = duplicateBrigades(route.vehicles);
                                    return (
                                        <Box key={route.key} sx={{ ...cellBorder(index, row.length), display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
                                            {route.vehicles.map((vehicle) => (
                                                <VehicleEntry key={vehicle.id} vehicle={vehicle} city={city} duplicateBrigade={!!vehicle.brigade && duplicates.has(vehicle.brigade)} />
                                            ))}
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export const groupByRoute = (vehicles: LiveVehicle[]): RouteVehicles[] => {
    const byRoute = new Map<string, RouteVehicles>();
    for (const vehicle of vehicles) {
        const key = `${vehicle.type}/${vehicle.route[ERouteTuple.city]}/${vehicle.route[ERouteTuple.routeId]}`;
        let entry = byRoute.get(key);
        if (!entry) {
            entry = {
                key,
                routeId: vehicle.route[ERouteTuple.routeId],
                routeName: vehicle.route[ERouteTuple.routeName],
                city: vehicle.route[ERouteTuple.city],
                type: vehicle.type,
                vehicles: [],
            };
            byRoute.set(key, entry);
        }
        entry.vehicles.push(vehicle);
    }
    for (const entry of byRoute.values()) {
        entry.vehicles.sort((a, b) => compareValues(a.brigade, b.brigade) || compareValues(a.vehicleNo, b.vehicleNo));
    }
    return [...byRoute.values()].sort((a, b) => compareValues(a.routeName, b.routeName));
};
