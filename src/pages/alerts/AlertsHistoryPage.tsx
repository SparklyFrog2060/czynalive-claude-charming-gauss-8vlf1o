import { Box, Breadcrumbs, Link as MuiLink, Pagination, Typography } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCity } from "@/api/cities";
import { AlertCard } from "@/components/alerts/AlertCard";
import { alertTimestamp } from "@/components/alerts/api";
import { AlertKindTabs, CardsSkeleton, DataError, NoAlerts, parseAlertKind, useCityAlerts } from "@/components/alerts/shared";
import { PageHeader, PageTemplate } from "@/components/PageHeader";

const PAGE_SIZE = 10;

export default function AlertsHistoryPage() {
    const { city = "", rodzaj, strona } = useParams();
    const kind = parseAlertKind(rodzaj);
    const page = Math.max(1, Number(strona) || 1);
    const cityInfo = useCity(city);
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { data, error, loading } = useCityAlerts(city);
    const cityName = cityInfo?.name ?? city;
    const agencyName = cityInfo?.agencies?.default?.name ?? cityName;

    // The backend keeps no alert archive: the history holds every alert it still publishes, newest first.
    const alerts = useMemo(
        () => (data?.alerts ?? []).filter((alert) => alert.kind === kind).sort((a, b) => alertTimestamp(b) - alertTimestamp(a)),
        [data, kind],
    );
    const pagesCount = Math.ceil(alerts.length / PAGE_SIZE);
    const pageAlerts = alerts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const pageTitle = `${cityName} - ${t("alerts.pageTitleHistory")}`;
    return (
        <>
            <PageHeader title={pageTitle} documentTitle={`${agencyName} - ${t("alerts.pageTitleHistory")}`} back={`/${city}/komunikaty/${kind}`} />
            <PageTemplate title={pageTitle} padding>
                <Box sx={{ pb: "80px" }}>
                    <Breadcrumbs aria-label="breadcrumb" sx={{ pb: "20px" }}>
                        <Typography variant="caption">
                            <MuiLink component={Link} color="primary" to={`/${city}/komunikaty`} underline="hover">
                                {cityName} {t("alerts.alerts")}
                            </MuiLink>
                        </Typography>
                        <Typography variant="caption" color="textPrimary">
                            {t("alerts.alertsHistory")}
                        </Typography>
                    </Breadcrumbs>
                    <AlertKindTabs value={kind} onChange={(next) => navigate(`/${city}/komunikaty/historia/${next}/1`)} />
                    <Box>
                        {error && !data ? (
                            <DataError error={error} />
                        ) : loading && !data ? (
                            <CardsSkeleton />
                        ) : (
                            <>
                                {pageAlerts.map((alert) => (
                                    <AlertCard key={alert.id} city={city} alert={alert} history fallbackPublished={data?.updatedAt} />
                                ))}
                                {pageAlerts.length === 0 && <NoAlerts subtitle={false} />}
                            </>
                        )}
                    </Box>
                    {pagesCount > 0 && (
                        <Box sx={{ m: 3, display: "flex", justifyContent: "center" }}>
                            <Pagination
                                count={pagesCount}
                                page={page}
                                color="primary"
                                onChange={(_, next) => navigate(`/${city}/komunikaty/historia/${kind}/${next}`)}
                            />
                        </Box>
                    )}
                </Box>
            </PageTemplate>
        </>
    );
}
