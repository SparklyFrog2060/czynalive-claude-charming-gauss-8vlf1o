import NoCrashIcon from "@mui/icons-material/NoCrash";
import { Badge, Skeleton, Tab, Tabs, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useApi } from "@/api/useApi";
import { ALERT_KIND_LABEL, ALERT_KINDS, fetchCityAlerts, isMissingEndpoint, type AlertKind } from "./api";

export const useCityAlerts = (city: string) => useApi((signal) => fetchCityAlerts(city, signal), [city], 60_000);

export const parseAlertKind = (value: string | undefined): AlertKind => (value === "IMPEDIMENT" ? "IMPEDIMENT" : "CHANGE");

export const AlertKindTabs = ({ value, onChange, counts }: { value: AlertKind; onChange: (kind: AlertKind) => void; counts?: Record<AlertKind, number> }) => {
    const { t } = useTranslation();
    return (
        <Tabs value={value} onChange={(_, kind) => kind !== value && onChange(kind)} indicatorColor="primary" textColor="primary" variant="fullWidth" centered>
            {ALERT_KINDS.map((kind) => (
                <Tab
                    key={kind}
                    value={kind}
                    label={
                        counts ? (
                            <Badge anchorOrigin={{ vertical: "top", horizontal: "right" }} color="primary" badgeContent={counts[kind]}>
                                {t(ALERT_KIND_LABEL[kind])}
                            </Badge>
                        ) : (
                            t(ALERT_KIND_LABEL[kind])
                        )
                    }
                />
            ))}
        </Tabs>
    );
};

export const NoAlerts = ({ subtitle = true }: { subtitle?: boolean }) => {
    const { t } = useTranslation();
    return (
        <div
            style={{
                display: "flex",
                placeItems: "center",
                flexDirection: "column",
                textAlign: "center",
                margin: 20,
            }}
        >
            <NoCrashIcon color="primary" fontSize="large" />
            <Typography variant="subtitle1" sx={{ p: subtitle ? "20px 0 0" : "20px 0", fontStyle: "italic" }}>
                {t("alerts.noAlerts")}
            </Typography>
            {subtitle && (
                <Typography variant="subtitle1" sx={{ fontStyle: "italic" }}>
                    {t("alerts.noAlertsSubtitle")} 👍
                </Typography>
            )}
        </div>
    );
};

export const CardsSkeleton = ({ count = 3 }: { count?: number }) => (
    <div style={{ margin: 10 }}>
        {Array.from({ length: count }, (_, i) => (
            <Skeleton key={i} animation="wave" variant="text" height={100} width="100%" style={{ marginBottom: 5 }} />
        ))}
    </div>
);

// Shown when the backend has no cnc endpoints yet (production before deploy) or the request failed.
export const DataError = ({ error }: { error: Error }) => {
    const { t } = useTranslation();
    return (
        <Typography variant="body1" sx={{ my: 2 }}>
            {isMissingEndpoint(error) ? t("global.noData") : t("global.error")}
        </Typography>
    );
};
