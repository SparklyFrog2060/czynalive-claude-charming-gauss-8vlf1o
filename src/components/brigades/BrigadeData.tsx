import HelpIcon from "@mui/icons-material/Help";
import { Box, Button, Divider, IconButton, Paper, Popover, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Typography } from "@mui/material";
import { Fragment, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ERouteTuple, ETripTuple, type TripTupleDetailed } from "@/api/types";
import { RouteChip } from "@/components/departures/RouteChip";
import { formatTime } from "@/lib/transit";
import { VehicleLink, type ScheduleRow } from "./BrigadeSchedule";
import { formatBreak, tripEnd, tripStart } from "./format";

type Ride = { trip: TripTupleDetailed; duration: number; distance: number; count: number };
type Pause = { duration: number; from: TripTupleDetailed; to: TripTupleDetailed; count: number };

const pick = <T,>(items: T[], value: (item: T) => number, direction: 1 | -1) => {
    const best = items.reduce((a, b) => (direction * (value(b) - value(a)) > 0 ? b : a));
    return { best, count: items.filter((item) => value(item) === value(best)).length };
};

const InfoPopup = ({ content }: { content: string }) => {
    const anchor = useRef<HTMLButtonElement | null>(null);
    const [open, setOpen] = useState(false);
    return (
        <>
            <IconButton ref={anchor} style={{ padding: 2 }} size="large" onClick={() => setOpen(true)}>
                <HelpIcon fontSize="small" />
            </IconButton>
            <Popover open={open} anchorEl={anchor.current} onClose={() => setOpen(false)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
                <Typography variant="body2" sx={{ p: 1.5, maxWidth: 280 }}>
                    {content}
                </Typography>
            </Popover>
        </>
    );
};

const Section = () => <Divider style={{ margin: "10px 0" }} />;

const TripLine = ({ trip, timeZone, chip }: { trip: TripTupleDetailed; timeZone: string; chip: ReactNode }) => (
    <Box sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
        {chip}
        <Typography component="span" variant="body2" gutterBottom>
            <b>{formatTime(tripStart(trip), timeZone)}</b> {trip[ETripTuple.firstStop][0]} <b>→</b> <b>{formatTime(tripEnd(trip), timeZone)}</b> {trip[ETripTuple.lastStop][0]}
        </Typography>
    </Box>
);

const Stats = ({ city, rows, timeZone, multi, multiBrigade }: { city: string; rows: ScheduleRow[]; timeZone: string; multi: boolean; multiBrigade: boolean }) => {
    const { t } = useTranslation();
    if (!rows.length) return null;
    const trips = rows.map((row) => row.trip);
    const vehicleRow = rows.find((row) => row.vehicle);
    const rides: Ride[] = trips.map((trip) => ({ trip, duration: tripEnd(trip) - tripStart(trip), distance: trip[ETripTuple.totalDistance] / 1000, count: 1 }));
    const pauses: Pause[] = trips.slice(0, -1).map((trip, index) => ({ duration: tripStart(trips[index + 1]) - tripEnd(trip), from: trip, to: trips[index + 1], count: 1 }));
    const longestRide = pick(rides, (ride) => ride.duration, 1);
    const shortestRide = pick(rides, (ride) => ride.duration, -1);
    const withDistance = rides.filter((ride) => ride.distance > 0);
    const longestDistance = withDistance.length ? pick(withDistance, (ride) => ride.distance, 1) : null;
    const shortestDistance = withDistance.length ? pick(withDistance, (ride) => ride.distance, -1) : null;
    const longestPause = pauses.length ? pick(pauses, (pause) => pause.duration, 1) : null;
    const shortestPause = pauses.length ? pick(pauses, (pause) => pause.duration, -1) : null;
    const start = tripStart(trips[0]);
    const end = tripEnd(trips[trips.length - 1]);
    const chip = (trip: TripTupleDetailed) =>
        multi ? (
            <RouteChip
                name={trip[ETripTuple.route][ERouteTuple.routeName]}
                brigade={multiBrigade ? trip[ETripTuple.brigade] : undefined}
                type={trip[ETripTuple.route][ERouteTuple.routeType]}
                animate={false}
            />
        ) : null;

    const rideBlock = (label: string, entry: { best: Ride; count: number }, value: ReactNode, showCount = true) => (
        <>
            <Typography variant="body1">
                {label}: <b>{value}</b>
            </Typography>
            <TripLine trip={entry.best.trip} timeZone={timeZone} chip={chip(entry.best.trip)} />
            {showCount && entry.count > 1 && (
                <Typography variant="caption" gutterBottom>
                    {t("plural.trip", { count: entry.count })} {t("brigadeSchedule.thisDistance")}
                </Typography>
            )}
        </>
    );

    const pauseBlock = (label: string, entry: { best: Pause; count: number } | null) => (
        <>
            <Typography variant="body1">
                {label}: <b>{formatBreak(entry?.best.duration ?? 0)}</b>
            </Typography>
            {entry && (
                <Typography variant="body2" gutterBottom>
                    <b>{formatTime(tripEnd(entry.best.from), timeZone)}</b> {entry.best.from[ETripTuple.lastStop][0]} <b>↦</b> <b>{formatTime(tripStart(entry.best.to), timeZone)}</b>{" "}
                    {entry.best.to[ETripTuple.firstStop][0]}
                </Typography>
            )}
            {entry && entry.count > 1 && (
                <Typography variant="caption" gutterBottom>
                    {t("plural.break", { count: entry.count })} {t("brigadeSchedule.thisDistance")}
                </Typography>
            )}
        </>
    );

    return (
        <div style={{ marginTop: 10, padding: "0 5px" }}>
            <Typography variant="body1" gutterBottom>
                {t("brigadeSchedule.tripCount")}: <b>{rows.length}</b>
            </Typography>
            <Section />
            {vehicleRow?.vehicle && (
                <Fragment>
                    <Typography variant="body1">{t("brigadeSchedule.vehicleOnBrigade")}:</Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <VehicleLink city={city} vehicle={vehicleRow.vehicle} translationKey="brigadeSchedule.goToVehicleFromBrigade" route={chip(vehicleRow.trip)} />
                    </Box>
                    <Section />
                </Fragment>
            )}
            <Typography variant="body1">
                {t("brigadeSchedule.totalBrigadeTime")}
                <InfoPopup content={t("brigadeSchedule.totalBrigadeTimeDescription")} />: <b>{formatBreak(end - start)}</b>
            </Typography>
            <Typography variant="body2" gutterBottom>
                {t("global.from")} <b>{formatTime(start, timeZone)}</b> {t("global.to")} <b>{formatTime(end, timeZone)}</b>
            </Typography>
            <Section />
            <Typography variant="body1" gutterBottom>
                {t("brigadeSchedule.totalRideTime")}
                <InfoPopup content={t("brigadeSchedule.totalRideTimeDescription")} />: <b>{formatBreak(rides.reduce((sum, ride) => sum + ride.duration, 0))}</b>
            </Typography>
            <Section />
            {rideBlock(t("brigadeSchedule.longestRide"), longestRide, formatBreak(longestRide.best.duration))}
            <Section />
            {rideBlock(t("brigadeSchedule.shortestRide"), shortestRide, formatBreak(shortestRide.best.duration))}
            <Section />
            <Typography variant="body1" gutterBottom>
                {t("brigadeSchedule.totalBreakTime")}: <b>{formatBreak(pauses.reduce((sum, pause) => sum + pause.duration, 0))}</b>
            </Typography>
            <Section />
            {pauseBlock(t("brigadeSchedule.longestBreakTime"), longestPause)}
            <Section />
            {pauseBlock(t("brigadeSchedule.shortestBreakTime"), shortestPause)}
            <Section />
            <Typography variant="body1">
                {t("brigadeSchedule.totalDistance")}
                <InfoPopup content={t("brigadeSchedule.totalDistanceDescription")} />: <b>{rides.reduce((sum, ride) => sum + ride.distance, 0).toFixed(2)}km</b>
            </Typography>
            {longestDistance && (
                <>
                    <Section />
                    {rideBlock(t("brigadeSchedule.longestRideByDistance"), longestDistance, `${longestDistance.best.distance.toFixed(2)}km`, false)}
                </>
            )}
            {shortestDistance && (
                <>
                    <Section />
                    {rideBlock(t("brigadeSchedule.shortestRideByDistance"), shortestDistance, `${shortestDistance.best.distance.toFixed(2)}km`, false)}
                </>
            )}
            <Divider style={{ margin: "20px 0" }} />
        </div>
    );
};

export const BrigadeData = ({ city, rows, lines, timeZone, multiBrigade }: { city: string; rows: ScheduleRow[]; lines: { name: string; brigade: string; type: number }[]; timeZone: string; multiBrigade: boolean }) => {
    const { t } = useTranslation();
    const [tab, setTab] = useState("total");
    if (lines.length < 2) return <Stats city={city} rows={rows} timeZone={timeZone} multi={false} multiBrigade={false} />;

    return (
        <>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
                <Tab value="total" label={t("brigadeSchedule.overall")} />
                {lines.map((line) => (
                    <Tab key={line.name} value={line.name} label={<RouteChip name={line.name} brigade={multiBrigade ? line.brigade : undefined} type={line.type} animate={false} />} />
                ))}
            </Tabs>
            {tab === "total" ? (
                <Stats city={city} rows={rows} timeZone={timeZone} multi multiBrigade={multiBrigade} />
            ) : (
                <Stats city={city} rows={rows.filter((row) => row.trip[ETripTuple.route][ERouteTuple.routeName] === tab)} timeZone={timeZone} multi={false} multiBrigade={false} />
            )}
        </>
    );
};

const COLUMN_CELL = { p: 0.5, backgroundColor: "var(--default-bg)", wordWrap: "break-word", whiteSpace: "normal" } as const;

export const BrigadeTable = ({ rows, multi, timeZone, header }: { rows: ScheduleRow[]; multi: boolean; timeZone: string; header: { title: string; merged?: string; date: string } }) => {
    const { t } = useTranslation();
    const tableRef = useRef<HTMLDivElement | null>(null);
    const columns = [
        ...(multi
            ? [
                  { id: "route_id", label: "global.route_id", width: 50 },
                  { id: "brigade", label: "global.brigade", width: 65 },
              ]
            : []),
        { id: "start", label: "brigadeSchedule.simplifiedColumnStart", width: 60 },
        { id: "end", label: "brigadeSchedule.simplifiedColumnEnd", width: 60 },
        { id: "start-time", label: "brigadeSchedule.simplifiedColumnFrom" },
        { id: "end-time", label: "brigadeSchedule.simplifiedColumnTo" },
    ];

    const saveAsImage = () => {
        const node = tableRef.current;
        if (!node) return;
        const html = `<html><head><meta charset="utf-8"><title>${header.title}</title></head><body style="font-family:sans-serif">${node.innerHTML.replace(/display: none;?/g, "")}</body></html>`;
        const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `${header.date}_${header.title}.html`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url));
    };

    return (
        <>
            <Paper sx={{ width: "100%", overflow: "hidden" }}>
                <TableContainer ref={tableRef} sx={{ maxWidth: "100%", overflowX: "hidden" }}>
                    <div className="image-headers" style={{ textTransform: "capitalize", backgroundColor: "var(--default-bg)", display: "none" }}>
                        <Typography variant="h6" component="div">
                            {header.title}
                        </Typography>
                        {header.merged && (
                            <Typography variant="caption" component="div">
                                {t("brigadeSchedule.mergedWithLines")}: {header.merged}
                            </Typography>
                        )}
                        <Typography variant="caption">{header.date}</Typography>
                    </div>
                    <Table stickyHeader size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
                        <TableHead>
                            <TableRow>
                                {columns.map((column) => (
                                    <TableCell key={column.id} align="left" sx={{ ...COLUMN_CELL, width: column.width ?? "inherit" }}>
                                        {t(column.label)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map(({ trip }) => (
                                <TableRow key={trip[ETripTuple.tripId]}>
                                    {multi && (
                                        <>
                                            <TableCell sx={COLUMN_CELL}>{trip[ETripTuple.route][ERouteTuple.routeName]}</TableCell>
                                            <TableCell sx={COLUMN_CELL}>{trip[ETripTuple.brigade]}</TableCell>
                                        </>
                                    )}
                                    <TableCell sx={COLUMN_CELL}>{formatTime(tripStart(trip), timeZone)}</TableCell>
                                    <TableCell sx={COLUMN_CELL}>{formatTime(tripEnd(trip), timeZone)}</TableCell>
                                    <TableCell sx={COLUMN_CELL}>{trip[ETripTuple.firstStop][0]}</TableCell>
                                    <TableCell sx={COLUMN_CELL}>{trip[ETripTuple.lastStop][0]}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
            <Button size="small" sx={{ mt: 2, mb: 5 }} variant="contained" color="primary" onClick={saveAsImage}>
                {t("global.saveAsImage")}
            </Button>
        </>
    );
};
