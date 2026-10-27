import MapIcon from "@mui/icons-material/Map";
import PanToolIcon from "@mui/icons-material/PanTool";
import { Box, Button, Card, CardActionArea, Chip, Divider, Typography } from "@mui/material";
import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ALIGHT, EDeparture, ERouteTuple, EStopDepartureTuple, ETripTuple, EVehiclePosition, StopDepartureStatus, type StopDepartureTuple } from "@/api/types";
import { parseVehicleId } from "@/lib/transit";
import { wstExecutionVehicleId, wstTripExecutionId } from "@/api/wst";
import { useThemeMode } from "@/components/timetable/common";
import { hhmm, isLiveStatus } from "./departureUtils";
import type { DepartureVehicles } from "./useDepartureVehicles";
import { MarqueeText, PopupInfo, TimeChips } from "./parts";
import { RouteChip } from "./RouteChip";
import { vehicleTypeName } from "./VehicleTypeIcon";

// Per-vehicle [delay ms, current headsign, model] (cnc/map/vehicles); lets a row name the trip its vehicle is still on.
export const VehicleExtrasContext = createContext<DepartureVehicles | null>(null);

export const departureLink = (city: string, departure: StopDepartureTuple) => {
    const vehicle = departure[EStopDepartureTuple.vehicle];
    const executionId = wstTripExecutionId(departure[EStopDepartureTuple.trip]);
    if (executionId) return `/${city}?pojazd=${encodeURIComponent(wstExecutionVehicleId(executionId))}`;
    if (vehicle && isLiveStatus(departure[EStopDepartureTuple.departure][EDeparture.status])) return `/${city}?pojazd=${encodeURIComponent(vehicle[EVehiclePosition.id])}`;
    return `/${city}?kurs=${encodeURIComponent(departure[EStopDepartureTuple.trip][ETripTuple.tripId])}`;
};

// "Kurs na mapie" outlined button in the vehicle-type colour.
export const TripOnMapButton = ({ city, tripId, routeType, executionId }: { city: string; tripId: string; routeType: number; executionId?: string }) => {
    const { t } = useTranslation();
    const dark = useThemeMode() === "dark";
    const name = vehicleTypeName(routeType);
    return (
        <Button
            component={Link}
            to={executionId ? `/${city}?pojazd=${encodeURIComponent(wstExecutionVehicleId(executionId))}` : `/${city}?kurs=${encodeURIComponent(tripId)}`}
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

export const TripCancelledChip = () => {
    const { t } = useTranslation();
    return (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
            <Chip size="small" component="span" label={<span className="text-white">{t("stopDetails.tripCancelled")}</span>} clickable={false} className="bg-error" style={{ maxHeight: 17 }} />
        </Box>
    );
};

type Props = {
    city: string;
    departure: StopDepartureTuple;
    now: number;
    compact?: boolean;
    active?: boolean;
    showBrigade?: boolean;
    showVehicleNo?: boolean;
    onSelect?: (departure: StopDepartureTuple) => void;
};

// Departure card of the original (stop sheet, favourites): line chip, headsign, minutes to go and the time chips.
export const DepartureRow = ({ city, departure, now, compact = false, active, showBrigade, showVehicleNo, onSelect }: Props) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const trip = departure[EStopDepartureTuple.trip];
    const vehicle = departure[EStopDepartureTuple.vehicle];
    const info = departure[EStopDepartureTuple.departure];
    const route = trip[ETripTuple.route];
    const type = route[ERouteTuple.routeType];
    const status = info[EDeparture.status];
    const executionId = wstTripExecutionId(trip);
    // Live is determined by the departure status, not vehicle tuple presence.
    const live = isLiveStatus(status);
    const cancelled = status === StopDepartureStatus.Cancelled;
    const scheduled = info[EDeparture.scheduledDeparture];
    const delayMin = live ? Math.round(info[EDeparture.delay] / 60000) : undefined;
    const expected = scheduled + (delayMin ?? 0) * 60000;
    const minRemaining = Math.round((expected - now) / 60000);
    const past = minRemaining < 0;
    const brigade = showBrigade ? trip[ETripTuple.brigade] || vehicle?.[EVehiclePosition.brigade] || undefined : undefined;
    const vehicleNo = showVehicleNo && live && vehicle ? parseVehicleId(vehicle[EVehiclePosition.id]).number : undefined;
    const onDemand = ((info[EDeparture.alight] ?? 0) & ALIGHT.OnDemand) !== 0;

    const rowRef = useRef<HTMLButtonElement | null>(null);
    const chipRef = useRef<HTMLDivElement | null>(null);
    const timeRef = useRef<HTMLDivElement | null>(null);
    const [sectionWidth, setSectionWidth] = useState(0);
    useLayoutEffect(() => {
        if (!rowRef.current || !chipRef.current || !timeRef.current) return;
        setSectionWidth(rowRef.current.offsetWidth - chipRef.current.offsetWidth - timeRef.current.offsetWidth - 20);
    }, [showBrigade]);

    const extras = useContext(VehicleExtrasContext) ?? {};
    let caption: ReactNode = null;
    if (status === StopDepartureStatus.OnPreviousTrip && live && vehicle) {
        const currentHeadsign = extras[vehicle[EVehiclePosition.id]]?.[1];
        const currentRoute = vehicle[EVehiclePosition.route][ERouteTuple.routeName];
        caption = currentHeadsign ? (
            <>
                {t("stopDetails.inPreviousTripTo")}:{" "}
                <i>
                    {currentRoute !== route[ERouteTuple.routeName] ? <strong>{currentRoute} </strong> : ""}
                    {currentHeadsign}
                </i>
            </>
        ) : (
            <>{t("stopDetails.inPreviousTripTo").replace(/ do$/, "")}</>
        );
    } else if (status === StopDepartureStatus.OnTrip && live && vehicle) {
        const state = extras[vehicle[EVehiclePosition.id]];
        if (state?.[3])
            caption = (
                <>
                    {t(state[4] ? "stopDetails.onStop" : "stopDetails.nextStop")}: <i>{state[3]}</i>
                </>
            );
    }

    const handleClick = () => {
        // Wieliczka rows have no vehicle tuple in the board, but every row has an
        // execution id: a single tap opens the live vehicle view (with the GTFS
        // route drawn) just like the "Kurs na mapie" button, instead of only
        // highlighting the row.
        if (executionId) return navigate(departureLink(city, departure));
        if (onSelect) onSelect(departure);
        else navigate(departureLink(city, departure));
    };

    return (
        <Card variant="outlined" data-departure sx={[{ position: "relative", overflow: "hidden" }, active ? { border: "1px solid var(--default-text)" } : {}, past ? { opacity: 0.5 } : { opacity: 1 }]}>
            <CardActionArea
                ref={rowRef}
                onClick={handleClick}
                sx={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 0.5, gap: 0.5, position: "relative", zIndex: 2 }}
            >
                <Box sx={{ display: "flex", flexDirection: "column", flex: 1, gap: 0.5, flexShrink: 0 }}>
                    <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                        <Box ref={chipRef} sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: "auto", marginRight: "2px" }}>
                            {vehicleNo && (
                                <PopupInfo
                                    element={
                                        <Typography variant="caption" sx={{ lineHeight: 1, fontSize: "0.8125rem" }}>
                                            {vehicleNo}
                                        </Typography>
                                    }
                                    popupContent={
                                        <Typography variant="caption">
                                            {t("global.vehicleNo")}: {vehicleNo}
                                        </Typography>
                                    }
                                />
                            )}
                            <RouteChip name={route[ERouteTuple.routeName]} type={type} isLive={live} showLiveBadge brigade={brigade} />
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", flex: 1 }}>
                            <MarqueeText text={cancelled ? <s>{trip[ETripTuple.headsign]}</s> : trip[ETripTuple.headsign]} sectionWidth={sectionWidth} variant="body2" />
                            {caption && <MarqueeText text={caption} sectionWidth={sectionWidth} variant="caption" />}
                            {cancelled && <TripCancelledChip />}
                        </Box>
                    </Box>
                    {!compact && (
                        <>
                            <Divider />
                            <Box sx={{ display: "flex", gap: 1, paddingTop: 0.5, alignItems: "center" }}>
                                {onDemand && (
                                    <PopupInfo
                                        element={<PanToolIcon sx={{ fontSize: "1em", color: "var(--opposite-bg)" }} />}
                                        popupContent={
                                            <Typography variant="caption">
                                                {t("global.stop")} {t("global.onDemand").toLowerCase()}
                                            </Typography>
                                        }
                                    />
                                )}
                                {(!live || executionId) && <TripOnMapButton city={city} tripId={trip[ETripTuple.tripId]} routeType={type} executionId={executionId} />}
                            </Box>
                        </>
                    )}
                </Box>
                <Box ref={timeRef} sx={{ display: "flex", justifyContent: "space-between", flexDirection: "column", alignItems: "center", minWidth: "70px" }}>
                    <TimeChips depTime={hhmm(scheduled)} delayedDepTime={live ? hhmm(expected) : ""} delayInMin={delayMin} minRemaining={minRemaining} agoLabel={t("stopDetails.ago")} />
                </Box>
            </CardActionArea>
        </Card>
    );
};
