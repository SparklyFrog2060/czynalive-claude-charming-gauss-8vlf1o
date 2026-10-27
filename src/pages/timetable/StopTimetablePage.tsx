import PlaceIcon from "@mui/icons-material/Place";
import RouteIcon from "@mui/icons-material/Route";
import { Box, Button, Divider, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useEffect, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useCity } from "@/api/cities";
import { cityGet } from "@/api/client";
import { ERouteTuple, EStopTuple, type RouteTuple, type StopTupleDetailed } from "@/api/types";
import { useApi } from "@/api/useApi";
import { isWstRoute, loadWstStopDirections, loadWstStopTimetable } from "@/api/wst";
import { fetchCityAlerts } from "@/components/alerts/api";
import { typeIcons, vehicleTypeName } from "@/components/departures/VehicleTypeIcon";
import { PageHeader, PageTemplate } from "@/components/PageHeader";
import { ExpandableText, routeLink, ShareLine, SmallAction, sortRoutesByTypeId, sortTypes, stopLink, TypeCircles, typeReadableKey, uniqueRoutes, useThemeMode, agencyNameOf } from "@/components/timetable/common";
import { RouteAlertBox, StopTimetable, SubwayTimetable, type StopTimetableResponse } from "@/components/timetable/StopTimetable";
import { useRecentStops } from "@/components/timetable/recentStops";

type DirectionsResponse = { stop: StopTupleDetailed; directions: [route: RouteTuple, direction: number, headsign: string, terminus: boolean][] };

const Loading = () => {
    const { t } = useTranslation();
    return (
        <Typography sx={{ mt: 3 }} variant="h5" gutterBottom>
            {t("global.loading")}...
        </Typography>
    );
};

// Route buttons of a stop ("Wybierz linię…").
const StopRoutes = ({ city, stopId, stopName, routes, dataCity }: { city: string; stopId: string; stopName: string; routes: RouteTuple[]; dataCity: string }) => {
    const dark = useThemeMode() === "dark";
    return (
        <Box>
            <Typography variant="body1">
                <Trans i18nKey="timetables.chooseRouteHeader" values={{ url_stop_name: stopName }} components={[<strong key="1" />]} />
            </Typography>
            <Grid container spacing={1} style={{ display: "flex", padding: 10 }} sx={{ alignItems: "center" }}>
                {routes.length === 0 ? (
                    <Typography variant="subtitle2" style={{ margin: "10px 0" }}>
                        <Trans i18nKey="timetables.noRouteOnStop" values={{ stopName }} components={[<strong key="1" />]} />
                    </Typography>
                ) : (
                    routes.map((route) => {
                        const type = route[ERouteTuple.routeType];
                        const name = vehicleTypeName(type);
                        return (
                            <Grid key={`${route[ERouteTuple.city]}/${route[ERouteTuple.routeId]}`} size={{ xs: 4, lg: 3 }}>
                                <Button
                                    fullWidth
                                    disableRipple
                                    disableFocusRipple
                                    disableElevation
                                    size="small"
                                    variant="outlined"
                                    className={dark ? `border-${name} text-default-text bg-default-bg` : `border-tiny-${name} text-${name} bg-white`}
                                    style={{ flexDirection: "column" }}
                                    component={Link}
                                    to={stopLink(city, stopId, route[ERouteTuple.routeId], dataCity)}
                                >
                                    <div style={{ display: "flex", alignItems: "center" }}>
                                        {dark ? typeIcons(type).whiteIcon : typeIcons(type).icon}
                                        {route[ERouteTuple.routeName]}
                                    </div>
                                </Button>
                            </Grid>
                        );
                    })
                )}
            </Grid>
        </Box>
    );
};

export default function StopTimetablePage() {
    const { city = "", stopId = "", routeId } = useParams();
    const [params] = useSearchParams();
    const dataCity = params.get("miasto") || city;
    const cityInfo = useCity(city);
    const { t } = useTranslation();
    const { add: addRecent } = useRecentStops(city);
    const agencyName = agencyNameOf(city, cityInfo);
    const cityName = cityInfo?.name ?? city;
    const timeZone = cityInfo?.timezone;

    const meta = useApi(
        async (signal) => {
            if (routeId && isWstRoute(routeId)) return loadWstStopDirections(stopId, signal);
            const apiMeta = await cityGet<DirectionsResponse>(dataCity, `/stops/${encodeURIComponent(stopId)}/directions`, undefined, signal).catch(async (error) => {
                if (dataCity !== "krakow" || signal.aborted) throw error;
                return null;
            });
            if (!apiMeta) return loadWstStopDirections(stopId, signal);
            if (dataCity !== "krakow") return apiMeta;
            const wstMeta = await loadWstStopDirections(stopId, signal).catch(() => null);
            if (!wstMeta) return apiMeta;
            const routes = [...(apiMeta.stop[EStopTuple.routes] as RouteTuple[]), ...wstMeta.stop[EStopTuple.routes]];
            return {
                stop: [...apiMeta.stop.slice(0, EStopTuple.routes), routes, apiMeta.stop[EStopTuple.entrances]] as StopTupleDetailed,
                directions: [...apiMeta.directions, ...wstMeta.directions],
            };
        },
        [dataCity, stopId, routeId],
    );
    const timetable = useApi(
        routeId
            ? async (signal) => {
                  const stop = encodeURIComponent(stopId);
                  const route = encodeURIComponent(routeId);
                  try {
                      if (isWstRoute(routeId)) return await loadWstStopTimetable(stopId, routeId, signal);
                      return await cityGet<StopTimetableResponse>(dataCity, `/cnc/timetable/stop/${stop}/${route}`, undefined, signal);
                  } catch (error) {
                      if (signal.aborted) throw error;
                      return cityGet<StopTimetableResponse>(dataCity, `/stops/${stop}/timetable/${route}`, undefined, signal);
                  }
              }
            : null,
        [dataCity, stopId, routeId],
    );
    const alerts = useApi(routeId ? (signal) => fetchCityAlerts(dataCity, signal) : null, [dataCity, routeId]);

    const stop = meta.data?.stop;
    const routes = useMemo(() => uniqueRoutes(sortRoutesByTypeId((stop?.[EStopTuple.routes] as RouteTuple[] | undefined) ?? [])), [stop]);
    const route = routeId ? ((stop?.[EStopTuple.routes] as RouteTuple[] | undefined) ?? []).find((entry) => entry[ERouteTuple.routeId] === routeId) : undefined;
    const stopName = stop?.[EStopTuple.stopName] ?? "";
    const routeName = route?.[ERouteTuple.routeName] ?? routeId ?? "";
    const headsign = meta.data?.directions.find((entry) => entry[0][ERouteTuple.routeId] === routeId)?.[2] ?? route?.[ERouteTuple.routeLongName] ?? "";

    const headerText = !stop ? null : !routeId ? stopName : route?.[ERouteTuple.routeType] === 1 ? null : `${stopName}, ${t("global.route_id")} ${routeName}`;

    useEffect(() => {
        if (stop) addRecent(stop as unknown as Parameters<typeof addRecent>[0]);
    }, [stop?.[EStopTuple.stopId]]);

    const headerTitle = `${t("timetables.timetable")} ${agencyName}`;
    const rest = route ? `, ${t("global.route_id")} ${t(typeReadableKey(route[ERouteTuple.routeType]))} ${routeName}` : "";
    const documentTitle = stop ? t("timetables.pageTitleStopRoute_id", { stopName, agencyName, rest }) : headerTitle;

    if (meta.error) {
        return (
            <PageTemplate title={`${headerTitle} - ${t("global.stop")} ${stopId}`} padding>
                <PageHeader documentTitle={documentTitle} subtitle={headerText} />
                <Typography variant="body1">{t("timetables.stopNotFound", { id: stopId })}</Typography>
            </PageTemplate>
        );
    }

    if (!stop) {
        return (
            <PageTemplate title={headerTitle} padding>
                <PageHeader documentTitle={documentTitle} subtitle={headerText} />
                <Loading />
            </PageTemplate>
        );
    }

    if (routeId && !route && !timetable.data && timetable.error) {
        return (
            <PageTemplate title={`${t("timetables.timetable")} - ${t("global.stop")} ${stopName}`} padding>
                <PageHeader documentTitle={documentTitle} subtitle={headerText} />
                <Box>
                    <Typography variant="body1">{t("timetables.routeIdNotFoundWithRoute", { route_id: routeId, stop_name: stopName })}</Typography>
                </Box>
            </PageTemplate>
        );
    }

    const countsByType = new Map<number, number>();
    for (const entry of routes) countsByType.set(entry[ERouteTuple.routeType], (countsByType.get(entry[ERouteTuple.routeType]) ?? 0) + 1);
    const typeList = sortTypes([...countsByType.keys()]);
    const routeType = route?.[ERouteTuple.routeType] ?? 3;
    const alertItems = (alerts.data?.alerts ?? [])
        .filter((alert) => alert.routes.some((entry) => entry[ERouteTuple.routeId] === routeId))
        .map((alert) => ({ key: alert.id, title: alert.title, to: `/${city}/komunikaty/komunikat?id=${encodeURIComponent(alert.id)}` }));
    const alertBox = <RouteAlertBox routeName={routeName} items={alertItems} />;

    return (
        <PageTemplate title={headerTitle} padding>
            <PageHeader documentTitle={documentTitle} subtitle={headerText} />
            <Box style={{ padding: "0 0 10px" }}>
                <div style={{ display: "flex", placeItems: "center", gap: 10, marginBottom: 10 }}>
                    <TypeCircles types={sortTypes(stop[EStopTuple.vehicleTypes].length ? stop[EStopTuple.vehicleTypes] : typeList)} />
                    <div>
                        <Typography variant="h5">
                            <strong>
                                {t("global.stop")} {stopName}
                            </strong>{" "}
                            - {agencyName}
                        </Typography>
                        {routeId && (
                            <Typography variant="h5">
                                <strong>
                                    {t(typeReadableKey(routeType))} {t("global.route_id")} {routeName}
                                </strong>
                            </Typography>
                        )}
                    </div>
                </div>
                <Box sx={{ display: "flex", alignItems: "flex-start", flexDirection: "column" }}>
                    <ExpandableText>
                        <Typography variant="caption" gutterBottom>
                            <Trans i18nKey="timetables.stopDescription" values={{ url_stop_name: stopName, agencyName }} components={[<strong key="1" />]} />{" "}
                            {typeList.map((type, index) => (
                                <span key={type}>
                                    {t("plural.route_id", { count: countsByType.get(type) ?? 0 })}
                                    {t("delays.basedOnNumberOfVehiclesPart2")}
                                    <strong>{t(typeReadableKey(type))}</strong>
                                    {index < typeList.length - 1 ? ", " : "."}
                                </span>
                            ))}
                        </Typography>
                    </ExpandableText>
                </Box>
                <ShareLine text={t("timetables.shareScheduleDescription", { city: cityName, url_stop_name: stopName, agencyName })}>
                    {routeId && (
                        <>
                            <SmallAction to={stopLink(city, stopId, undefined, dataCity)} icon={<PlaceIcon fontSize="small" />} label={t("global.stop")} />
                            <SmallAction to={routeLink(city, routeId, dataCity)} icon={<RouteIcon fontSize="small" />} label={t("timetables.route")} />
                        </>
                    )}
                    <SmallAction to={`/${city}?przystanek=${encodeURIComponent(stopId)}`} icon={<PlaceIcon fontSize="small" />} label={t("map.map")} />
                </ShareLine>
                <Divider style={{ margin: "10px 0" }} />
                {!routeId ? (
                    <StopRoutes city={city} stopId={stopId} stopName={stopName} routes={routes} dataCity={dataCity} />
                ) : timetable.error ? (
                    <Box sx={{ p: 2 }}>
                        <Typography variant="body1">{t("global.error")}</Typography>
                    </Box>
                ) : !timetable.data ? (
                    <Box sx={{ marginBottom: "80px" }}>
                        {alertBox}
                        <Typography variant="body1">{t("global.loading")}...</Typography>
                    </Box>
                ) : routeType === 1 ? (
                    <SubwayTimetable
                        data={timetable.data}
                        routeName={routeName}
                        routeType={routeType}
                        stopName={stopName}
                        cityName={cityName}
                        headsign={headsign}
                        alerts={alertBox}
                        timeZone={timeZone}
                    />
                ) : (
                    <StopTimetable
                        city={city}
                        data={timetable.data}
                        routeName={routeName}
                        routeType={routeType}
                        stopName={stopName}
                        cityName={cityName}
                        headsign={headsign}
                        alerts={alertBox}
                        brigadeLink={(brigade) => `/${city}/rozklad-jazdy-brygady/linia/${encodeURIComponent(routeId)}/brygada/${encodeURIComponent(brigade)}`}
                        timeZone={timeZone}
                    />
                )}
            </Box>
        </PageTemplate>
    );
}
