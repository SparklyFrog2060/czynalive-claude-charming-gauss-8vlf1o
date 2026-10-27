import {
    Box,
    Chip,
    Divider,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { RouteType } from "@/api/types";
import { useApi } from "@/api/useApi";
import { formatDateTime, isMissingEndpoint } from "@/components/alerts/api";
import { PageHeader, PageTemplate } from "@/components/PageHeader";
import { delayMinutesClass, fetchDelaysRanking, type RankingMetrics } from "@/components/stats/api";
import { IS_MOBILE_AGENT } from "@/components/stats/StatsDataGrid";
import { DescriptionBox, TypeTabs, typePlural, VehicleTypesPill } from "@/components/stats/common";

const RANKING_TYPES = [RouteType.Bus, RouteType.Tram, RouteType.Trolleybus];

type SortKey = "name" | "count" | "avg" | "median";
type Row = { cityKey: string; name: string; metrics: RankingMetrics };

const METRIC_COLUMNS: {
    id: Exclude<SortKey, "name">;
    labelKey: string;
    render: (metrics: RankingMetrics) => React.ReactNode;
}[] = [
    {
        id: "count",
        labelKey: "allCitiesDelays.vehiclesCount",
        render: (metrics) => metrics.count,
    },
    {
        id: "avg",
        labelKey: "delays.averageDelay",
        render: (metrics) => (
            <Chip size="small" label={`${metrics.avg} min`} className={`bg-${delayMinutesClass(metrics.avg)} text-white`} />
        ),
    },
    {
        id: "median",
        labelKey: "delays.medianDelay",
        render: (metrics) => `${metrics.median} min`,
    },
];

export default function DelaysRankingPage() {
    const { t } = useTranslation();
    const { data, error, loading } = useApi((signal) => fetchDelaysRanking(signal), [], 15_000);
    const [vehicleType, setVehicleType] = useState<number | "total">("total");
    const [order, setOrder] = useState<"asc" | "desc">("desc");
    const [orderBy, setOrderBy] = useState<SortKey>("avg");

    const availableTypes = useMemo(() => {
        const present = new Set<number>();
        for (const city of Object.values(data?.cities ?? {})) {
            for (const [type, metrics] of Object.entries(city.byType)) {
                if (metrics.count > 0) present.add(+type);
            }
        }
        return RANKING_TYPES.filter((type) => present.has(type));
    }, [data]);

    const rows = useMemo(() => {
        const result: Row[] = [];
        for (const [cityKey, city] of Object.entries(data?.cities ?? {})) {
            const metrics = vehicleType === "total" ? city.total : city.byType[vehicleType];
            result.push({
                cityKey,
                name: city.name,
                metrics: metrics ?? { count: 0, avg: 0, median: 0 },
            });
        }
        return result.sort((a, b) => {
            if (a.metrics.count === 0 && b.metrics.count > 0) return 1;
            if (b.metrics.count === 0 && a.metrics.count > 0) return -1;
            const diff = orderBy === "name" ? a.name.localeCompare(b.name, "pl") : a.metrics[orderBy] - b.metrics[orderBy];
            return order === "asc" ? diff : -diff;
        });
    }, [data, vehicleType, order, orderBy]);

    const sortBy = (key: SortKey) => {
        if (orderBy !== key) {
            setOrderBy(key);
            setOrder(key === "name" ? "asc" : "desc");
        } else setOrder(order === "asc" ? "desc" : "asc");
    };

    const pageTitle = t("allCitiesDelays.pageTitle");
    return (
        <>
            <PageHeader title={pageTitle} />
            <PageTemplate title={pageTitle} padding>
                {loading && !data ? (
                    <Typography sx={{ mt: 3 }} variant="h5" gutterBottom>
                        {t("global.loading")}...
                    </Typography>
                ) : error || !data ? (
                    <Typography sx={{ mt: 3 }} variant="h5" gutterBottom>
                        {error && isMissingEndpoint(error) ? t("global.noData") : t("global.loadFailed")}
                    </Typography>
                ) : (
                    <Box sx={{ mt: 2, pb: 6 }}>
                        <DescriptionBox
                            updated={formatDateTime(data.updatedAt, true)}
                            shareText={t("allCitiesDelays.pageTitle")}
                            lines={[
                                t("allCitiesDelays.descriptionPart1"),
                                <Trans i18nKey="allCitiesDelays.descriptionPart2" components={[<strong key="1" />]} />,
                                t("allCitiesDelays.descriptionPart3"),
                                t("allCitiesDelays.descriptionPart4"),
                            ]}
                        />
                        <Divider sx={{ my: 2 }} />
                        {availableTypes.length > 1 && <TypeTabs value={vehicleType} types={availableTypes} onChange={setVehicleType} />}
                        <Box sx={{ my: 3 }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.25,
                                    mb: 1.5,
                                }}
                            >
                                <VehicleTypesPill types={vehicleType === "total" ? availableTypes : [vehicleType]} size={vehicleType === "total" ? 32 : 50} />
                                <Box>
                                    <Typography variant="h6">{t("allCitiesDelays.tableTitle")}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {vehicleType === "total" ? t("delays.publicTransportVehicles") : typePlural(vehicleType)}
                                    </Typography>
                                </Box>
                            </Box>
                            {IS_MOBILE_AGENT && (
                                <Typography variant="body2" sx={{ textAlign: "center" }}>
                                    {t("delays.tableIsMovable")}
                                </Typography>
                            )}
                            <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
                                <Table size="small" aria-label="delays table">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>{t("allCitiesDelays.positionShort")}</TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={orderBy === "name"}
                                                    direction={orderBy === "name" ? order : "asc"}
                                                    onClick={() => sortBy("name")}
                                                >
                                                    {t("allCitiesDelays.city")}
                                                </TableSortLabel>
                                            </TableCell>
                                            {METRIC_COLUMNS.map((column) => (
                                                <TableCell key={column.id} align="right">
                                                    <TableSortLabel
                                                        active={orderBy === column.id}
                                                        direction={orderBy === column.id ? order : "desc"}
                                                        onClick={() => sortBy(column.id)}
                                                    >
                                                        {t(column.labelKey)}
                                                    </TableSortLabel>
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {rows.map((row, index) => {
                                            const active = row.metrics.count > 0;
                                            return (
                                                <TableRow
                                                    key={row.cityKey}
                                                    hover
                                                    sx={{
                                                        "&:last-child td, &:last-child th": { border: 0 },
                                                    }}
                                                >
                                                    <TableCell>{index + 1}.</TableCell>
                                                    <TableCell component="th" scope="row">
                                                        <Link to={`/${row.cityKey}/opoznienia-autobusy-tramwaje`}>
                                                            {row.name}
                                                        </Link>
                                                    </TableCell>
                                                    {METRIC_COLUMNS.map((column) => (
                                                        <TableCell key={column.id} align="right">
                                                            {active ? (
                                                                column.render(row.metrics)
                                                            ) : column.id === "count" ? (
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {t("allCitiesDelays.noActiveVehicles")}
                                                                </Typography>
                                                            ) : (
                                                                "-"
                                                            )}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    </Box>
                )}
            </PageTemplate>
        </>
    );
}
