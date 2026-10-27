import { Box, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useCity } from "@/api/cities";
import { ERouteTuple, ETripTuple, RouteType } from "@/api/types";
import { useApi } from "@/api/useApi";
import { PageHeader, PageTemplate } from "@/components/PageHeader";
import { RouteChip } from "@/components/departures/RouteChip";
import { BrigadeData, BrigadeTable } from "@/components/brigades/BrigadeData";
import { BrigadeSchedule, type ScheduleRow } from "@/components/brigades/BrigadeSchedule";
import { fetchBrigadeTrips } from "@/components/brigades/data";
import { DateTabs, formatDateLong, useBrigadeDate } from "@/components/brigades/DateTabs";
import { tripEnd } from "@/components/brigades/format";
import { ShareLink } from "@/components/brigades/ShareButton";
import { useBrigadeLive } from "@/components/brigades/useBrigadeLive";
import { VehicleTypeIcon } from "@/components/brigades/VehicleTypeIcon";
import { useHeaderText } from "@/lib/shell";
import { Skeleton } from "@mui/material";

const LINE_LABELS: Record<number, string> = {
    [RouteType.Tram]: "global.lineTram",
    [RouteType.Subway]: "global.subway",
    [RouteType.Bus]: "global.lineBus",
    [RouteType.Rail]: "global.train",
    [RouteType.Ferry]: "global.lineFerry",
    [RouteType.Trolleybus]: "global.lineTrolleybus",
};

type TabKey = "schedule" | "brigade-data" | "brigade-table";
const TABS: TabKey[] = ["schedule", "brigade-data", "brigade-table"];

const Loader = () => (
    <Box>
        {[0, 1, 2].map((index) => (
            <Skeleton key={index} animation="wave" variant="text" sx={{ mb: 2, width: "100%", height: "50px" }} />
        ))}
    </Box>
);

export default function BrigadePage({ multi = false }: { multi?: boolean }) {
    const { city = "", routeId = "", brigade = "" } = useParams();
    const cityInfo = useCity(city);
    const { t } = useTranslation();
    const [tab, setTab] = useState<TabKey>("schedule");
    const [now, setNow] = useState(Date.now());
    const { dates, selected, setDate, isToday, timeZone, loading: datesLoading } = useBrigadeDate(city);
    const trips = useApi((signal) => fetchBrigadeTrips(city, routeId, brigade, selected, signal), [city, routeId, brigade, selected]);
    const allTrips = trips.data ?? [];
    const ownRoute = allTrips.find((trip) => trip[ETripTuple.route][ERouteTuple.routeId] === routeId)?.[ETripTuple.route] ?? allTrips[0]?.[ETripTuple.route];
    const lineName = ownRoute?.[ERouteTuple.routeName] ?? routeId;
    const tripList = useMemo(() => (multi ? allTrips : allTrips.filter((trip) => trip[ETripTuple.route][ERouteTuple.routeName] === lineName)), [trips.data, multi, lineName]);
    const tripIds = useMemo(() => tripList.map((trip) => trip[ETripTuple.tripId]), [tripList]);
    const vehicles = useBrigadeLive(city, routeId, brigade, tripIds, isToday && tripList.length > 0);

    useHeaderText(`${t("global.route_id")} ${lineName}, ${t("global.brigade")} ${brigade}`);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(timer);
    }, []);

    const lines = useMemo(() => {
        const map = new Map<string, { name: string; brigade: string; type: number }>();
        for (const trip of tripList) {
            const route = trip[ETripTuple.route];
            map.set(`${route[ERouteTuple.routeName]}|${trip[ETripTuple.brigade]}`, { name: route[ERouteTuple.routeName], brigade: trip[ETripTuple.brigade], type: route[ERouteTuple.routeType] });
        }
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }, [tripList]);
    const isMulti = lines.length > 1;
    const isMultiBrigade = new Set(lines.map((line) => line.brigade)).size > 1;

    const rows: ScheduleRow[] = useMemo(() => {
        const byTrip = new Map(vehicles.filter((vehicle) => vehicle.tripId).map((vehicle) => [vehicle.tripId!, vehicle]));
        const base = tripList.map((trip) => ({ trip, vehicle: byTrip.get(trip[ETripTuple.tripId]) ?? null, active: false }));
        if (!isToday) return base;
        if (base.some((row) => row.vehicle)) {
            for (const row of base) row.active = !!row.vehicle;
            return base;
        }
        return base.map((row, index) => ({ ...row, active: index === 0 ? now < tripEnd(row.trip) : now > tripEnd(base[index - 1].trip) && now < tripEnd(row.trip) }));
    }, [tripList, vehicles, isToday, now]);

    const agency = ownRoute ? (cityInfo?.agencies?.[ownRoute[ERouteTuple.routeAgency]]?.name ?? cityInfo?.agencies?.default?.name) : cityInfo?.agencies?.default?.name;
    const type = ownRoute?.[ERouteTuple.routeType] ?? RouteType.Bus;
    const cityName = cityInfo?.name ?? city;

    return (
        <PageTemplate title={`${cityName} - ${t("brigadeScheduleList.brigadeSchedule")}`} padding>
            <PageHeader documentTitle={`${t("brigadeSchedule.pageTitleBrigadeSchedule", { route_id: lineName, brigade })} ${agency ?? cityName}`} />
            <div>
                <Box sx={{ display: "flex", placeItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <VehicleTypeIcon type={type} size={48} />
                    <div>
                        <Typography variant="h6">
                            <strong>
                                {t(LINE_LABELS[type] ?? "global.lineBus")} {lineName}
                            </strong>{" "}
                            - {agency}
                        </Typography>
                        <Typography variant="h5">
                            <strong>
                                {t("global.brigade")} {brigade}
                            </strong>
                        </Typography>
                        {isMulti && (
                            <Box sx={{ display: "flex", gap: 1, flexDirection: "column" }}>
                                <Typography variant="h5">
                                    <strong>{t("brigadeSchedule.mergedWithLines")}:</strong>
                                </Typography>
                                <Box sx={{ display: "flex", gap: 1 }}>
                                    {lines.map((line) => (
                                        <RouteChip key={`${line.name}-${line.brigade}`} name={line.name} type={line.type} brigade={isMultiBrigade ? line.brigade : undefined} animate={false} />
                                    ))}
                                </Box>
                            </Box>
                        )}
                    </div>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Box
                        style={{ overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 1, whiteSpace: "pre-wrap", lineHeight: "34px" }}
                        sx={{ flexDirection: "column" }}
                    >
                        <ShareLink title={`${cityName} ${t("brigadeSchedule.shareUrlDescription", { route_id: lineName, brigade })}`} />
                    </Box>
                </Box>

                {datesLoading && !dates.length ? null : <DateTabs dates={dates} selected={selected} onChange={setDate} />}

                {trips.loading && !trips.data ? (
                    <Loader />
                ) : trips.error ? (
                    <Typography variant="body2" noWrap style={{ margin: "5px 0" }}>
                        {t("global.error")}
                    </Typography>
                ) : tripList.length === 0 ? (
                    <div>
                        <Typography variant="subtitle2" noWrap style={{ margin: "10px 0" }}>
                            {t("global.nothingFound")}
                        </Typography>
                        <Typography variant="subtitle2">
                            {t("global.route_id")}: {lineName}
                        </Typography>
                        <Typography variant="subtitle2">
                            {t("global.brigade")}: {brigade}
                        </Typography>
                        <Typography variant="subtitle2">
                            {t("global.date")}: {formatDateLong(selected)}
                        </Typography>
                    </div>
                ) : (
                    <>
                        <Tabs
                            value={tab}
                            onChange={(_, value) => setTab(value)}
                            indicatorColor="primary"
                            textColor="primary"
                            variant="scrollable"
                            scrollButtons="auto"
                            allowScrollButtonsMobile
                        >
                            {TABS.map((key) => (
                                <Tab
                                    key={key}
                                    value={key}
                                    label={t(
                                        key === "schedule" ? "brigadeSchedule.tabBrigadeSchedule" : key === "brigade-data" ? "brigadeSchedule.tabBrigadeData" : "brigadeSchedule.tabBrigadeSimplified",
                                    )}
                                />
                            ))}
                        </Tabs>
                        <div role="tabpanel">
                            {tab === "schedule" && <BrigadeSchedule city={city} rows={rows} timeZone={timeZone} multi={isMulti} multiBrigade={isMultiBrigade} />}
                            {tab === "brigade-data" && <BrigadeData city={city} rows={rows} lines={lines} timeZone={timeZone} multiBrigade={isMultiBrigade} />}
                            {tab === "brigade-table" && (
                                <BrigadeTable
                                    rows={rows}
                                    multi={isMulti}
                                    timeZone={timeZone}
                                    header={{
                                        title: `${t("global.route_id")} ${lineName}, ${t("global.brigade")} ${brigade} - ${agency ?? cityName}`,
                                        merged: isMulti ? lines.map((line) => line.name).join(", ") : undefined,
                                        date: formatDateLong(selected),
                                    }}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>
        </PageTemplate>
    );
}
