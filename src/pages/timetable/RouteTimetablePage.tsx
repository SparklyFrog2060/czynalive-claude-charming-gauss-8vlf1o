import EventNoteIcon from "@mui/icons-material/EventNote";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import PanToolIcon from "@mui/icons-material/PanTool";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import {
    Avatar,
    Badge,
    Box,
    Divider,
    Fab,
    FormControl,
    IconButton,
    InputLabel,
    List,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useCity } from "@/api/cities";
import { cityGet } from "@/api/client";
import { ALIGHT, ERouteTuple, EStopTuple, EVehiclePosition, type Point, type RouteTuple, type StopTuple, type VehiclePosition } from "@/api/types";
import { useApi } from "@/api/useApi";
import { isWstRoute, loadWstRouteDetails, loadWstStopTimetable, loadWstTrip } from "@/api/wst";
import { fetchCityAlerts } from "@/components/alerts/api";
import { typeIcons, vehicleTypeName } from "@/components/departures/VehicleTypeIcon";
import { PageHeader, PageTemplate } from "@/components/PageHeader";
import { ExpandableText, ShareUrl, stopLink, TypeCircles, typeReadableKey, useUrlTab, agencyNameOf } from "@/components/timetable/common";
import { RouteMinimap, type LineStop } from "@/components/timetable/RouteMinimap";
import { RouteAlertBox, type StopTimetableResponse } from "@/components/timetable/StopTimetable";
import { useRouteVehicles } from "@/components/timetable/useRouteVehicles";
import { contentHeight } from "@/lib/shell";
import { decodePolyline6, todayDateIndex } from "@/lib/transit";

type RouteDirection = { headsign: string; trunk: StopTuple[] };
type RouteDetails = { route: RouteTuple; graph: RouteDirection[]; shapes: string[][] };
type TripStop = [stop: StopTuple, alight: number, distance: number, platform: string, headsign: string, arrival: number, departure: number];
type TripDetails = { stops: TripStop[]; shape: string };

const CIRCLE = 22;
const BORDER = 2;
const LINE = 2;

const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h${rest > 0 ? ` ${rest}min` : ""}` : `${rest}min`;
};

const toRadians = (value: number) => (value * Math.PI) / 180;
const metres = (a: Point, b: Point) => {
    const x = toRadians(b[0] - a[0]) * Math.cos(toRadians((a[1] + b[1]) / 2));
    const y = toRadians(b[1] - a[1]);
    return Math.sqrt(x * x + y * y) * 6371000;
};

// Distance along the line of the point's projection (null when farther than 150 m from it).
const projectOnLine = (line: Point[], cumulative: number[], point: Point) => {
    let best: { distance: number; along: number } | null = null;
    for (let i = 0; i < line.length - 1; i++) {
        const a = line[i];
        const b = line[i + 1];
        const scale = Math.cos(toRadians(a[1]));
        const dx = (b[0] - a[0]) * scale;
        const dy = b[1] - a[1];
        const px = (point[0] - a[0]) * scale;
        const py = point[1] - a[1];
        const length = dx * dx + dy * dy;
        const t = length === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / length));
        const projected: Point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const distance = metres(projected, point);
        if (!best || distance < best.distance) best = { distance, along: cumulative[i] + metres(a, projected) };
    }
    return best && best.distance <= 150 ? best.along : null;
};

const VehicleOnLine = styled(IconButton)({
    "&:hover, &:focus": { backgroundColor: "var(--white)" },
    position: "absolute",
    padding: "3px",
    marginLeft: "calc(15px + 50px)",
    transition: "margin 700ms",
    border: "2px solid",
    backgroundColor: "var(--white)",
    zIndex: 3,
});

const StopRow = ({
    city,
    stop,
    index,
    isLast,
    isActive,
    routeId,
    routeType,
    onSelect,
}: {
    city: string;
    stop: LineStop;
    index: number;
    isLast: boolean;
    isActive: boolean;
    routeId: string;
    routeType: number;
    onSelect: (index: number, top: number) => void;
}) => {
    const { t } = useTranslation();
    const ref = useRef<HTMLLIElement | null>(null);
    const [height, setHeight] = useState(0);
    const name = vehicleTypeName(routeType);
    useEffect(() => {
        setHeight(ref.current?.offsetHeight ?? 0);
    }, []);
    return (
        <ListItem data-stop-sequence={index} disablePadding dense divider ref={ref} onClick={(event) => onSelect(index, event.currentTarget.offsetTop)}>
            <ListItemButton sx={{ py: 0.5 }}>
                <Typography variant="caption" sx={{ wordBreak: "break-word", width: "50px", minWidth: "50px" }}>
                    {formatMinutes(stop.minutes)}
                </Typography>
                <ListItemAvatar sx={{ minWidth: "initial", mr: 1 }}>
                    <Avatar sx={{ color: "var(--white)", bgcolor: `var(--${name})`, width: CIRCLE, height: CIRCLE, border: `${BORDER}px solid var(--default-bg)`, fontSize: "0.875rem", zIndex: 2 }}>{index + 1}</Avatar>
                    <Paper
                        elevation={0}
                        sx={{
                            border: `${LINE}px solid var(--${name})`,
                            marginLeft: `${CIRCLE / 2 - LINE}px`,
                            height: index === 0 || isLast ? `${(height + LINE * 2) / 2}px` : `${height + LINE * 2}px`,
                            position: "absolute",
                            zIndex: 1,
                            top: index === 0 ? height / 2 : 0,
                        }}
                    />
                </ListItemAvatar>
                <ListItemText
                    primary={
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Typography variant="body2" style={{ fontWeight: isActive ? "bold" : "initial", wordBreak: "break-word", maxWidth: "50%" }}>
                                {stop.onDemand ? (
                                    <>
                                        <PanToolIcon className="iconOnStop" />
                                        {stop.name} - {t("global.onDemand")}
                                    </>
                                ) : (
                                    stop.name
                                )}
                            </Typography>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <IconButton
                                    sx={{ display: "flex", flexDirection: "column", p: 0, mr: 1, color: "var(--default-text)" }}
                                    aria-label={t("stopDetails.schedule")}
                                    component={Link}
                                    to={stopLink(city, stop.id, routeId)}
                                    size="small"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <EventNoteIcon fontSize="inherit" />
                                    <Typography variant="caption" sx={{ lineHeight: 1 }}>
                                        {t("stopDetails.schedule")}
                                    </Typography>
                                </IconButton>
                                <IconButton
                                    sx={{ display: "flex", flexDirection: "column", p: 0 }}
                                    aria-label={t("map.map")}
                                    component={Link}
                                    to={`/${city}?przystanek=${encodeURIComponent(stop.id)}`}
                                    size="small"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <GpsFixedIcon fontSize="inherit" className="opacity-animate" style={{ color: `var(--${name})` }} />
                                    <Typography variant="caption" sx={{ lineHeight: 1 }}>
                                        {t("stopDetails.departures")}
                                    </Typography>
                                </IconButton>
                            </Box>
                        </Box>
                    }
                />
            </ListItemButton>
        </ListItem>
    );
};

const offsetsOf = (list: HTMLElement) => {
    const out: number[] = [];
    list.querySelectorAll("li[data-stop-sequence]").forEach((item) => out.push((item as HTMLElement).offsetTop));
    return out;
};

const StopsPanel = ({
    city,
    routeId,
    routeType,
    stops,
    trip,
    line,
    vehicles,
    showVehicles,
    setShowVehicles,
    activeIndex,
    setActiveIndex,
    onZoomOut,
}: {
    city: string;
    routeId: string;
    routeType: number;
    stops: LineStop[];
    trip: TripDetails;
    line: Point[];
    vehicles: VehiclePosition[];
    showVehicles: boolean;
    setShowVehicles: (update: (value: boolean) => boolean) => void;
    activeIndex: number;
    setActiveIndex: (index: number) => void;
    onZoomOut: () => void;
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [offsets, setOffsets] = useState<number[]>([]);
    const [bottomPad, setBottomPad] = useState(0);
    const scrollTimer = useRef<ReturnType<typeof setTimeout>>();
    const name = vehicleTypeName(routeType);

    useLayoutEffect(() => {
        const node = containerRef.current;
        if (!node) return;
        const found = offsetsOf(node);
        setOffsets(found);
        const last = found.length - 1;
        const tail = found[last] >= node.scrollHeight ? node.scrollHeight - found[last] : found[last] - found[last - 1];
        setBottomPad(node.offsetHeight - (tail || 0));
    }, [stops]);

    const cumulative = useMemo(() => {
        const out = [0];
        for (let i = 1; i < line.length; i++) out.push(out[i - 1] + metres(line[i - 1], line[i]));
        return out;
    }, [line]);

    const margins = useMemo(() => {
        if (!offsets.length || !line.length) return [];
        const stopAlong = trip.stops.map((entry) => entry[2]);
        const out: { id: string; margin: number }[] = [];
        for (const vehicle of vehicles) {
            const along = projectOnLine(line, cumulative, vehicle[EVehiclePosition.location]);
            if (along === null) continue;
            let sequence = 0;
            let fraction = 1;
            for (let i = 0; i < stopAlong.length; i++) {
                if (Math.abs(stopAlong[i] - along) <= 50) {
                    sequence = i;
                    fraction = 1;
                    break;
                }
                if (stopAlong[i] - along > 50 || i === stopAlong.length - 1) {
                    sequence = i;
                    fraction = i === 0 ? 1 : (along - stopAlong[i - 1]) / (stopAlong[i] - stopAlong[i - 1] || 1);
                    break;
                }
            }
            const here = offsets[sequence] ?? 0;
            const before = offsets[sequence - 1] ?? 0;
            const margin = sequence === 0 ? 0 : ((here - before) / 100) * (fraction * 100) + before;
            out.push({ id: vehicle[EVehiclePosition.id], margin: Number(margin.toFixed(1)) + 17 });
        }
        return out;
    }, [vehicles, offsets, line, cumulative, trip]);

    const select = (index: number, top: number) => {
        if (containerRef.current) containerRef.current.scrollTop = top;
        setActiveIndex(index);
    };

    return (
        <Box
            ref={containerRef}
            sx={{ height: "60%", overflow: "auto", border: "2px solid #29a847", borderRadius: "0 0 6px 6px", backgroundColor: "var(--default-bg)", overflowX: "hidden" }}
            onScroll={(event) => {
                const top = event.currentTarget.scrollTop;
                clearTimeout(scrollTimer.current);
                scrollTimer.current = setTimeout(() => {
                    if (!offsets.length) return;
                    let best = 0;
                    for (let i = 1; i < offsets.length; i++) if (Math.abs(offsets[i] - top) < Math.abs(offsets[best] - top)) best = i;
                    setActiveIndex(best);
                }, 250);
            }}
        >
            <Box sx={{ position: "absolute", marginTop: "-17px", right: "50px" }}>
                <Fab color="secondary" size="small" style={{ width: 30, height: 30, minHeight: 30, marginRight: 10, zIndex: 1000 }} onClick={onZoomOut}>
                    <ZoomOutMapIcon style={{ fontSize: 18 }} />
                </Fab>
                <Fab
                    color="secondary"
                    size="small"
                    style={{ width: 30, height: 30, minHeight: 30, zIndex: 1000, backgroundColor: showVehicles ? "" : "var(--neutral-light)", border: showVehicles ? "" : "1px solid var(--white)" }}
                    onClick={() => setShowVehicles((value) => !value)}
                >
                    <Badge
                        badgeContent={`${vehicles.length}`}
                        sx={{ "& .MuiBadge-badge": { color: "var(--white)", backgroundColor: showVehicles ? `var(--${name})` : "var(--neutral-light)", height: 20, width: 20 } }}
                    >
                        {typeIcons(routeType).whiteIcon}
                    </Badge>
                </Fab>
            </Box>
            <List component="nav" sx={{ p: 0, mt: 1, paddingBottom: `${bottomPad}px`, overflowX: "hidden" }}>
                {showVehicles &&
                    margins.map((entry) => (
                        <VehicleOnLine key={entry.id} sx={{ marginTop: `${entry.margin}px` }} className={`text-${name}`} size="large">
                            {typeIcons(routeType).verticalLineIcon}
                        </VehicleOnLine>
                    ))}
                {stops.map((stop, index) => (
                    <StopRow
                        key={`${index}-${stop.id}`}
                        city={city}
                        stop={stop}
                        index={index}
                        isLast={index === stops.length - 1}
                        isActive={index === activeIndex}
                        routeId={routeId}
                        routeType={routeType}
                        onSelect={select}
                    />
                ))}
            </List>
        </Box>
    );
};

export default function RouteTimetablePage() {
    const { city = "", routeId = "" } = useParams();
    const [params] = useSearchParams();
    const dataCity = params.get("miasto") || city;
    const cityInfo = useCity(city);
    const { t } = useTranslation();
    const agencyName = agencyNameOf(city, cityInfo);
    const timeZone = cityInfo?.timezone ?? "Europe/Warsaw";

    const local = isWstRoute(routeId);
    const details = useApi(
        (signal) => (local ? loadWstRouteDetails(routeId, signal) : cityGet<RouteDetails>(dataCity, `/routes/${encodeURIComponent(routeId)}`, undefined, signal)),
        [dataCity, routeId, local],
    );
    const headsigns = useMemo(() => (details.data?.graph ?? []).map((direction) => direction.headsign), [details.data]);
    const [chosen, setChosen] = useUrlTab<string>("trip_headsign", headsigns, "");
    const directionIndex = Math.max(0, headsigns.indexOf(chosen));
    const direction = details.data?.graph[directionIndex];
    const headsign = direction?.headsign ?? "";

    useEffect(() => {
        if (!headsigns.length || headsigns.includes(chosen)) return;
        const stored = new URLSearchParams(window.location.search).get("trip_headsign");
        setChosen(stored && headsigns.includes(stored) ? stored : headsigns[0]);
    }, [headsigns]);

    const firstStopId = direction?.trunk[0]?.[EStopTuple.stopId];
    const firstStopTimetable = useApi(
        firstStopId
            ? (signal) => (local ? loadWstStopTimetable(firstStopId, routeId, signal) : cityGet<StopTimetableResponse>(dataCity, `/stops/${encodeURIComponent(firstStopId)}/timetable/${encodeURIComponent(routeId)}`, undefined, signal))
            : null,
        [dataCity, firstStopId, routeId, local],
    );
    const tripRef = useMemo(() => {
        const timetable = firstStopTimetable.data?.timetable;
        if (!timetable) return undefined;
        const today = todayDateIndex(timeZone);
        const days = Object.keys(timetable).map(Number).sort((a, b) => a - b);
        const day = days.includes(today) ? today : (days.find((index) => index >= today) ?? days[0]);
        const rows = (timetable[String(day)] ?? []).filter((row) => (row[2] & (ALIGHT.AlightOnly | ALIGHT.IsLastStop)) === 0);
        return (rows.find((row) => row[3] === "") ?? rows[0])?.[0];
    }, [firstStopTimetable.data, timeZone]);
    const trip = useApi(tripRef ? (signal) => (local ? loadWstTrip(tripRef, signal) : cityGet<TripDetails>(dataCity, `/trips/${encodeURIComponent(tripRef)}`, undefined, signal)) : null, [dataCity, tripRef, local]);
    const vehicles = useRouteVehicles(dataCity, routeId ? [routeId] : [], directionIndex, !!details.data && !local);
    const alerts = useApi(local ? null : (signal) => fetchCityAlerts(dataCity, signal), [dataCity, local]);

    const [activeIndex, setActiveIndex] = useState(0);
    const [showVehicles, setShowVehicles] = useState(true);
    const [fitKey, setFitKey] = useState(0);

    const route = details.data?.route;
    const routeName = route?.[ERouteTuple.routeName] ?? routeId;
    const routeType = route?.[ERouteTuple.routeType] ?? 3;
    const typeLabel = t(typeReadableKey(routeType));
    const headerTitle = `${t("timetables.timetable")} ${agencyName}`;
    const documentTitle = t("timetables.pageTitleRouteId", { route_id: routeName, type: typeLabel, agencyName });

    const headerText = (headsign ? `${routeName} ${headsign}` : details.data ? `${t("global.route_id")} ${routeName}` : null);

    const stops: LineStop[] = useMemo(() => {
        const list = trip.data?.stops ?? [];
        if (!list.length) return [];
        const start = list[0][6] ?? list[0][5];
        return list.map((entry) => ({
            id: entry[0][EStopTuple.stopId],
            name: entry[0][EStopTuple.stopName],
            location: entry[0][EStopTuple.location],
            onDemand: (entry[1] & ALIGHT.OnDemand) !== 0,
            minutes: ((entry[6] ?? entry[5]) - start) / 60000,
        }));
    }, [trip.data]);
    const line = useMemo<Point[]>(() => {
        if (trip.data?.shape) return decodePolyline6(trip.data.shape);
        return stops.map((stop) => stop.location);
    }, [trip.data, stops]);

    useEffect(() => setActiveIndex(0), [tripRef]);

    const loading = (text: string) => (
        <PageTemplate title={headerTitle} padding>
            <PageHeader documentTitle={documentTitle} subtitle={headerText} />
            <Typography sx={{ mt: 3 }} variant="h5" gutterBottom>
                {text}
            </Typography>
        </PageTemplate>
    );

    if (details.error) return loading(details.error.message === "ROUTE_NOT_FOUND" ? t("timetables.routeIdNotFound") : t("global.error"));
    if (!details.data) return loading(`${t("global.loading")}...`);
    if (!direction) return loading(t("timetables.timetableNotFound"));

    const center: Point = (cityInfo?.location as Point | undefined) ?? direction.trunk[0]?.[EStopTuple.location] ?? [21.01, 52.23];
    const alertItems = (alerts.data?.alerts ?? [])
        .filter((alert) => alert.routes.some((entry) => entry[ERouteTuple.routeId] === routeId))
        .map((alert) => ({ key: alert.id, title: alert.title, to: `/${city}/komunikaty/komunikat?id=${encodeURIComponent(alert.id)}` }));

    return (
        <PageTemplate title={headerTitle} padding>
            <PageHeader documentTitle={documentTitle} subtitle={headerText} />
            <Box style={{ padding: "0 0 10px" }}>
                <div style={{ display: "flex", placeItems: "center", gap: 10, marginBottom: 10 }}>
                    <TypeCircles types={[routeType]} size={50} />
                    <div>
                        <Typography variant="h5">
                            <strong>
                                {typeLabel} {t("global.route_id")} {routeName}
                            </strong>{" "}
                            - {agencyName}
                        </Typography>
                        <Typography variant="h5">
                            {headsign ? (
                                <>
                                    <strong>{headsign}</strong> - {t("timetables.timetable")}
                                </>
                            ) : (
                                ""
                            )}
                        </Typography>
                    </div>
                </div>
                {stops.length > 0 && (
                    <Box sx={{ display: "flex", alignItems: "flex-start", flexDirection: "column" }}>
                        <ExpandableText>
                            <Typography variant="caption" gutterBottom>
                                <Trans
                                    i18nKey="timetables.routeIdDescription"
                                    values={{ route_id: routeName, agencyName, trip_headsign: headsign, stopsCount: stops.length, startStop: stops[0].name, endStop: stops[stops.length - 1].name }}
                                    components={[<strong key="1" />]}
                                />
                            </Typography>
                        </ExpandableText>
                        <ShareUrl text={`${cityInfo?.name ?? city} ${t("timetables.timetable")} ${t("global.route_id")} ${typeLabel} ${routeName}`} />
                    </Box>
                )}
                <Divider style={{ margin: "10px 0" }} />
                <div style={{ height: contentHeight(), display: "flex", flexDirection: "column", scrollMarginTop: 60 }} id="scroll">
                    <RouteAlertBox routeName={routeName} items={alertItems} />
                    <FormControl fullWidth size="small">
                        <InputLabel>{t("global.tripHeadsign")}</InputLabel>
                        <Select value={headsign} label={t("global.tripHeadsign")} disabled={!trip.data} onChange={(event) => setChosen(String(event.target.value))}>
                            {headsigns.map((value) => (
                                <MenuItem key={value} value={value} dense>
                                    {value}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {trip.data && (
                        <Box style={{ marginTop: 16, flex: 1, minHeight: 0 }}>
                            <div style={{ height: "40%", border: "2px solid #29a847", borderBottomWidth: 0, borderRadius: "6px 6px 0 0", overflow: "hidden" }}>
                                <RouteMinimap
                                    center={center}
                                    line={line}
                                    stops={stops}
                                    routeType={routeType}
                                    vehicles={vehicles.positions}
                                    headsign={headsign}
                                    showVehicles={showVehicles}
                                    activeIndex={activeIndex}
                                    onStopClick={setActiveIndex}
                                    fitKey={fitKey}
                                />
                            </div>
                            <StopsPanel
                                city={city}
                                routeId={routeId}
                                routeType={routeType}
                                stops={stops}
                                trip={trip.data}
                                line={line}
                                vehicles={vehicles.positions}
                                showVehicles={showVehicles}
                                setShowVehicles={setShowVehicles}
                                activeIndex={activeIndex}
                                setActiveIndex={setActiveIndex}
                                onZoomOut={() => setFitKey((value) => value + 1)}
                            />
                        </Box>
                    )}
                </div>
            </Box>
        </PageTemplate>
    );
}
