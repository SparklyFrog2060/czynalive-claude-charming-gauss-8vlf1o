import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import ShareIcon from "@mui/icons-material/Share";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import { Box, Skeleton, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ERouteTuple, ETripTuple, StopDepartureStatus, type Point } from "@/api/types";
import { TripCancelledChip } from "@/components/departures/DepartureRow";
import { RouteNameBadge } from "@/components/departures/parts";
import { MapSheet, SheetFab, SheetHeaderRow } from "@/components/map/Sheet";
import { shareLink } from "@/components/map/share";
import { useToast } from "@/components/map/SheetParts";
import { TripRouteStops } from "./TripStops";
import type { TripLiveState } from "./useTripLive";

type Props = {
    city: string;
    tripId: string;
    live: TripLiveState;
    hasBack: boolean;
    onClose: () => void;
    onBack: () => void;
    onFitTrip: () => void;
    activeStop: number;
    onStopSelect: (index: number, location: Point) => void;
    onHeightChange: (visiblePx: number) => void;
};

// `?kurs=` drawer: one trip with the scheduled time of every stop.
export const TripSheet = ({ city, tripId, live, hasBack, onClose, onBack, onFitTrip, activeStop, onStopSelect, onHeightChange }: Props) => {
    const { t } = useTranslation();
    const toast = useToast();
    const trip = live.trip;
    const route = trip?.[ETripTuple.route];
    const stops = live.itinerary?.[0] ?? [];
    const cancelled = !!live.stops?.length && live.stops.every(([, departure]) => departure[2] === StopDepartureStatus.Cancelled);
    const scheduled = (live.stops ?? []).map(([arrival, departure], index) => (index === stops.length - 1 ? arrival[0] : departure[0]));
    const headsign = trip?.[ETripTuple.headsign] || stops[stops.length - 1]?.[0]?.[2] || "";

    const share = async () => {
        const url = `${window.location.origin}/${city}?kurs=${encodeURIComponent(trip?.[ETripTuple.tripId] ?? tripId)}`;
        const result = await shareLink(t("global.trip"), t("global.share"), url);
        if (result === "copied") toast.show(t("global.copied"));
    };

    const header = (
        <>
            <SheetHeaderRow
                left={
                    <>
                        <Box sx={{ width: 36, height: 36 }} />
                        <SheetFab color="secondary" Icon={ShareIcon} label={t("global.share")} onClick={share} />
                    </>
                }
                right={
                    <>
                        <SheetFab color="secondary" Icon={ZoomOutMapIcon} onClick={onFitTrip} />
                        {hasBack && <SheetFab color="primary" Icon={ArrowBackIcon} onClick={onBack} />}
                        <SheetFab color="primary" Icon={CloseIcon} onClick={onClose} />
                    </>
                }
            />
            <Box sx={{ mx: 2, mb: 1 }}>
                {route && headsign && (
                    <RouteNameBadge
                        routeName={route[ERouteTuple.routeName]}
                        type={route[ERouteTuple.routeType]}
                        isLive={false}
                        text={headsign}
                        onClick={onFitTrip}
                        fontWeight="normal"
                        angledDivider
                        sx={{ maxWidth: "60vw", minWidth: 0, width: "fit-content" }}
                    />
                )}
                {cancelled && <TripCancelledChip />}
            </Box>
        </>
    );

    return (
        <>
            <MapSheet open header={header} onHeightChange={onHeightChange}>
                <Box sx={{ ml: 2, mr: 1 }}>
                    {live.itinerary && live.stops ? (
                        stops.length > 0 ? (
                            <TripRouteStops
                                itinerary={live.itinerary}
                                scheduled={scheduled}
                                type={route?.[ERouteTuple.routeType] ?? 3}
                                active={activeStop} onSelect={onStopSelect}
                            />
                        ) : (
                            <Box>
                                <Typography variant="body1">{t("vehicleDetails.noRouteInfo")}</Typography>
                            </Box>
                        )
                    ) : live.fatal ? (
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <Typography variant="h4">{t("global.error")}</Typography>
                        </Box>
                    ) : (
                        <div>
                            {["first", "second", "third", "fourth", "fifth"].map((key) => (
                                <Skeleton key={key} animation="wave" variant="text" height={50} width="100%" style={{ marginBottom: 5 }} />
                            ))}
                        </div>
                    )}
                </Box>
            </MapSheet>
            {toast.element}
        </>
    );
};
