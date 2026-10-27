import { Box, Link as MuiLink, Skeleton, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useCity } from "@/api/cities";
import { AlertCard } from "@/components/alerts/AlertCard";
import { ALERT_KINDS, formatDateTime, fromNow, type AlertKind } from "@/components/alerts/api";
import { AlertKindTabs, DataError, NoAlerts, parseAlertKind, useCityAlerts } from "@/components/alerts/shared";
import { PageHeader, PageTemplate } from "@/components/PageHeader";

export default function AlertsPage() {
    const { city = "", rodzaj } = useParams();
    const cityInfo = useCity(city);
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const kind = parseAlertKind(rodzaj);
    const { data, error, loading } = useCityAlerts(city);
    const [, setTick] = useState(0);
    const focusRef = useRef<HTMLDivElement>(null);
    const focusId = (location.state as { alertId?: string } | null)?.alertId;

    useEffect(() => {
        if (rodzaj === undefined) navigate(`/${city}/komunikaty/CHANGE`, { replace: true });
    }, [rodzaj, city]);

    useEffect(() => {
        const timer = setInterval(() => setTick((value) => value + 1), 60_000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        focusRef.current?.scrollIntoView({ block: "center" });
    }, [!!data]);

    const counts = useMemo(() => {
        const result = Object.fromEntries(ALERT_KINDS.map((key) => [key, 0])) as Record<AlertKind, number>;
        for (const alert of data?.alerts ?? []) result[alert.kind]++;
        return result;
    }, [data]);

    const alerts = useMemo(() => (data?.alerts ?? []).filter((alert) => alert.kind === kind), [data, kind]);
    const agencyName = (cityInfo?.agencies?.default?.name as string | undefined) ?? cityInfo?.name ?? city;

    const pageTitle = `${cityInfo?.name ?? city} - ${t("alerts.pageTitleAlerts")}`;
    return (
        <>
            <PageHeader title={pageTitle} documentTitle={`${agencyName} - ${t("alerts.pageTitleAlerts")}`} />
            <PageTemplate title={pageTitle} padding>
                {error && !data ? (
                    <Box sx={{ pb: "80px" }}>
                        <DataError error={error} />
                    </Box>
                ) : loading && !data ? (
                    <>
                        <div
                            style={{
                                margin: 10,
                                display: "flex",
                                justifyContent: "space-between",
                            }}
                        >
                            <Skeleton animation="wave" variant="text" height={50} width="100%" style={{ margin: "0 5px 5px" }} />
                            <Skeleton animation="wave" variant="text" height={50} width="100%" style={{ margin: "0 5px 5px" }} />
                        </div>
                        <div style={{ margin: 10 }}>
                            {[0, 1, 2].map((i) => (
                                <Skeleton key={i} animation="wave" variant="text" height={100} width="100%" style={{ marginBottom: 5 }} />
                            ))}
                        </div>
                    </>
                ) : (
                    <Box sx={{ pb: "80px" }}>
                        <AlertKindTabs value={kind} counts={counts} onChange={(next) => navigate(`/${city}/komunikaty/${next}`)} />
                        <Box>
                            {alerts.map((alert) => (
                                <div key={alert.id} ref={alert.id === focusId ? focusRef : undefined}>
                                    <AlertCard city={city} alert={alert} fallbackPublished={data?.updatedAt} />
                                </div>
                            ))}
                            {alerts.length === 0 && <NoAlerts />}
                        </Box>
                        {data && (
                            <Typography variant="caption">
                                <strong>{t("alerts.lastUpdateDate")}: </strong>
                                <span>
                                    {fromNow(data.updatedAt)}, {formatDateTime(data.updatedAt, true)}
                                </span>
                            </Typography>
                        )}
                        <p>
                            <strong>
                                <MuiLink component={Link} to={`/${city}/komunikaty/historia/${kind}/1`} underline="hover">
                                    {t("alerts.alertsHistory")}
                                </MuiLink>
                            </strong>
                        </p>
                    </Box>
                )}
            </PageTemplate>
        </>
    );
}
