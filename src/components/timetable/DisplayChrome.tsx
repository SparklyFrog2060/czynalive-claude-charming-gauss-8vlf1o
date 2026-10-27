import { Alert, Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { forwardRef, useEffect, useState, type ReactNode } from "react";

export const DISPLAY_FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

export type DisplayScheme = { headerBackground: string; headerText: string; text: string; secondaryBackground: string; secondaryText: string };

const SCHEMES: Record<string, DisplayScheme> = {
    default: { headerBackground: "#29a847", headerText: "#FFF", text: "#000", secondaryBackground: "#38913E", secondaryText: "#FFF" },
    wroclaw: { headerBackground: "#2C578C", headerText: "#FFF", text: "#000", secondaryBackground: "#366db1", secondaryText: "#FFF" },
    gzm: { headerBackground: "#FCD900", headerText: "#000", text: "#000", secondaryBackground: "#424242", secondaryText: "#FFF" },
    poznan: { headerBackground: "#FFF", headerText: "#1A1A1A", text: "#1A1A1A", secondaryBackground: "#ffca22", secondaryText: "#1A1A1A" },
    kielce: { headerBackground: "#2C578C", headerText: "#FFF", text: "#000", secondaryBackground: "#366db1", secondaryText: "#FFF" },
};

export const useDisplayScheme = (city: string): DisplayScheme => {
    const theme = useTheme();
    const scheme = SCHEMES[city.toLowerCase()] ?? SCHEMES.default;
    return theme.palette.mode === "dark" ? { ...scheme, text: theme.palette.text.primary } : scheme;
};

// Board font sizes of the original (fixed, sized for a TV screen).
export const SIZE = {
    displayLg: "6rem",
    displayMd: "4rem",
    displaySm: "3.5rem",
    h1: "3rem",
    h2: "2.5rem",
    h3: "2rem",
    lead: "1.25rem",
};

export const useClock = (intervalMs = 1000) => {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(timer);
    }, [intervalMs]);
    return now;
};

export const formatBoardDate = (now: Date, timeZone = "Europe/Warsaw") => {
    const parts = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone }).format(now);
    const time = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(now);
    return `${parts.replace(" r.", "")} ${time}`;
};

export const DisplayFooter = () => (
    <Box
        sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            textAlign: "center",
            padding: 3,
            borderTop: "2px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            backgroundColor: "background.paper",
            zIndex: 1000,
            lineHeight: 1,
        }}
    >
        <picture style={{ display: "flex", alignItems: "center" }}>
            <img height="30" width="30" src="/favicon.svg" alt="Czynalive Logo" loading="lazy" />
        </picture>
        <Typography variant="h4" sx={{ fontWeight: "900", fontFamily: DISPLAY_FONT, fontSize: "1.8rem" }}>
            Napędzane przez Czynalive
        </Typography>
    </Box>
);

type HeaderProps = { scheme: DisplayScheme; withTime?: boolean; now: Date; timeZone?: string; children: ReactNode };

export const DisplayHeader = forwardRef<HTMLDivElement, HeaderProps>(({ scheme, withTime = true, now, timeZone = "Europe/Warsaw", children }, ref) => {
    const theme = useTheme();
    return (
        <Box
            ref={ref}
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1100,
                textAlign: "center",
                padding: 3,
                paddingBottom: withTime ? 1 : 3,
                backgroundColor: scheme.headerBackground,
                color: "primary.contrastText",
                boxShadow: withTime ? 0 : 4,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, flexWrap: "wrap" }}>{children}</Box>
            {withTime && (
                <Box
                    sx={{
                        mt: 2,
                        textAlign: "center",
                        backgroundColor: theme.palette.mode === "dark" ? "rgba(39, 39, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
                        padding: "8px 16px",
                        borderBottom: "2px solid",
                        borderColor: "divider",
                        marginLeft: -3,
                        marginRight: -3,
                        marginBottom: -1,
                    }}
                >
                    <Typography variant="h4" sx={{ fontWeight: "900", fontSize: SIZE.h3, fontFamily: DISPLAY_FONT, color: "var(--black)" }}>
                        {formatBoardDate(now, timeZone)}
                    </Typography>
                </Box>
            )}
        </Box>
    );
});
DisplayHeader.displayName = "DisplayHeader";

const FULL = { height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 3, backgroundColor: "background.default" } as const;

export const DisplayMessage = ({ severity, lines, loading, extra }: { severity?: "error" | "info" | "warning"; lines: string[]; loading?: boolean; extra?: ReactNode }) => (
    <Box sx={FULL}>
        {loading ? (
            <>
                <CircularProgress size={60} />
                <Typography variant="h5" sx={{ mt: 3, fontFamily: DISPLAY_FONT, fontWeight: "800", fontSize: SIZE.h1 }}>
                    {lines[0]}
                </Typography>
                <Typography variant="body1" color="textSecondary" sx={{ mt: 1, fontFamily: DISPLAY_FONT, fontWeight: "700", fontSize: SIZE.h1 }}>
                    {lines[1]}
                </Typography>
            </>
        ) : (
            <Alert severity={severity ?? "error"} sx={{ fontSize: SIZE.lead }} icon={false}>
                <Typography variant="h6" sx={{ fontSize: SIZE.h1, fontFamily: DISPLAY_FONT, fontWeight: "800" }}>
                    {lines[0]}
                </Typography>
                <Typography sx={{ fontSize: SIZE.h1, fontFamily: DISPLAY_FONT, fontWeight: "700" }}>{lines[1]}</Typography>
            </Alert>
        )}
        <DisplayFooter />
        {extra}
    </Box>
);

// Header-only board with a warning in the middle (data could not be loaded).
export const DisplayWarning = ({ header, text }: { header: ReactNode; text: string }) => (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", padding: 3, backgroundColor: "background.default", overflow: "hidden" }}>
        {header}
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, paddingTop: "200px" }}>
            <Alert severity="warning" sx={{ fontSize: SIZE.lead }} icon={false}>
                <Typography variant="h6" sx={{ fontFamily: DISPLAY_FONT, fontWeight: "800", fontSize: SIZE.h1 }}>
                    {text}
                </Typography>
            </Alert>
        </Box>
        <DisplayFooter />
    </Box>
);
