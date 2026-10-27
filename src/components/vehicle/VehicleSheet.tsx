import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import GpsOffIcon from "@mui/icons-material/GpsOff";
import ShareIcon from "@mui/icons-material/Share";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import { Box, Chip, IconButton, Menu, MenuItem, Skeleton, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ERouteTuple, ETripTuple, EVehiclePosition, RouteType, StopDepartureStatus, type Point, type VehiclePositionDetailed } from "@/api/types";
import { PopupInfo, RouteNameBadge } from "@/components/departures/parts";
import { vehicleTypeName } from "@/components/departures/VehicleTypeIcon";
import { DelayChip, MapSheet, SheetFab, SheetHeaderRow, SheetInfoRow } from "@/components/map/Sheet";
import { shareLink } from "@/components/map/share";
import { AlertList, useToast } from "@/components/map/SheetParts";
import { TripProgress } from "@/components/trip/TripProgress";
import { VehicleRouteStops } from "@/components/trip/TripStops";
import type { TripLiveState } from "@/components/trip/useTripLive";
import { parseVehicleId, routeColor } from "@/lib/transit";
import { wstExecutionIdFromVehicleId } from "@/api/wst";
import { useFavourites } from "@/store/favourites";
import { BrigadeTab } from "./BrigadeTab";
import { VehicleInfoTab } from "./VehicleInfoTab";

type Props = {
    city: string;
    vehicleId: string;
    live: TripLiveState;
    hasBack: boolean;
    onClose: () => void;
    onBack: () => void;
    onFitTrip: () => void;
    onFollow: () => void;
    activeStop: number;
    onStopSelect: (index: number, location: Point) => void;
    onTripClick: (tripRef: string, city: string) => void;
    onHeightChange: (visiblePx: number) => void;
};

const useElapsed = (timestamp: number | undefined) => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    if (!timestamp) return null;
    const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
    return { mins: Math.floor(seconds / 60), secs: seconds % 60 };
};

// Label / value row with a copy button inside the "nr" popup.
export const CopyRow = ({ label, value, onCopy }: { label: string; value: string; onCopy: (value: string) => void }) => (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="body2">
            {label}: <strong>{value}</strong>
        </Typography>
        <IconButton size="small" onClick={() => onCopy(value)} aria-label={label}>
            <ContentCopyIcon fontSize="small" />
        </IconButton>
    </Box>
);

const BRIGADE_TYPES: number[] = [RouteType.Tram, RouteType.Bus, RouteType.Trolleybus];

// `?pojazd=` drawer: live vehicle with its trip, fleet data and duty.
export const VehicleSheet = ({ city, vehicleId, live, hasBack, onClose, onBack, onFitTrip, onFollow, activeStop, onStopSelect, onTripClick, onHeightChange }: Props) => {
    const { t } = useTranslation();
    const toast = useToast();
    const [tab, setTab] = useState<"route" | "vehicle" | "brigade">("route");
    const [favouriteMenu, setFavouriteMenu] = useState<HTMLElement | null>(null);
    const { has, toggle } = useFavourites(city);
    const position = live.position;
    const route = position?.[EVehiclePosition.route] ?? live.trip?.[ETripTuple.route];
    const parsedVehicle = parseVehicleId(vehicleId);
    const isWstExecution = !!wstExecutionIdFromVehicleId(vehicleId);
    const number = isWstExecution ? "" : parsedVehicle.number;
    const idType = parsedVehicle.type;
    const type = route?.[ERouteTuple.routeType] ?? idType;
    const brigade = position?.[EVehiclePosition.brigade] || live.trip?.[ETripTuple.brigade] || "";
    const timestamp = position && position.length > 6 ? (position as VehiclePositionDetailed)[EVehiclePosition.timestamp] : undefined;
    const elapsed = useElapsed(timestamp);
    const stops = live.itinerary?.[0] ?? [];
    const sequence = live.sequence ?? 0;
    const current = live.stops?.[Math.min(sequence, (live.stops?.length ?? 1) - 1)];
    const currentPoint = current?.[sequence >= stops.length - 1 ? 0 : 1];
    const hasDelay = !!currentPoint && (currentPoint[2] === StopDepartureStatus.OnTrip || currentPoint[2] === StopDepartureStatus.OnPreviousTrip);
    const firstPoint = live.stops?.[0]?.[1];
    const firstStopMinRemaining = firstPoint ? Math.floor((firstPoint[0] + firstPoint[1] - Date.now()) / 60000) : undefined;
    const routeId = route?.[ERouteTuple.routeId];
    const favouriteVehicle = has("vehicles", vehicleId);
    const favouriteRoute = routeId ? has("routes", routeId) : false;
    const typeColor = `var(--${vehicleTypeName(type)})`;

    useEffect(() => setTab("route"), [vehicleId]);

    const copy = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.show(`${t("global.copied")} "${value}"`);
        } catch {}
    };

    const share = async () => {
        const url = `${window.location.origin}/${city}?pojazd=${encodeURIComponent(vehicleId)}`;
        const result = await shareLink(t("global.vehicle"), t("vehicleDetails.shareDescription", { route_id: route?.[ERouteTuple.routeName] ?? "" }), url);
        if (result === "copied") toast.show(t("global.copied"));
    };

    let lastData: ReactNode = null;
    if (elapsed) {
        const late = elapsed.mins > 1;
        const text = elapsed.mins > 0 ? `${elapsed.mins}min ${elapsed.secs}s` : `${elapsed.secs}s ${t("stopDetails.ago")}`;
        const icon = live.fatal ? (
            <GpsOffIcon className={late ? "text-white" : ""} fontSize="small" />
        ) : (
            <GpsFixedIcon className={late ? "text-white" : ""} fontSize="small" />
        );
        lastData = (
            <PopupInfo
                element={
                    late ? (
                        <Chip className="bg-error" size="small" label={<span className="text-white">{text}</span>} icon={icon} />
                    ) : (
                        <Typography variant="body2" sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                            {icon} {text}
                        </Typography>
                    )
                }
                popupContent={t("vehicleDetails.timeFromLastData")}
            />
        );
    }

    const header = (
        <>
            <TripProgress color={typeColor} fraction={stops.length > 1 ? Math.min(1, sequence / (stops.length - 1)) : 0} />
            <SheetHeaderRow
                left={
                    <>
                        <SheetFab
                            color="secondary"
                            Icon={favouriteVehicle || favouriteRoute ? StarIcon : StarBorderIcon}
                            className={favouriteVehicle || favouriteRoute ? "bg-warning" : ""}
                            label={t(favouriteVehicle || favouriteRoute ? "favourites.removeFromFavourites" : "favourites.addToFavourites")}
                            onClick={(event) => setFavouriteMenu(event.currentTarget)}
                        />
                        <SheetFab color="secondary" Icon={ShareIcon} label={t("global.share")} onClick={share} />
                    </>
                }
                right={
                    <>
                        <SheetFab color="secondary" Icon={ZoomOutMapIcon} label={t("global.zoomOut")} onClick={onFitTrip} />
                        {hasBack && <SheetFab color="primary" Icon={ArrowBackIcon} onClick={onBack} />}
                        <SheetFab color="primary" Icon={CloseIcon} onClick={onClose} />
                    </>
                }
            />
            <Menu anchorEl={favouriteMenu} open={!!favouriteMenu} onClose={() => setFavouriteMenu(null)}>
                <MenuItem disabled sx={{ opacity: "1 !important", fontSize: "0.85rem" }}>
                    {t("favourites.whatToAddToFavourites")}
                </MenuItem>
                {route && (
                    <MenuItem
                        onClick={() => {
                            toggle("routes", {
                                id: route[ERouteTuple.routeId],
                                name: route[ERouteTuple.routeName],
                                type: route[ERouteTuple.routeType],
                                color: routeColor(route),
                            });
                            setFavouriteMenu(null);
                        }}
                    >
                        {favouriteRoute ? "✓ " : ""}
                        {t("favourites.line")} {route[ERouteTuple.routeName]}
                    </MenuItem>
                )}
                <MenuItem
                    onClick={() => {
                        toggle("vehicles", { id: vehicleId, name: number, type });
                        setFavouriteMenu(null);
                    }}
                >
                    {favouriteVehicle ? "✓ " : ""}
                    {t("favourites.vehicleNo")} {number}
                </MenuItem>
            </Menu>
            <Box sx={{ mx: 2 }}>
                <SheetInfoRow>
                    {route ? (
                        <RouteNameBadge
                            routeName={route[ERouteTuple.routeName]}
                            type={route[ERouteTuple.routeType]}
                            isLive={!!position && !live.fatal}
                            text={live.trip?.[ETripTuple.headsign] || ""}
                            onClick={onFollow}
                            fontWeight="normal"
                            angledDivider
                            sx={{ maxWidth: "60vw", minWidth: 0, width: "fit-content" }}
                        />
                    ) : (
                        <span />
                    )}
                    {lastData}
                </SheetInfoRow>
                <SheetInfoRow>
                    {!position || live.fatal ? (
                        <div />
                    ) : hasDelay ? (
                        <DelayChip delayInSeconds={Math.round(currentPoint![1] / 1000)} stopSequence={sequence} firstStopMinRemaining={firstStopMinRemaining} />
                    ) : (
                        <div />
                    )}
                    {(number || brigade) && (
                        <PopupInfo
                            element={
                                <Typography variant="body2" sx={{ cursor: "pointer" }}>
                                    {t("global.numberShort").toLowerCase()} {number || "-"}
                                    {brigade ? `/${brigade}` : ""}
                                </Typography>
                            }
                            popupContent={
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                    <CopyRow label={t("global.vehicleNo")} value={number || "-"} onCopy={copy} />
                                    {brigade && <CopyRow label={t("global.brigade")} value={brigade} onCopy={copy} />}
                                </Box>
                            }
                        />
                    )}
                </SheetInfoRow>
                <SheetInfoRow>
                    <AlertList alerts={live.alerts} />
                </SheetInfoRow>
            </Box>
            <Tabs
                value={tab}
                onChange={(_, value) => setTab(value)}
                indicatorColor="primary"
                textColor="primary"
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{ mb: 1 }}
            >
                <Tab value="route" label={t("timetables.route")} />
                {number && <Tab value="vehicle" label={t("global.vehicle")} />}
                {!isWstExecution && BRIGADE_TYPES.includes(type) && <Tab value="brigade" label={t("brigadeSchedule.brigadeSchedule")} />}
            </Tabs>
        </>
    );

    return (
        <>
            <MapSheet open header={header} onHeightChange={onHeightChange}>
                <Box sx={{ ml: 2, mr: 1 }}>
                    {tab === "route" &&
                        (live.itinerary && live.stops ? (
                            <VehicleRouteStops
                                itinerary={live.itinerary}
                                stopTimes={live.stops}
                                sequence={live.sequence}
                                type={type}
                                active={activeStop} onSelect={onStopSelect}
                            />
                        ) : (position && !live.trip) || live.fatal ? (
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                <h4>{t("vehicleDetails.noRouteInfo")}</h4>
                            </Box>
                        ) : (
                            <div>
                                {["first", "second", "third"].map((key) => (
                                    <Skeleton key={key} animation="wave" variant="text" height={50} width="100%" style={{ marginBottom: 5 }} />
                                ))}
                            </div>
                        ))}
                    {tab === "vehicle" && <VehicleInfoTab city={live.city} vehicleId={vehicleId} brigade={brigade} />}
                    {tab === "brigade" && routeId && (
                        <BrigadeTab
                            city={live.city}
                            routeId={routeId}
                            brigade={brigade}
                            currentTripId={live.trip?.[ETripTuple.tripId]}
                            vehicleId={vehicleId}
                            delay={hasDelay ? currentPoint![1] : null}
                            onTripClick={(tripRef) => onTripClick(tripRef, live.city)}
                        />
                    )}
                </Box>
            </MapSheet>
            {toast.element}
        </>
    );
};
