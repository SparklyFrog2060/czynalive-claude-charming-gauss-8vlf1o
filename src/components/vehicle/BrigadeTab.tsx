import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Box, Button, Typography } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ERouteTuple, ETripTuple } from "@/api/types";
import { useApi } from "@/api/useApi";
import { BrigadeSchedule, type ScheduleRow } from "@/components/brigades/BrigadeSchedule";
import { fetchBrigadeTrips } from "@/components/brigades/data";
import { tripEnd } from "@/components/brigades/format";
import { useBrigadeLive } from "@/components/brigades/useBrigadeLive";
import { Loading } from "@/components/Loading";
import { todayDateIndex } from "@/lib/transit";

type Props = { city: string; routeId: string; brigade: string; currentTripId?: string; vehicleId?: string; delay?: number | null; onTripClick: (tripId: string) => void };

// "Rozkład brygadowy" tab of the vehicle drawer: links to the duty pages and today's duty timeline.
export const BrigadeTab = ({ city, routeId, brigade, currentTripId, vehicleId, delay = null }: Props) => {
    const { t } = useTranslation();
    const date = todayDateIndex();
    const trips = useApi((signal) => (brigade ? fetchBrigadeTrips(city, routeId, brigade, date, signal) : Promise.resolve([])), [city, routeId, brigade, date]);
    const all = trips.data ?? [];
    const lineName = all.find((trip) => trip[ETripTuple.route][ERouteTuple.routeId] === routeId)?.[ETripTuple.route][ERouteTuple.routeName];
    const own = useMemo(() => all.filter((trip) => !lineName || trip[ETripTuple.route][ERouteTuple.routeName] === lineName), [trips.data, lineName]);
    const tripIds = useMemo(() => own.map((trip) => trip[ETripTuple.tripId]), [own]);
    const vehicles = useBrigadeLive(city, routeId, brigade, tripIds, own.length > 0);
    const merged = useMemo(() => new Set(all.map((trip) => `${trip[ETripTuple.route][ERouteTuple.routeName]}|${trip[ETripTuple.brigade]}`)).size > 1, [trips.data]);

    const rows: ScheduleRow[] = useMemo(() => {
        const now = Date.now();
        const byTrip = new Map(vehicles.filter((vehicle) => vehicle.tripId).map((vehicle) => [vehicle.tripId!, vehicle]));
        if (currentTripId && vehicleId) byTrip.set(currentTripId, { vehicleId, tripId: currentTripId, delay });
        const base = own.map((trip) => ({ trip, vehicle: byTrip.get(trip[ETripTuple.tripId]) ?? null, active: false }));
        if (base.some((row) => row.vehicle)) return base.map((row) => ({ ...row, active: !!row.vehicle }));
        return base.map((row, index) => ({ ...row, active: index === 0 ? now < tripEnd(row.trip) : now > tripEnd(base[index - 1].trip) && now < tripEnd(row.trip) }));
    }, [own, vehicles, currentTripId, vehicleId, delay]);

    if (!routeId || !brigade) {
        return (
            <Box>
                <Typography variant="body1">{t("vehicleDetails.noBrigadeInfo")}</Typography>
            </Box>
        );
    }
    if (!trips.data && !trips.error) return <Loading />;
    if (trips.error) {
        return (
            <Typography variant="body2" noWrap style={{ margin: "5px 0" }}>
                {t("global.error")}
            </Typography>
        );
    }
    if (own.length === 0) {
        return (
            <div>
                <Typography variant="subtitle2" noWrap style={{ margin: "10px 0" }}>
                    {t("global.nothingFound")}
                </Typography>
                <Typography variant="subtitle2">
                    {t("global.route_id")}: {lineName ?? routeId}
                </Typography>
                <Typography variant="subtitle2">
                    {t("global.brigade")}: {brigade}
                </Typography>
            </div>
        );
    }
    return (
        <Box>
            <Box sx={{ justifyContent: "center", display: "flex", alignItems: "center", gap: "8px", textAlign: "center" }}>
                <Button
                    component={Link}
                    size="small"
                    to={`/${city}/rozklad-jazdy-brygady/linia/${encodeURIComponent(routeId)}/brygada/${encodeURIComponent(brigade)}`}
                    variant="outlined"
                    endIcon={<OpenInNewIcon />}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    {t("brigadeSchedule.brigadeDetails")}
                </Button>
                {merged && (
                    <Button
                        component={Link}
                        size="small"
                        to={`/${city}/laczony-rozklad-jazdy-brygady/linia/${encodeURIComponent(routeId)}/brygada/${encodeURIComponent(brigade)}`}
                        variant="outlined"
                        endIcon={<OpenInNewIcon />}
                        onPointerDown={(event) => event.stopPropagation()}
                    >
                        {t("brigadeSchedule.mergedBrigadeDetails")}
                    </Button>
                )}
            </Box>
            <BrigadeSchedule city={city} rows={rows} timeZone="Europe/Warsaw" multi={false} multiBrigade={false} />
        </Box>
    );
};
