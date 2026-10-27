import PanToolIcon from "@mui/icons-material/PanTool";
import { Box, Chip, IconButton, ListItemButton, ListItemText, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ALIGHT, EStopTuple, StopDepartureStatus, type ItineraryTuple, type Point, type TripStopTime } from "@/api/types";
import { TimeChips } from "@/components/departures/parts";
import { typeIcons, vehicleTypeName } from "@/components/departures/VehicleTypeIcon";
import { DelayChip } from "@/components/map/Sheet";
import { formatTime } from "@/lib/transit";

const COLUMN = 40;
const DOT = 24;

const Rail = styled("div")({ position: "relative", display: "flex", justifyContent: "center", alignItems: "center" });

const Line = styled("div", { shouldForwardProp: (prop) => !["isFirst", "isLast", "color"].includes(prop as string) })<{
    isFirst: boolean;
    isLast: boolean;
    color: string;
}>(({ isFirst, isLast, color }) => ({
    width: 4,
    backgroundColor: color,
    borderRadius: isFirst ? "6px 6px 0 0" : isLast ? "0 0 6px 6px" : 0,
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    top: isFirst ? "50%" : 0,
    bottom: isLast ? "50%" : 0,
}));

const StopNumber = styled("span", { shouldForwardProp: (prop) => prop !== "color" })<{ color: string }>(({ color }) => ({
    height: DOT,
    width: DOT,
    backgroundColor: color,
    borderRadius: "50%",
    border: "2px solid var(--default-bg)",
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "0.875rem",
    fontWeight: 700,
    color: "var(--white)",
    position: "relative",
    zIndex: 1,
}));

const VehicleBadge = styled(IconButton, { shouldForwardProp: (prop) => prop !== "textColor" })<{ textColor: string }>(({ textColor }) => ({
    "&:hover, &:focus": { backgroundColor: "var(--white)" },
    color: textColor,
    transition: "transform 700ms",
    border: "2px solid",
    zIndex: 2,
    padding: 3,
    position: "absolute",
    top: 0,
    left: COLUMN / 2,
    willChange: "transform",
    backgroundColor: "var(--white)",
}));

const OnDemandIcon = () => <PanToolIcon className="iconOnStop" />;

const hhmm = (ms: number, timeZone?: string) => formatTime(ms, timeZone);

type VehicleProps = {
    itinerary: ItineraryTuple;
    stopTimes?: TripStopTime[];
    sequence?: number;
    type: number;
    timeZone?: string;
    active: number;
    onSelect?: (index: number, location: Point) => void;
};

// "Trasa" tab of the vehicle drawer: numbered rail, live times, the vehicle riding along it.
export const VehicleRouteStops = ({ itinerary, stopTimes, sequence, type, timeZone, active, onSelect }: VehicleProps) => {
    const { t } = useTranslation();
    const listRef = useRef<HTMLDivElement>(null);
    const [offsets, setOffsets] = useState<number[]>([]);
    const [, tick] = useState(0);
    const stops = itinerary[0];
    const current = sequence ?? 0;
    const color = `var(--${vehicleTypeName(type)})`;
    const now = Date.now();

    useEffect(() => {
        const timer = setInterval(() => tick((value) => value + 1), 60000);
        return () => clearInterval(timer);
    }, []);


    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) return;
        setOffsets([...list.querySelectorAll<HTMLElement>("[data-stop]")].map((row) => row.offsetTop));
    }, [stops.length]);

    useEffect(() => {
        const list = listRef.current;
        let scroller = list?.parentElement ?? null;
        while (scroller && !scroller.classList.contains("react-modal-sheet-content-scroller")) scroller = scroller.parentElement;
        if (!scroller || !offsets.length) return;
        scroller.scrollTop = current === 0 ? 0 : (offsets[current - 1] ?? 0);
    }, [current, offsets.length]);

    const badgeOffset = offsets.length ? Math.round((offsets[current - 1] ?? offsets[current] ?? 0) + DOT / 2) : 0;

    return (
        <Box ref={listRef} sx={{ position: "relative" }}>
            {offsets.length > 0 && (
                <VehicleBadge textColor={color} size="large" style={{ transform: `translateX(-50%) translateY(${badgeOffset}px)` }}>
                    {typeIcons(type).verticalLineIcon}
                </VehicleBadge>
            )}
            {stops.map((itineraryStop, index) => {
                const [stop, alight] = itineraryStop;
                const passed = index < current;
                const live = stopTimes?.[index];
                const point = live ? (index === stops.length - 1 ? live[0] : live[1]) : undefined;
                const hasLive = !!point && point[2] !== StopDepartureStatus.Scheduled && point[2] !== StopDepartureStatus.Cancelled;
                const scheduled = point?.[0];
                const delayed = scheduled !== undefined ? scheduled + (hasLive ? point![1] : 0) : undefined;
                const diff = scheduled !== undefined && delayed !== undefined ? (delayed - scheduled) / 60000 : undefined;
                const minRemaining = delayed !== undefined ? Math.floor((delayed - now) / 60000) : undefined;
                const delayInMin = diff === undefined ? undefined : diff > 0 ? Math.floor(diff) : -Math.floor(Math.abs(diff));
                const onDemand = (alight & ALIGHT.OnDemand) !== 0;
                return (
                    <Box
                        key={`${stop[EStopTuple.stopId]}-${index}`}
                        data-stop
                        sx={{ display: "grid", position: "relative", gridTemplateColumns: `${COLUMN}px 1fr` }}
                    >
                        <Rail>
                            <Line isFirst={index === 0} isLast={index === stops.length - 1} color={color} />
                            <StopNumber color={color}>{index + 1}</StopNumber>
                        </Rail>
                        <ListItemButton
                            dense
                            divider
                            sx={[{ px: 0, pl: 1 }, passed ? { color: "#adadad" } : { color: "" }]}
                            onClick={() => {
                                onSelect?.(index, stop[EStopTuple.location]);
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                                                <Typography variant="body2" style={{ fontWeight: index === active ? "bold" : "400", wordBreak: "break-word" }}>
                                                    {onDemand ? (
                                                        <>
                                                            <OnDemandIcon />
                                                            {stop[EStopTuple.stopName]} - {t("global.onDemand")}
                                                        </>
                                                    ) : (
                                                        stop[EStopTuple.stopName]
                                                    )}
                                                </Typography>
                                                {passed && hasLive && diff !== undefined && (
                                                    <div style={{ opacity: 0.5 }}>
                                                        <DelayChip delayInSeconds={diff * 60} />
                                                    </div>
                                                )}
                                            </Box>
                                            {scheduled !== undefined && delayed !== undefined && (passed ? hasLive : true) && (
                                                <TimeChips
                                                    depTime={hhmm(scheduled, timeZone)}
                                                    delayedDepTime={hhmm(delayed, timeZone)}
                                                    delayInMin={delayInMin}
                                                    minRemaining={minRemaining}
                                                    agoLabel={t("stopDetails.ago")}
                                                    layout="vertical"
                                                />
                                            )}
                                        </Box>
                                    }
                                />
                            </Box>
                        </ListItemButton>
                    </Box>
                );
            })}
        </Box>
    );
};

type TripProps = {
    itinerary: ItineraryTuple;
    scheduled: number[];
    type: number;
    timeZone?: string;
    active: number;
    onSelect?: (index: number, location: Point) => void;
};

// Stop list of the `?kurs=` drawer: numbered rail and the scheduled time of every stop.
export const TripRouteStops = ({ itinerary, scheduled, type, timeZone, active, onSelect }: TripProps) => {
    const stops = itinerary[0];
    const color = `var(--${vehicleTypeName(type)})`;
    return (
        <Box>
            {stops.map((itineraryStop, index) => {
                const [stop, alight] = itineraryStop;
                const isActive = index === active;
                const onDemand = (alight & ALIGHT.OnDemand) !== 0;
                return (
                    <Box
                        key={`${stop[EStopTuple.stopId]}-${index}`}
                        data-stop
                        sx={{ display: "grid", position: "relative", gridTemplateColumns: `${COLUMN}px 1fr` }}
                    >
                        <Rail>
                            <Line isFirst={index === 0} isLast={index === stops.length - 1} color={color} />
                            <StopNumber color={color}>{index + 1}</StopNumber>
                        </Rail>
                        <ListItemButton
                            dense
                            divider
                            sx={{ px: 0, pl: 1 }}
                            onClick={() => {
                                onSelect?.(index, stop[EStopTuple.location]);
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <Typography variant="body2" style={{ fontWeight: isActive ? "bold" : "400", wordBreak: "break-word" }}>
                                                {onDemand ? (
                                                    <>
                                                        <OnDemandIcon />
                                                        {stop[EStopTuple.stopName]}
                                                    </>
                                                ) : (
                                                    stop[EStopTuple.stopName]
                                                )}
                                            </Typography>
                                            {scheduled[index] !== undefined && (
                                                <Chip
                                                    size="small"
                                                    variant="outlined"
                                                    label={
                                                        <span style={{ fontWeight: isActive ? "bold" : "normal", fontSize: "1rem" }}>
                                                            {hhmm(scheduled[index], timeZone)}
                                                        </span>
                                                    }
                                                    sx={{ ml: 1, flexShrink: 0 }}
                                                />
                                            )}
                                        </Box>
                                    }
                                />
                            </Box>
                        </ListItemButton>
                    </Box>
                );
            })}
        </Box>
    );
};
