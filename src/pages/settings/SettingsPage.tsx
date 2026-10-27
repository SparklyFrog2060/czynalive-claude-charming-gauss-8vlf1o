import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AddToHomeScreenIcon from "@mui/icons-material/AddToHomeScreen";
import { Box, Divider, Link as MuiLink, Typography } from "@mui/material";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useCity } from "@/api/cities";
import { PageHeader, PageTemplate } from "@/components/PageHeader";
import { useInstallPrompt } from "@/components/settings/install";
import { MenuGrid } from "@/components/settings/MenuGrid";
import { settingsMenu } from "@/lib/navigation";
import { useSettings } from "@/store/settings";

const IS_MOBILE = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);

const InstallBanner = () => {
    const { installed } = useInstallPrompt();
    if (!IS_MOBILE || installed) return null;
    return (
        <Box
            component={Link}
            to="/ustawienia/instalacja"
            sx={{
                mt: 1,
                mb: 0.5,
                px: 1.25,
                py: 0.75,
                display: { xs: "flex", md: "none" },
                alignItems: "center",
                gap: 1,
                textDecoration: "none",
                color: "inherit",
                border: "1px solid var(--primary)",
                borderRadius: "8px",
            }}
        >
            <AddToHomeScreenIcon sx={{ color: "var(--primary)", fontSize: "1.35rem" }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.2 }}>Zainstaluj jak aplikację</Typography>
                <Typography sx={{ fontSize: "0.625rem", color: "text.secondary", lineHeight: 1.2 }}>Ikona na pulpicie, bez sklepu</Typography>
            </Box>
            <ChevronRightIcon sx={{ color: "text.secondary" }} />
        </Box>
    );
};

export default function SettingsPage() {
    const { t } = useTranslation();
    const [settings] = useSettings();
    const city = useCity(settings.city ?? undefined);
    const cityId = settings.city ?? "";

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <PageTemplate padding>
            <PageHeader documentTitle={`${t("settings.pageTitle")} - Czynalive`} />
            <div style={{ width: "95%", marginLeft: "auto", marginRight: "auto" }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="h4">{t("settings.pageTitle")}</Typography>
                </Box>
                <InstallBanner />
                {cityId && (
                    <>
                        <Typography variant="h6">
                            {city?.name ?? cityId} - {t("settings.pageShortTitle")}
                        </Typography>
                        <Divider />
                        <MenuGrid items={settingsMenu("city")} city={cityId} />
                    </>
                )}
                <Typography variant="h6">{t("settings.userPreferences")}</Typography>
                <Divider />
                <MenuGrid items={settingsMenu("preferences")} city={cityId} />
                <Typography variant="h6">Czynalive - {t("settings.app")}</Typography>
                <Divider />
                <MenuGrid items={settingsMenu("app")} city={cityId} />
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", mt: 2 }}>
                    <Typography variant="caption" sx={{ mb: 1 }}>
                        Dane:{" "}
                        <MuiLink href="https://zbiorkom.live" target="_blank" rel="noopener noreferrer">
                            zbiorkom.live
                        </MuiLink>
                    </Typography>
                    <MuiLink component={Link} to="/ustawienia/buswifi" variant="caption">
                        BusWiFi
                    </MuiLink>
                </Box>
            </div>
        </PageTemplate>
    );
}
