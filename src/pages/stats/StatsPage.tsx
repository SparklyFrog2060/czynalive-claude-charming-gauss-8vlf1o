import { Box, Divider, Tab, Tabs, Typography } from "@mui/material";
import { useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";
import { useCity } from "@/api/cities";
import { useApi } from "@/api/useApi";
import { isMissingEndpoint } from "@/components/alerts/api";
import { typeIcons } from "@/components/departures/VehicleTypeIcon";
import { PageHeader, PageTemplate } from "@/components/PageHeader";
import { fetchLiveVehicles, sortTypes } from "@/components/stats/api";
import { typePlural } from "@/components/stats/common";
import { groupByRoute, RoutesVehiclesGrid } from "@/components/stats/RoutesVehiclesGrid";
import { vehicleType } from "@/lib/transit";

export default function StatsPage() {
    const { city = "" } = useParams();
    const cityInfo = useCity(city);
    const { t } = useTranslation();
    const [params, setParams] = useSearchParams();
    const cityName = cityInfo?.name ?? city;

    const live = useApi((signal) => fetchLiveVehicles(city, signal), [city], 20_000);
    const selectedByType = useRef(new Map<number, Set<string>>());
    const [, forceRender] = useState(0);

    const grouped = useMemo(() => groupByRoute(live.data?.vehicles ?? []), [live.data]);
    const typeStats = useMemo(() => {
        const types = sortTypes(grouped.map((route) => route.type));
        return types.map((type) => {
            const typeRoutes = grouped.filter((route) => route.type === type);
            return {
                type,
                routes: typeRoutes,
                vehiclesCount: typeRoutes.reduce((sum, route) => sum + route.vehicles.length, 0),
            };
        });
    }, [grouped]);

    const requested = params.get("rodzaj");
    const current = typeStats.find((entry) => vehicleType(entry.type).key === requested) ?? typeStats[0];
    const selected = current ? (selectedByType.current.get(current.type) ?? new Set(current.routes.map((route) => route.key))) : new Set<string>();


    return (
        <>
            <PageHeader documentTitle={`${t("stats.pageTitle")} - ${cityName}`} />
            <PageTemplate padding>
                <Box sx={{ mb: 6 }}>
                    <Typography variant="h3">
                        {t("stats.pageTitle")} - {cityName}
                    </Typography>
                    <Typography variant="h4">
                        <Trans i18nKey="stats.part1" values={{ city: cityName }} components={[<strong key="1" />]} />
                    </Typography>
                    <Divider style={{ margin: "5px 0" }} />
                    <Typography variant="h4" gutterBottom sx={{ mt: 3 }}>
                        {t("stats.vehiclesOnRoutes")}
                    </Typography>
                    {live.error && !live.data ? (
                        <Typography variant="body1">{isMissingEndpoint(live.error) ? t("global.noData") : t("global.error")}</Typography>
                    ) : live.loading && !live.data ? (
                        <Typography variant="body1">{t("global.loading")}...</Typography>
                    ) : typeStats.length === 0 || !current ? (
                        <Typography variant="body1">{t("global.noData")}</Typography>
                    ) : (
                        <>
                            <Tabs
                                value={current.type}
                                onChange={(_, next: number) => {
                                    const nextParams = new URLSearchParams(params);
                                    nextParams.set("rodzaj", vehicleType(next).key);
                                    setParams(nextParams, { replace: true });
                                }}
                                indicatorColor="primary"
                                textColor="primary"
                                variant="scrollable"
                                scrollButtons="auto"
                                allowScrollButtonsMobile
                                sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
                            >
                                {typeStats.map((entry) => (
                                    <Tab
                                        key={entry.type}
                                        value={entry.type}
                                        icon={typeIcons(entry.type).icon}
                                        iconPosition="start"
                                        label={typePlural(entry.type)}
                                        sx={{ minHeight: "48px" }}
                                    />
                                ))}
                            </Tabs>
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                    {typePlural(current.type)}: {t("plural.route_id", { count: current.routes.length })},{" "}
                                    {t("plural.vehicle", { count: current.vehiclesCount })} {t("global.live").toLowerCase()}
                                </Typography>
                            </Box>
                            <RoutesVehiclesGrid
                                key={current.type}
                                routes={current.routes}
                                city={city}
                                selected={selected}
                                onSelectedChange={(next) => {
                                    selectedByType.current.set(current.type, next);
                                    forceRender((value) => value + 1);
                                }}
                            />
                        </>
                    )}

                </Box>
            </PageTemplate>
        </>
    );
}
