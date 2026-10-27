import AddToHomeScreenIcon from "@mui/icons-material/AddToHomeScreen";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import DevicesIcon from "@mui/icons-material/Devices";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import HttpsIcon from "@mui/icons-material/Https";
import MapIcon from "@mui/icons-material/Map";
import MoneyOffIcon from "@mui/icons-material/MoneyOff";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import SpeedIcon from "@mui/icons-material/Speed";
import StorefrontIcon from "@mui/icons-material/Storefront";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import { Alert, Box, Button, Divider, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, type SvgIconProps } from "@mui/material";
import { useState, type ComponentType, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useCities } from "@/api/cities";
import { isIos, useInstallPrompt } from "./install";

const IS_MOBILE = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);
const LEAD = { fontSize: "1.25rem", fontWeight: 600 };

const BENEFITS: { icon: ComponentType<SvgIconProps>; title: string; body: string }[] = [
    { icon: AddToHomeScreenIcon, title: "Zawsze pod ręką", body: "Ikona na pulpicie obok innych aplikacji" },
    { icon: FullscreenIcon, title: "Większa mapa", body: "Wygodny pełny ekran bez pasków przeglądarki" },
    { icon: SystemUpdateIcon, title: "Zawsze aktualna", body: "Nowe rozkłady i linie od razu, bez pobierania" },
    { icon: StorefrontIcon, title: "Bez sklepów i kont", body: "Działa także na Huawei i bez logowania" },
    { icon: PhoneIphoneIcon, title: "Oszczędność pamięci", body: "Zajmuje ułamek miejsca tradycyjnej aplikacji" },
    { icon: HttpsIcon, title: "Bezpieczna i prywatna", body: "Szyfrowane HTTPS, bez wglądu w Twoje pliki" },
    { icon: DevicesIcon, title: "Na każdy sprzęt", body: "Działa na Androidzie, iPhonie i komputerze" },
    { icon: SpeedIcon, title: "Błyskawiczny start", body: "Uruchamia się od razu po kliknięciu ikony" },
    { icon: MapIcon, title: "GPS i trasy na żywo", body: "Pozycje pojazdów, opóźnienia i przystanki live" },
    { icon: MoneyOffIcon, title: "Całkowicie bezpłatna", body: "100% darmowy dostęp bez ukrytych opłat" },
];

const Yes = () => <CheckCircleIcon fontSize="small" sx={{ color: "var(--success)", verticalAlign: "middle" }} aria-label="tak" />;
const No = () => <CloseIcon fontSize="small" sx={{ color: "text.secondary", verticalAlign: "middle" }} aria-label="nie" />;

const COMPARISON: [string, ReactNode, ReactNode, ReactNode][] = [
    ["Ikona na pulpicie", <No key="b" />, <Yes key="p" />, <Yes key="s" />],
    ["Pełny ekran", <No key="b" />, <Yes key="p" />, <Yes key="s" />],
    ["Aktualizacje od razu", "Odśwież", <Yes key="p" />, "Czekasz"],
    ["Bez konta w sklepie", <Yes key="b" />, <Yes key="p" />, <No key="s" />],
    ["Huawei bez Google", <Yes key="b" />, <Yes key="p" />, <No key="s" />],
];

const CELL = { py: 0.6, px: 0.75, fontSize: "0.625rem", lineHeight: 1.3 };

const INSTRUCTIONS: { id: string; title: string; steps: ReactNode[] }[] = [
    {
        id: "install-ios",
        title: "Instalacja — iOS (iPhone)",
        steps: ["Otwórz tę stronę w Safari.", "Stuknij przycisk „Udostępnij” (kwadrat ze strzałką).", "Wybierz „Do ekranu początkowego”.", "Potwierdź przyciskiem „Dodaj”."],
    },
    {
        id: "install-android-chrome",
        title: "Instalacja — Android Chrome",
        steps: ["Otwórz tę stronę w przeglądarce Chrome.", "Stuknij menu ⋮ w prawym górnym rogu.", "Wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”.", "Potwierdź przyciskiem „Zainstaluj”."],
    },
    {
        id: "install-windows",
        title: "Instalacja — komputer",
        steps: ["Otwórz tę stronę w Chrome lub Edge.", "Kliknij ikonę instalacji na końcu paska adresu.", "Potwierdź przyciskiem „Zainstaluj”."],
    },
];

const instructionAnchor = () => (isIos() ? "#install-ios" : IS_MOBILE ? "#install-android-chrome" : "#install-windows");

const InstallCta = () => {
    const { t } = useTranslation();
    const { canPrompt, installed, install } = useInstallPrompt();
    const [busy, setBusy] = useState(false);
    const canInstall = IS_MOBILE && !isIos() && canPrompt;

    if (installed) {
        return (
            <Alert severity="success" sx={{ py: 0.5, borderRadius: "8px" }}>
                Aplikacja jest już zainstalowana na tym urządzeniu.
            </Alert>
        );
    }
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {canInstall ? (
                <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    size="medium"
                    startIcon={<AddToHomeScreenIcon />}
                    disabled={busy}
                    onClick={async () => {
                        setBusy(true);
                        await install();
                        setBusy(false);
                    }}
                >
                    {busy ? `${t("global.pleaseWait")}...` : t("settings.install")}
                </Button>
            ) : (
                <Button variant="contained" color="primary" fullWidth size="medium" startIcon={<AddToHomeScreenIcon />} href={instructionAnchor()}>
                    Jak zainstalować
                </Button>
            )}
            <Typography variant="caption" color="text.secondary">
                {isIos() ? (
                    <>
                        Na iPhonie otwórz stronę w <strong>Safari</strong>, a następnie wybierz Udostępnij → Do ekranu początkowego. <a href="#install-ios">Instrukcja krok po kroku</a>.
                    </>
                ) : IS_MOBILE ? (
                    canInstall ? (
                        <>
                            Kliknij powyżej lub <a href={instructionAnchor()}>zobacz instrukcję</a>.
                        </>
                    ) : (
                        <>
                            W menu przeglądarki wybierz: <strong>Zainstaluj aplikację</strong> lub <strong>Dodaj do ekranu głównego</strong>.
                        </>
                    )
                ) : (
                    <>
                        Chrome / Edge: ikona instalacji w pasku adresu po prawej. <a href="#install-windows">Instrukcja na komputer</a>.
                    </>
                )}
            </Typography>
        </Box>
    );
};

export const InstallSection = () => {
    const { cities } = useCities();
    const cityCount = cities.filter((city) => city.category !== "virtual").length;

    return (
        <article>
            <section id="zainstaluj-teraz" style={{ scrollMarginTop: 60 }}>
                <Typography variant="h1" sx={{ fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.25, mb: 0.75 }}>
                    Aplikacja Czynalive — zainstaluj na telefonie i komputerze
                </Typography>
                <Typography variant="body2" sx={{ mb: 1.25, color: "text.secondary", lineHeight: 1.4 }}>
                    Śledź autobusy i tramwaje na żywo na pełnym ekranie telefonu. Bez pobierania ze sklepów Google Play i App Store, bez zbędnych kont i opłat. Dostęp do mapy GPS w {cityCount}{" "}
                    miastach — na Androidzie, iPhonie i komputerze.
                </Typography>
                <InstallCta />
            </section>
            <Divider sx={{ my: 1.5 }} />
            <section id="dlaczego-pwa" style={{ scrollMarginTop: 60 }}>
                <Typography variant="h2" sx={{ ...LEAD, mb: 1 }}>
                    Dlaczego warto zainstalować Czynalive?
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                    {BENEFITS.map(({ icon: Icon, title, body }) => (
                        <Box key={title} sx={{ display: "flex", gap: 0.75, p: 1, borderRadius: "8px", bgcolor: "action.hover", minWidth: 0 }}>
                            <Icon sx={{ color: "var(--primary)", fontSize: "1.15rem", mt: "1px", flexShrink: 0 }} aria-hidden />
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.25 }}>{title}</Typography>
                                <Typography sx={{ fontSize: "0.625rem", color: "text.secondary", lineHeight: 1.3 }}>{body}</Typography>
                            </Box>
                        </Box>
                    ))}
                </Box>
            </section>
            <Divider sx={{ my: 1.5 }} />
            <section id="pwa-porownanie" style={{ scrollMarginTop: 60 }}>
                <Typography variant="h2" sx={{ ...LEAD, mb: 0.75 }}>
                    Przeglądarka, PWA, sklep
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "8px", overflowX: "auto" }}>
                    <Table size="small" padding="none" aria-label="Porównanie przeglądarki, PWA i sklepu">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={CELL} />
                                <TableCell sx={CELL}>Przeglądarka</TableCell>
                                <TableCell sx={{ ...CELL, fontWeight: 700, color: "var(--primary)", bgcolor: "action.hover" }}>PWA</TableCell>
                                <TableCell sx={CELL}>Sklep</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {COMPARISON.map(([label, browser, pwa, store]) => (
                                <TableRow key={label}>
                                    <TableCell component="th" scope="row" sx={{ ...CELL, fontWeight: 600 }}>
                                        {label}
                                    </TableCell>
                                    <TableCell sx={CELL}>{browser}</TableCell>
                                    <TableCell sx={{ ...CELL, bgcolor: "action.hover" }}>{pwa}</TableCell>
                                    <TableCell sx={CELL}>{store}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </section>
            <Divider sx={{ my: 1.5 }} />
            <section id="one-app" style={{ scrollMarginTop: 60 }}>
                <Typography variant="h2" sx={LEAD} gutterBottom>
                    Jedna aplikacja na wszystkie systemy
                </Typography>
                <Typography variant="body2" gutterBottom>
                    Czynalive to <strong>Progressive Web App</strong> (PWA): jedna wspólna, lekka aplikacja łącząca mapy GPS i rozkłady jazdy w {cityCount} miastach i aglomeracjach. Aplikacja
                    działa identycznie na telefonach z Androidem, iPhone'ach (iOS) oraz na komputerach (Windows, macOS, Linux).
                </Typography>
            </section>
            {INSTRUCTIONS.map(({ id, title, steps }) => (
                <section key={id} id={id} style={{ scrollMarginTop: 60 }}>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="h2" sx={LEAD} gutterBottom>
                        {title}
                    </Typography>
                    <ol style={{ margin: 0, paddingLeft: 20 }}>
                        {steps.map((step, index) => (
                            <li key={index}>
                                <Typography variant="body2" gutterBottom>
                                    {step}
                                </Typography>
                            </li>
                        ))}
                    </ol>
                </section>
            ))}
        </article>
    );
};
