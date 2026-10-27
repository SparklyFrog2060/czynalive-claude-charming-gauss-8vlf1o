import { Box, Card, CardHeader, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ERouteTuple } from "@/api/types";
import { useFavourites } from "@/store/favourites";
import { fromNow, type CityAlert } from "./api";
import { RouteChips } from "./RouteChips";

export const useAffectsFavourite = (city: string, alert: CityAlert | undefined) => {
    const { favourites } = useFavourites(city);
    if (!alert || alert.routes.length === 0) return false;
    const ids = new Set(alert.routes.map((route) => route[ERouteTuple.routeId]));
    return favourites.routes.some((route) => ids.has(route.id));
};

export const AffectedFavouriteLine = () => {
    const { t } = useTranslation();
    return (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography variant="caption" className="text-primary" sx={{ fontStyle: "italic", p: "5px", fontWeight: 500 }}>
                {t("alerts.affectedFavouriteLine")}
            </Typography>
        </Box>
    );
};

export const AlertCard = ({ city, alert, history, fallbackPublished }: { city: string; alert: CityAlert; history?: boolean; fallbackPublished?: number }) => {
    const { t } = useTranslation();
    const favourite = useAffectsFavourite(city, alert);
    const published = alert.publishedAt ?? alert.activeFrom ?? fallbackPublished ?? null;

    return (
        <Card variant="outlined" className={favourite ? "border-primary" : ""} style={{ marginTop: 10, borderRadius: 8 }}>
            <Link
                to={`/${city}/komunikaty/komunikat?id=${encodeURIComponent(alert.id)}`}
                state={{ alertId: alert.id, fromHistory: history }}
                style={{
                    textDecoration: "initial",
                    color: "var(--default-text)",
                    display: "block",
                }}
            >
                {favourite && <AffectedFavouriteLine />}
                <CardHeader
                    style={{ paddingTop: favourite ? 0 : undefined }}
                    disableTypography
                    title={
                        <Typography variant="h5" style={{ wordBreak: "break-word" }}>
                            {alert.title}
                        </Typography>
                    }
                    subheader={
                        <Box sx={{ display: "flex", flexDirection: "column" }}>
                            {published !== null && (
                                <Typography variant="caption">
                                    {t("global.published")}: <u>{fromNow(published)}</u>
                                </Typography>
                            )}
                            {(alert.activeFrom !== null || alert.activeUntil !== null) && (
                                <Typography variant="caption">
                                    <strong>{t("alerts.valid")}:</strong>
                                    {alert.activeFrom !== null && (
                                        <>
                                            {" "}
                                            {t("global.from").toLowerCase()} <u>{fromNow(alert.activeFrom)}</u>
                                        </>
                                    )}
                                    {alert.activeUntil !== null && (
                                        <>
                                            {" "}
                                            {t("global.to").toLowerCase()} <u>{fromNow(alert.activeUntil)}</u>
                                        </>
                                    )}
                                </Typography>
                            )}
                            {alert.detected && (
                                <Typography variant="caption" sx={{ fontStyle: "italic" }}>
                                    Utrudnienie wykryte automatycznie na podstawie pozycji pojazdów
                                </Typography>
                            )}
                            <RouteChips routes={alert.routes} mode="preview" />
                        </Box>
                    }
                />
            </Link>
        </Card>
    );
};
