import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import MapIcon from "@mui/icons-material/Map";
import RoomIcon from "@mui/icons-material/Room";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { Timeline, TimelineConnector, TimelineContent, TimelineDot, TimelineItem, TimelineOppositeContent, timelineOppositeContentClasses, TimelineSeparator } from "@mui/lab";
import { Box, Button, Chip, Divider, IconButton, Typography } from "@mui/material";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cityGet } from "@/api/client";
import { EItineraryStop, ERouteTuple, EStopTuple, ETripTuple, type ItineraryStop, type TripTuple, type TripTupleDetailed } from "@/api/types";
import { useApi } from "@/api/useApi";
import { RouteChip } from "@/components/departures/RouteChip";
import { vehicleTypeName } from "@/components/departures/VehicleTypeIcon";
import { delayClass, formatDelayShort, formatTime, parseVehicleId } from "@/lib/transit";
import { formatBreak, tripEnd, tripStart } from "./format";
import type { LiveVehicle } from "./useBrigadeLive";

type TripDetails = { trip: TripTuple; stops: [...ItineraryStop, number, number][] };

export type ScheduleRow = { trip: TripTupleDetailed; vehicle: LiveVehicle | null; active: boolean };

export const DelayChip = ({ delay }: { delay: number | null }) => {
    if (delay === null) return null;
    return (
        <Chip
            size="small"
            label={formatDelayShort(delay)}
            sx={{ height: 20, fontWeight: 700, color: "#fff", background: `var(--${delayClass(delay)})`, "& .MuiChip-label": { px: 0.75 } }}
        />
    );
};

export const VehicleLink = ({ city, vehicle, translationKey, route }: { city: string; vehicle: LiveVehicle; translationKey: string; route?: ReactNode }) => {
    const { t } = useTranslation();
    return (
        <>
            <Typography variant="caption" sx={{ textAlign: "center", fontWeight: 500 }}>
                <Link to={`/${city}?pojazd=${encodeURIComponent(vehicle.vehicleId)}`}>{t(translationKey, { vehicle_id: parseVehicleId(vehicle.vehicleId).number })}</Link>
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {route}
                <DelayChip delay={vehicle.delay} />
            </Box>
        </>
    );
};

const minutesText = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h${rest > 0 ? ` ${rest}min` : ""}` : `${rest}min`;
};

// One stop of a trip on the original's MUI Lab timeline (time, pin linking to the stop on the map, stop name).
export const TimelineStop = ({
    city,
    stopId,
    name,
    time,
    type,
    isLast,
    cumulativeMinutes,
    sequence,
    additionalBody,
    timeZone,
}: {
    city: string;
    stopId?: string;
    name: string;
    time: number;
    type: number;
    isLast: boolean;
    cumulativeMinutes?: number;
    sequence?: number;
    additionalBody?: ReactNode;
    timeZone: string;
}) => {
    const { t } = useTranslation();
    const typeName = vehicleTypeName(type);
    return (
        <TimelineItem sx={{ minHeight: 50 }}>
            <TimelineOppositeContent color="textSecondary" sx={{ width: "50px", minWidth: "50px" }}>
                <Box sx={{ lineHeight: "normal", display: "flex", flexDirection: "column" }}>
                    {formatTime(time, timeZone)}
                    {cumulativeMinutes !== undefined && <Typography variant="caption">{minutesText(cumulativeMinutes)}</Typography>}
                </Box>
            </TimelineOppositeContent>
            <TimelineSeparator>
                <IconButton
                    component={Link}
                    size="small"
                    aria-label={`${name} - ${t("brigadeSchedule.goToStopOnMap")}`}
                    title={`${name} - ${t("brigadeSchedule.goToStopOnMap")}`}
                    to={stopId ? `/${city}?przystanek=${encodeURIComponent(stopId)}` : `/${city}`}
                    className={`text-${typeName}`}
                >
                    <RoomIcon />
                </IconButton>
                {!isLast && <TimelineConnector sx={{ minHeight: "25px" }} className={`bg-${typeName}`} />}
            </TimelineSeparator>
            <TimelineContent sx={{ wordBreak: "break-word", display: "flex", flexDirection: "column" }}>
                <Typography sx={{ display: "inline" }}>{sequence !== undefined ? `${sequence + 1}. ${name}` : name}</Typography>
                {additionalBody}
            </TimelineContent>
        </TimelineItem>
    );
};

export const TripOnMapButton = ({ city, tripId, type }: { city: string; tripId: string; type: number }) => {
    const { t } = useTranslation();
    const name = vehicleTypeName(type);
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    return (
        <Button
            component={Link}
            to={`/${city}?kurs=${encodeURIComponent(tripId)}`}
            size="small"
            variant="outlined"
            startIcon={<MapIcon sx={{ fontSize: "0.9375rem" }} />}
            onClick={(event) => event.stopPropagation()}
            className={dark ? `border-tiny-${name} text-default-text` : `border-tiny-${name} text-${name}`}
            sx={{ textTransform: "none", px: 1, py: 0, minWidth: 0 }}
        >
            {t("stopDetails.tripOnMap")}
        </Button>
    );
};

const ExpandButton = ({ expanded, loading, noStops, error, showLoading, onExpand, onCollapse }: { expanded: boolean; loading: boolean; noStops: boolean; error: boolean; showLoading: boolean; onExpand: () => void; onCollapse: () => void }) => {
    const { t } = useTranslation();
    if (error && !showLoading) return null;
    if (error) return <Typography>{t("global.error")}</Typography>;
    if (!expanded || loading || noStops) {
        if (!showLoading) return null;
        return (
            <Box>
                <Button color="primary" variant="text" size="small" onClick={onExpand} disabled={loading || noStops}>
                    {loading ? (
                        t("global.loading")
                    ) : noStops ? (
                        t("brigadeSchedule.noStopData")
                    ) : (
                        <>
                            {t("global.expand")} <UnfoldMoreIcon />
                        </>
                    )}
                </Button>
            </Box>
        );
    }
    return (
        <Box>
            <Button color="primary" variant="text" size="small" onClick={onCollapse}>
                {t("global.collapse")} <UnfoldLessIcon />
            </Button>
        </Box>
    );
};

const TripElement = ({ city, trip, timeZone, multi, showBrigadeOnChip }: { city: string; trip: TripTupleDetailed; timeZone: string; multi: boolean; showBrigadeOnChip: boolean }) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const details = useApi(expanded ? (signal) => cityGet<TripDetails>(trip[ETripTuple.city], `/trips/${encodeURIComponent(trip[ETripTuple.tripId])}`, undefined, signal) : null, [expanded, trip[ETripTuple.tripId]]);
    const stops = details.data?.stops ?? [];
    const noStops = !!details.data && stops.length === 0;
    const route = trip[ETripTuple.route];
    const type = route[ERouteTuple.routeType];
    const start = tripStart(trip);
    const end = tripEnd(trip);
    const firstStop = stops[0]?.[EItineraryStop.stop];
    const lastStop = stops[stops.length - 1]?.[EItineraryStop.stop];
    const showStops = expanded && stops.length > 0;
    const buttonProps = {
        expanded,
        loading: details.loading,
        noStops,
        error: !!details.error,
        onExpand: () => setExpanded(true),
        onCollapse: () => setExpanded(false),
    };

    return (
        <>
            {multi && (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                    <RouteChip name={route[ERouteTuple.routeName]} brigade={showBrigadeOnChip ? trip[ETripTuple.brigade] : undefined} type={type} animate={false} />
                </Box>
            )}
            <TimelineStop
                city={city}
                stopId={firstStop?.[EStopTuple.stopId]}
                name={trip[ETripTuple.firstStop][0]}
                time={start}
                type={type}
                isLast={false}
                cumulativeMinutes={showStops ? 0 : undefined}
                sequence={showStops ? 0 : undefined}
                timeZone={timeZone}
                additionalBody={
                    <>
                        <Typography variant="caption" color="textSecondary">
                            {t("brigadeSchedule.tripTime")}: {formatBreak(end - start)}
                        </Typography>
                        {trip[ETripTuple.totalDistance] > 0 && (
                            <Typography variant="caption" color="textSecondary">
                                {t("brigadeSchedule.distance")}: {(trip[ETripTuple.totalDistance] / 1000).toFixed(2)}km
                            </Typography>
                        )}
                        {trip[ETripTuple.shortName] && (
                            <Typography variant="caption" color="textSecondary">
                                {t("global.trip")}: {trip[ETripTuple.shortName]}
                            </Typography>
                        )}
                        <Box sx={{ display: "flex", alignItems: "center", mt: 0.5 }}>
                            <TripOnMapButton city={city} tripId={trip[ETripTuple.tripId]} type={type} />
                        </Box>
                        <ExpandButton {...buttonProps} showLoading />
                    </>
                }
            />
            {showStops &&
                stops.slice(1, -1).map((row, index) => {
                    const stop = row[EItineraryStop.stop];
                    const time = row[row.length - 1] as number;
                    return (
                        <TimelineStop
                            key={`${stop[EStopTuple.stopId]}-${index}`}
                            city={city}
                            stopId={stop[EStopTuple.stopId]}
                            name={stop[EStopTuple.stopName]}
                            time={time}
                            type={type}
                            isLast={false}
                            cumulativeMinutes={(time - start) / 60000}
                            sequence={index + 1}
                            timeZone={timeZone}
                        />
                    );
                })}
            <TimelineStop
                city={city}
                stopId={lastStop?.[EStopTuple.stopId]}
                name={trip[ETripTuple.lastStop][0]}
                time={end}
                type={type}
                isLast
                cumulativeMinutes={showStops ? (end - start) / 60000 : undefined}
                sequence={showStops ? stops.length - 1 : undefined}
                timeZone={timeZone}
                additionalBody={showStops && stops.length > 2 ? <ExpandButton {...buttonProps} showLoading={false} /> : undefined}
            />
        </>
    );
};

const BreakRow = ({ ms, from, to, showBrigadeOnChip }: { ms: number; from: TripTupleDetailed; to: TripTupleDetailed; showBrigadeOnChip: boolean }) => {
    const { t } = useTranslation();
    const fromRoute = from[ETripTuple.route];
    const toRoute = to[ETripTuple.route];
    const changesLine = fromRoute[ERouteTuple.routeName] !== toRoute[ERouteTuple.routeName];
    return (
        <>
            <Divider />
            <Timeline position="right" sx={{ margin: 0, [`& .${timelineOppositeContentClasses.root}`]: { flex: 0.3 } }}>
                <TimelineItem style={{ minHeight: 20 }}>
                    <TimelineOppositeContent color="textSecondary">{formatBreak(ms)}</TimelineOppositeContent>
                    <TimelineSeparator>
                        <TimelineDot />
                    </TimelineSeparator>
                    <TimelineContent>
                        <Typography>{t("brigadeSchedule.break")}</Typography>
                        {changesLine && (
                            <Box
                                aria-label={t("brigadeSchedule.changeLineFromTo", { from: fromRoute[ERouteTuple.routeName], to: toRoute[ERouteTuple.routeName] })}
                                sx={{ display: "flex", alignItems: "baseline", gap: 1 }}
                            >
                                <Typography variant="caption" color="textSecondary">
                                    {t("brigadeSchedule.changeLine")}
                                </Typography>
                                <Box sx={{ display: "flex", alignItems: "center" }}>
                                    <RouteChip name={fromRoute[ERouteTuple.routeName]} brigade={showBrigadeOnChip ? from[ETripTuple.brigade] : undefined} type={fromRoute[ERouteTuple.routeType]} animate={false} />
                                    <ArrowForwardIcon sx={{ fontSize: "1rem" }} />
                                    <RouteChip name={toRoute[ERouteTuple.routeName]} brigade={showBrigadeOnChip ? to[ETripTuple.brigade] : undefined} type={toRoute[ERouteTuple.routeType]} animate={false} />
                                </Box>
                            </Box>
                        )}
                    </TimelineContent>
                </TimelineItem>
            </Timeline>
            <Divider />
        </>
    );
};

export const BrigadeSchedule = ({ city, rows, timeZone, multi, multiBrigade }: { city: string; rows: ScheduleRow[]; timeZone: string; multi: boolean; multiBrigade: boolean }) => {
    const { t } = useTranslation();
    const activeRef = useRef<HTMLUListElement | null>(null);
    const activeIndex = rows.findIndex((row) => row.active);
    const activeVehicle = activeIndex !== -1 ? rows[activeIndex].vehicle : null;

    return (
        <div>
            {activeIndex !== -1 && (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                    <Button
                        variant="contained"
                        size="small"
                        onClick={() => {
                            const element = activeRef.current;
                            if (element) window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 60, behavior: "smooth" });
                        }}
                    >
                        {t(activeVehicle ? "brigadeSchedule.moveToCurrentTrip" : "brigadeSchedule.moveToClosestTrip")} ↓
                    </Button>
                </Box>
            )}
            {rows.map((row, index) => {
                const next = rows[index + 1];
                return (
                    <div key={row.trip[ETripTuple.tripId]}>
                        <Timeline
                            ref={index === activeIndex ? activeRef : undefined}
                            position="right"
                            className={row.active ? "border-primary" : ""}
                            sx={{ margin: 1, [`& .${timelineOppositeContentClasses.root}`]: { flex: 0.3 } }}
                        >
                            {row.active && (
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", mb: 1 }}>
                                    <Typography variant="body1" sx={{ padding: 1, fontWeight: 500 }}>
                                        {t(row.vehicle ? "brigadeSchedule.currentTrip" : "brigadeSchedule.closestTrip")}:
                                    </Typography>
                                    {row.vehicle && <VehicleLink city={city} vehicle={row.vehicle} translationKey="brigadeSchedule.usedVehicle" />}
                                </Box>
                            )}
                            <TripElement city={city} trip={row.trip} timeZone={timeZone} multi={multi} showBrigadeOnChip={multiBrigade} />
                        </Timeline>
                        {next && <BreakRow ms={tripStart(next.trip) - tripEnd(row.trip)} from={row.trip} to={next.trip} showBrigadeOnChip={multiBrigade} />}
                    </div>
                );
            })}
        </div>
    );
};
