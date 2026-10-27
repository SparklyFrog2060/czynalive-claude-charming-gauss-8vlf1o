import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import {
    Alert,
    AlertTitle,
    Box,
    Button,
    Divider,
    FormControlLabel,
    FormGroup,
    IconButton,
    List,
    ListItemButton,
    ListItemSecondaryAction,
    ListItemText,
    Switch,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import { Fragment, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { RouteType, StopDepartureStatus, type RouteTuple, type StopDepartureTuple } from "@/api/types";
import { DepartureRow } from "@/components/departures/DepartureRow";
import { useSettings } from "@/store/settings";

export const APP_VERSION = "0.1.0";

export const rebrand = (text: string) => text.replace(/Czynaczas\.pl/gi, "Czynalive");

export const AppLogo = ({ size = 68 }: { size?: number }) => (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
        <img src="/favicon.svg" alt="" width={size} height={size} />
        <Typography sx={{ fontSize: size * 0.42, fontWeight: 800, color: "var(--primary)", letterSpacing: "-0.5px" }}>Czynalive</Typography>
    </Box>
);

export const ThemeSection = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useSettings();
    return (
        <div style={{ marginBottom: 70 }}>
            <Typography variant="h4" gutterBottom>
                {t("settings.darkModeHeader")}
            </Typography>
            <Typography variant="h5" gutterBottom>
                {rebrand(t("settings.darkModeSubheader"))}:
            </Typography>
            <Box sx={{ margin: 2 }}>
                <ToggleButtonGroup
                    color="primary"
                    value={settings.theme === "system" ? null : settings.theme}
                    exclusive
                    fullWidth
                    onChange={(_, value) => value && setSettings({ theme: value })}
                    aria-label={t("settings.darkModeTheme")}
                >
                    <ToggleButton value="light">
                        <LightModeIcon /> {t("settings.darkModeLight")}
                    </ToggleButton>
                    <ToggleButton value="dark">
                        <DarkModeIcon /> {t("settings.darkModeDark")}
                    </ToggleButton>
                </ToggleButtonGroup>
            </Box>
            <Box sx={{ margin: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", my: 8 }}>
                    <AppLogo size={96} />
                </Box>
            </Box>
        </div>
    );
};

export const LanguageSection = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useSettings();
    return (
        <div style={{ marginBottom: 70 }}>
            <Typography variant="h4" gutterBottom>
                {t("changeLanguage.chooseLanguage")}:
            </Typography>
            <Box sx={{ margin: 2 }}>
                <ToggleButtonGroup
                    color="primary"
                    value={settings.language}
                    exclusive
                    fullWidth
                    onChange={(_, value) => value && setSettings({ language: value })}
                    aria-label={t("changeLanguage.language")}
                >
                    <ToggleButton value="pl">{t("changeLanguage.polish")}</ToggleButton>
                    <ToggleButton value="en">{t("changeLanguage.english")}</ToggleButton>
                </ToggleButtonGroup>
            </Box>
        </div>
    );
};

export const DeparturesSection = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useSettings();
    const now = Date.now();
    const route: RouteTuple = ["2", settings.city ?? "warsaw", "2", "", "", RouteType.Bus, ""];
    const preview: StopDepartureTuple = [
        ["preview", settings.city ?? "warsaw", route, "Zajezdnia Czynalive", "04", "", []],
        ["3/4417", settings.city ?? "warsaw", route, "5", [21.0568989, 52.3019024], -75],
        [now, 180000, StopDepartureStatus.OnTrip, "", 1],
    ];
    return (
        <div style={{ marginBottom: 70 }}>
            <Typography variant="h3" gutterBottom>
                {t("settings.timetableSettings")}
            </Typography>
            <Typography variant="body1" gutterBottom>
                <strong>{t("settings.timetablePart1")}</strong>
            </Typography>
            <Divider style={{ margin: "20px 0" }} />
            <FormGroup>
                <Typography variant="h4">{t("settings.showBrigade")}</Typography>
                <Typography variant="body2">
                    <em>
                        <Trans i18nKey="settings.brigadeDescription" components={[<strong key="1" />]} />
                    </em>
                </Typography>
                <FormControlLabel
                    control={<Switch checked={settings.departuresShowBrigade} onChange={() => setSettings({ departuresShowBrigade: !settings.departuresShowBrigade })} color="primary" />}
                    label={t("settings.timetableShowBrigadeLabel")}
                />
            </FormGroup>
            <Divider style={{ margin: "20px 0" }} />
            <FormGroup>
                <Typography variant="h4">{t("settings.showVehicleNo")}</Typography>
                <Typography variant="body2">
                    <em>
                        <Trans i18nKey="settings.vehicleNoDescription" components={[<strong key="1" />]} />
                    </em>
                </Typography>
                <FormControlLabel
                    control={<Switch checked={settings.departuresShowVehicleNo} onChange={() => setSettings({ departuresShowVehicleNo: !settings.departuresShowVehicleNo })} color="primary" />}
                    label={t("settings.timetableShowVehicleNoLabel")}
                />
            </FormGroup>
            <Divider style={{ margin: "20px 0" }} />
            <Typography variant="h4">{t("global.preview")}:</Typography>
            <DepartureRow
                city={settings.city ?? "warsaw"}
                departure={preview}
                now={now}
                showBrigade={settings.departuresShowBrigade}
                showVehicleNo={settings.departuresShowVehicleNo}
                onSelect={() => {}}
            />
        </div>
    );
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const UpdateSection = () => {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<"none" | "updated" | null>(null);

    const check = async () => {
        setBusy(true);
        setResult(null);
        let changed = false;
        try {
            if ("serviceWorker" in navigator) {
                for (const registration of await navigator.serviceWorker.getRegistrations()) {
                    await registration.update().catch(() => {});
                    if (registration.waiting) {
                        registration.waiting.postMessage({ type: "SKIP_WAITING" });
                        changed = true;
                    }
                }
            }
            const response = await fetch(`/index.html?check=${Date.now()}`, { cache: "no-store" });
            const html = await response.text();
            const current = [...document.querySelectorAll<HTMLScriptElement>("script[type=module][src]")].map((script) => script.getAttribute("src"));
            if (current.some((src) => src && !html.includes(src))) changed = true;
            await sleep(1200);
        } catch {}
        setBusy(false);
        setResult(changed ? "updated" : "none");
        if (changed) setTimeout(() => window.location.reload(), 2500);
    };

    return (
        <div style={{ width: "95%", paddingTop: "20px", textAlign: "justify" }}>
            <Typography variant="h2" gutterBottom>
                {t("settings.checkUpdate")}
            </Typography>
            <Divider style={{ margin: "10px 0" }} />
            <Typography variant="body1" gutterBottom>
                {t("settings.updatePart2")}
            </Typography>
            <Button variant="contained" fullWidth onClick={check} disabled={busy}>
                {busy ? `${t("global.pleaseWait")}...` : t("settings.checkUpdate")}
            </Button>
            <Divider style={{ margin: "10px 0" }} />
            <Typography variant="h5" gutterBottom>
                <strong>{t("settings.updatePart3")}:</strong>
            </Typography>
            <div style={{ display: "grid", placeItems: "center" }}>
                <AppLogo size={68} />
            </div>
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                <Typography variant="h5" gutterBottom>
                    v{APP_VERSION}
                </Typography>
            </Box>
            {result === "none" && (
                <Alert severity="info" style={{ marginTop: 5 }}>
                    <AlertTitle>{t("settings.updatePart4")}</AlertTitle>
                    {rebrand(t("settings.updatePart5"))}
                </Alert>
            )}
            {result === "updated" && (
                <Alert severity="success" style={{ marginTop: 5 }}>
                    <AlertTitle>{t("settings.updatePart6")}</AlertTitle>
                    Pobrano nową wersję aplikacji — strona zostanie odświeżona.
                </Alert>
            )}
        </div>
    );
};

const BUSWIFI_CITIES = [
    { city: "kielce", name: "Kielce", vehicles: 53 },
    { city: "gzm", name: "GOP", vehicles: 35 },
    { city: "poznan", name: "Poznań", vehicles: 55 },
    { city: "wroclaw", name: "Wrocław", vehicles: 89 },
];

export const BusWifiSection = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    return (
        <Box sx={{ display: "flex", justifyContent: "space-between", flexDirection: "column" }}>
            <List component="nav" dense>
                {BUSWIFI_CITIES.map(({ city, name, vehicles }) => (
                    <Fragment key={city}>
                        <ListItemButton onClick={() => navigate(`/${city}`)}>
                            <ListItemText primary={name} secondary={`${t("settings.busWifiSupportedVehicles")} ${t("plural.vehicle", { count: vehicles })}`} />
                            <ListItemSecondaryAction>
                                <IconButton edge="end" aria-label="navigate" size="small">
                                    <ChevronRightIcon />
                                </IconButton>
                            </ListItemSecondaryAction>
                        </ListItemButton>
                        <Divider />
                    </Fragment>
                ))}
            </List>
        </Box>
    );
};
