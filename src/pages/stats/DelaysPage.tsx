import { Box, Button, Divider, Typography } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import Grid from "@mui/material/Grid2";
import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useCity } from "@/api/cities";
import { useApi } from "@/api/useApi";
import { formatDateTime, isMissingEndpoint } from "@/components/alerts/api";
import { PageHeader, PageTemplate } from "@/components/PageHeader";
import { TopLinesChart } from "@/components/stats/TopLinesChart";
import { boldHeader, IS_MOBILE_AGENT, naturalCompare, StatsDataGrid } from "@/components/stats/StatsDataGrid";
import { VehicleGrid } from "@/components/stats/VehicleGrid";
import {
    computeDelayStats,
    delayMinutesClass,
    fetchLiveVehicles,
    mapLinesUrl,
    mapVehicleUrl,
    sortTypes,
    toleranceFor,
    type DelayStats,
    type LiveVehicle,
    type RouteDelay,
} from "@/components/stats/api";
import { DelayChip, DescriptionBox, SectionHeader, StatTile, TypeTabs, typeName, typePlural } from "@/components/stats/common";
import { vehicleType } from "@/lib/transit";

const tabKey = (type: number | "total") => (type === "total" ? "wszystkie" : vehicleType(type).key);

const StatsTiles = ({ city, stats }: { city: string; stats: DelayStats }) => {
    const { t } = useTranslation();
    const tolerance = toleranceFor(city);
    const vehicleLink = (vehicle: LiveVehicle | undefined) =>
        vehicle && (
            <Typography variant="caption" gutterBottom>
                <Link to={mapVehicleUrl(city, vehicle.id)} style={{ color: "var(--primary)" }}>
                    {vehicle.route[2]} {vehicle.headsign}
                    <br />
                    (#{vehicle.vehicleNo})
                </Link>
            </Typography>
        );
    const toleranceNote = (
        <Typography variant="caption" gutterBottom>
            <em>
                {t("delays.toleranceDescription", {
                    max: tolerance.max,
                    min: Math.abs(tolerance.min),
                })}
            </em>
        </Typography>
    );
    const percentile = (percentile: string, delay: number) => (
        <Typography variant="caption" gutterBottom>
            <em>
                <Trans i18nKey="delays.percentileDescription" values={{ percentile, delay }} components={[<strong key="1" />]} />
            </em>
        </Typography>
    );
    const maxMinutes = Math.round((stats.max?.delay ?? 0) / 60);
    const minMinutes = Math.round((stats.min?.delay ?? 0) / 60);
    const tiles = [
        <StatTile title={t("delays.averageDelay")} value={stats.avg} suffix="min" className={`bg-${delayMinutesClass(stats.avg)} text-white`} />,
        <StatTile title={t("delays.medianDelay")} value={stats.median} suffix="min" className={`bg-${delayMinutesClass(stats.median)} text-white`} />,
        <StatTile
            title={t("delays.biggestDelay")}
            value={maxMinutes}
            suffix="min"
            className={`bg-${delayMinutesClass(maxMinutes)} text-white`}
            additional={vehicleLink(stats.max)}
        />,
        <StatTile
            title={t("delays.lowestDelay")}
            value={minMinutes}
            suffix="min"
            className={`bg-${delayMinutesClass(minMinutes)} text-white`}
            additional={vehicleLink(stats.min)}
        />,
        <StatTile
            title={t("delays.tolerancePercentage")}
            value={stats.inTolerance.percentage}
            suffix="%"
            className={stats.inTolerance.percentage < 90 ? "bg-error text-white" : "bg-success text-white"}
            additional={
                <>
                    <Typography variant="caption" gutterBottom>
                        {t("plural.vehicle", { count: stats.inTolerance.number })}
                    </Typography>
                    {toleranceNote}
                </>
            }
        />,
        <StatTile
            title={t("delays.outsideTolerancePercentage")}
            value={stats.outTolerance.percentage}
            suffix="%"
            className={stats.outTolerance.percentage > 10 ? "bg-error text-white" : "bg-success text-white"}
            additional={
                <>
                    <Typography variant="caption" gutterBottom>
                        {t("plural.vehicle", { count: stats.outTolerance.number })}
                    </Typography>
                    {toleranceNote}
                </>
            }
        />,
        <StatTile
            title={t("delays.25percentile")}
            value={stats.quantile25}
            suffix="min"
            className={`bg-${delayMinutesClass(stats.quantile25)} text-white`}
            additional={percentile("25", stats.quantile25)}
        />,
        <StatTile
            title={t("delays.75percentile")}
            value={stats.quantile75}
            suffix="min"
            className={`bg-${delayMinutesClass(stats.quantile75)} text-white`}
            additional={percentile("75", stats.quantile75)}
        />,
        <StatTile
            title={t("delays.90percentile")}
            value={stats.quantile90}
            suffix="min"
            className={`bg-${delayMinutesClass(stats.quantile90)} text-white`}
            additional={percentile("90", stats.quantile90)}
        />,
        <StatTile
            title={t("delays.top10DelayTitle")}
            value={stats.avgTop10}
            suffix="min"
            className={`bg-${delayMinutesClass(stats.avgTop10)} text-white`}
            additional={
                <Typography variant="caption" gutterBottom>
                    <em>
                        <Trans i18nKey="delays.top10DelayDescription" values={{ count: stats.top10VehCount }} components={[<strong key="1" />]} />
                    </em>
                </Typography>
            }
        />,
    ];
    return (
        <Grid container spacing={1} sx={{ my: 2 }}>
            {tiles.map((tile, index) => (
                <Grid key={index} size={{ xs: 6, sm: 4, md: 2 }}>
                    {tile}
                </Grid>
            ))}
        </Grid>
    );
};

const PerRouteSection = ({
    city,
    stats,
    types,
    selectedType,
    subtitle,
}: {
    city: string;
    stats: DelayStats;
    types: number[];
    selectedType: number | "total";
    subtitle: string;
}) => {
    const { t } = useTranslation();
    const routeColumns = useMemo<GridColDef<RouteDelay>[]>(
        () =>
            (
                [
                    {
                        field: "type",
                        headerName: t("delays.vehicleType"),
                        hideable: false,
                        minWidth: 80,
                        maxWidth: 120,
                        flex: 1,
                        valueGetter: (_, row) => typeName(row.type),
                        renderCell: (params) => <span title={String(params.row.type)}>{typeName(params.row.type)}</span>,
                    },
                    {
                        field: "routeName",
                        headerName: t("global.route_id"),
                        flex: 1,
                        hideable: false,
                        minWidth: 60,
                        maxWidth: 80,
                        sortComparator: naturalCompare,
                    },
                    {
                        field: "count",
                        headerName: t("delays.vehiclesCount"),
                        flex: 1,
                        hideable: false,
                        type: "number",
                        minWidth: 60,
                    },
                    {
                        field: "avgDelay",
                        headerName: t("delays.averageDelay"),
                        hideable: false,
                        flex: 1,
                        type: "number",
                        minWidth: 150,
                        renderCell: (params) => <DelayChip minutes={params.row.avgDelay} />,
                    },
                    {
                        field: "mapa",
                        headerName: t("map.map"),
                        hideable: false,
                        flex: 1,
                        minWidth: 150,
                        sortable: false,
                        renderCell: (params) => (
                            <Button component={Link} to={mapLinesUrl(city, params.row.type, params.row.routeId)} size="small">
                                {t("global.showOnMap")}
                            </Button>
                        ),
                    },
                ] as GridColDef<RouteDelay>[]
            ).map(boldHeader),
        [t, city],
    );
    return (
        <Box sx={{ my: 2 }}>
            <SectionHeader types={types} selectedType={selectedType} title={t("delays.routeIdChartHeader")} subtitle={subtitle} />
            <Grid container spacing={3} sx={{ my: 2 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TopLinesChart data={stats.perRoute.slice(0, 10)} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="h6">{t("delays.routeIdAllDelays")}:</Typography>
                    {IS_MOBILE_AGENT && (
                        <Typography variant="body2" sx={{ textAlign: "center" }}>
                            {t("delays.tableIsMovable")}
                        </Typography>
                    )}
                    <div style={{ height: 600 }}>
                        <StatsDataGrid<RouteDelay>
                            initialState={{
                                sorting: { sortModel: [{ field: "avgDelay", sort: "desc" }] },
                            }}
                            getRowId={(row) => `${row.city}/${row.routeId}`}
                            rows={stats.perRoute}
                            columns={routeColumns}
                            density="compact"
                            disableColumnSelector
                            disableDensitySelector
                        />
                    </div>
                </Grid>
            </Grid>
        </Box>
    );
};

export default function DelaysPage() {
    const { city = "" } = useParams();
    const cityInfo = useCity(city);
    const { t } = useTranslation();
    const [params, setParams] = useSearchParams();
    const { data, error, loading } = useApi((signal) => fetchLiveVehicles(city, signal), [city], 15_000);
    const cityName = cityInfo?.name ?? city;
    const agencyName = cityInfo?.agencies?.default?.name ?? cityName;

    const types = useMemo(() => sortTypes((data?.vehicles ?? []).map((vehicle) => vehicle.type)), [data]);
    const requested = params.get("rodzaj");
    const selectedType: number | "total" = types.find((type) => tabKey(type) === requested) ?? "total";
    const vehicles = useMemo(() => (data?.vehicles ?? []).filter((vehicle) => selectedType === "total" || vehicle.type === selectedType), [data, selectedType]);
    const stats = useMemo(() => computeDelayStats(vehicles, city), [vehicles, city]);
    const updated = data ? formatDateTime(data.updatedAt, true) : "";
    const groupName = selectedType === "total" ? t("delays.publicTransportVehicles") : typePlural(selectedType);
    const subtitle = `${groupName} ${agencyName}`;
    const typesLabel = types.map(typeName).join(", ");

    const description = (
        <DescriptionBox
            updated={updated}
            shareText={`${cityName} ${t("delays.pageTitle")}`}
            lines={[
                t("delays.descriptionPart1", { city: cityName }),
                <Trans
                    i18nKey={city === "warsaw" ? "delays.descriptionWarsaw" : "delays.descriptionPart2"}
                    values={{ city: cityName }}
                    components={[<strong key="1" />]}
                />,
            ]}
        />
    );

    const pageTitle = `${agencyName} - ${t("delays.pageTitle")} ${typesLabel}`;
    return (
        <>
            <PageHeader title={pageTitle} />
            <PageTemplate title={pageTitle} padding>
                {loading && !data ? (
                    <Typography sx={{ mt: 3 }} variant="h5" gutterBottom>
                        {t("global.loading")}...
                    </Typography>
                ) : error && !data ? (
                    <>
                        {description}
                        <Typography sx={{ mt: 3 }} variant="h5" gutterBottom>
                            {isMissingEndpoint(error) ? t("global.noData") : t("global.loadFailed")}
                        </Typography>
                    </>
                ) : !data || data.vehicles.length === 0 ? (
                    <>
                        {description}
                        <Typography sx={{ mt: 3 }} variant="h5" gutterBottom>
                            {t("delays.noData")}
                        </Typography>
                    </>
                ) : (
                    <Box sx={{ mt: 2, pb: "80px" }}>
                        {description}
                        <Divider sx={{ my: 2 }} />
                        {types.length > 1 && (
                            <TypeTabs
                                value={selectedType}
                                types={types}
                                onChange={(next) => {
                                    const nextParams = new URLSearchParams(params);
                                    if (next === "total") nextParams.delete("rodzaj");
                                    else nextParams.set("rodzaj", tabKey(next));
                                    setParams(nextParams, { replace: true });
                                }}
                            />
                        )}
                        {stats.count === 0 ? (
                            <Typography variant="h5">{t("delays.noData")}</Typography>
                        ) : (
                            <>
                                <Box sx={{ my: 2 }}>
                                    {selectedType === "total" ? (
                                        <SectionHeader types={types} selectedType="total" title={subtitle} subtitle={t("delays.activeDelays")} />
                                    ) : (
                                        <SectionHeader types={types} selectedType={selectedType} title={t("delays.activeDelays")} subtitle={subtitle} />
                                    )}
                                    <Box sx={{ display: "flex", flexDirection: "column" }}>
                                        <Typography variant="caption" gutterBottom>
                                            <Trans
                                                i18nKey="delays.basedOnNumberOfVehiclesPart1"
                                                values={{ count: stats.count }}
                                                components={[<strong key="1" />]}
                                            />
                                            {selectedType !== "total" && (
                                                <>
                                                    {t("delays.basedOnNumberOfVehiclesPart2")}
                                                    {typeName(selectedType).toLowerCase()}
                                                </>
                                            )}
                                            {` ${agencyName} `}
                                            {t("delays.basedOnNumberOfVehiclesPart3")}
                                        </Typography>
                                        <Typography variant="caption" gutterBottom>
                                            {t("global.updated")}: {updated}
                                        </Typography>
                                    </Box>
                                    <StatsTiles city={city} stats={stats} />
                                </Box>
                                <Divider sx={{ my: 4 }} />
                                <VehicleGrid
                                    city={city}
                                    title={t("delays.gridHeader")}
                                    subtitle={subtitle}
                                    vehicles={vehicles.filter((vehicle) => vehicle.delay !== null)}
                                    types={types}
                                    selectedType={selectedType}
                                    withDelay
                                />
                                <Divider sx={{ my: 2 }} />
                                <VehicleGrid
                                    city={city}
                                    title={t("delays.noDelayGridHeader")}
                                    subtitle={subtitle}
                                    vehicles={vehicles.filter((vehicle) => vehicle.delay === null && vehicle.tripId !== null)}
                                    showEmpty
                                    types={types}
                                    selectedType={selectedType}
                                />
                                <Divider sx={{ my: 2 }} />
                                <VehicleGrid
                                    city={city}
                                    title={t("delays.outsideGridHeader")}
                                    subtitle={subtitle}
                                    vehicles={vehicles.filter((vehicle) => vehicle.state === "offRoute")}
                                    showEmpty
                                    types={types}
                                    selectedType={selectedType}
                                />
                                <Divider sx={{ my: 2 }} />
                                <PerRouteSection city={city} stats={stats} types={types} selectedType={selectedType} subtitle={subtitle} />
                            </>
                        )}
                    </Box>
                )}
            </PageTemplate>
        </>
    );
}
