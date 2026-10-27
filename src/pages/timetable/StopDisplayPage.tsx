import AccessTimeIcon from "@mui/icons-material/AccessTime";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import GpsOffIcon from "@mui/icons-material/GpsOff";
import PanToolIcon from "@mui/icons-material/PanTool";
import { Box, Chip, Divider, List, ListItem, ListItemText, Typography, useTheme } from "@mui/material";
import { Fragment, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";
import { useCity } from "@/api/cities";
import { ALIGHT, EDeparture, ERouteTuple, EStopDepartureTuple, EStopTuple, ETripTuple } from "@/api/types";
import { hhmm, isLiveStatus } from "@/components/departures/departureUtils";
import { delayClassOf, MarqueeText } from "@/components/departures/parts";
import { useStopDepartures } from "@/components/departures/useStopDepartures";
import { DISPLAY_FONT, DisplayFooter, DisplayHeader, DisplayMessage, DisplayWarning, SIZE, useClock, useDisplayScheme } from "@/components/timetable/DisplayChrome";

export default function StopDisplayPage() {
    const { city = "" } = useParams();
    const [params] = useSearchParams();
    const stopId = params.get("przystanek") ?? "";
    const dataCity = params.get("miasto") || city;
    const { t } = useTranslation();
    const theme = useTheme();
    const scheme = useDisplayScheme(city);
    const timeZone = useCity(city)?.timezone;
    const now = useClock();
    const headerRef = useRef<HTMLDivElement | null>(null);
    const marqueeRef = useRef<HTMLElement | null>(null);
    const [headerHeight, setHeaderHeight] = useState(200);
    const { stop, departures, error } = useStopDepartures(dataCity, stopId, { limit: 10, enabled: !!stopId });
    const stopName = stop?.[EStopTuple.stopName] ?? "";

    useEffect(() => {
        document.title = stopName ? `${stopName} - Tablica odjazdów - Czynalive` : "Tablica odjazdów - Czynalive";
    }, [stopName]);

    useEffect(() => {
        const node = headerRef.current;
        if (!node) return;
        const measure = () => setHeaderHeight(node.offsetHeight);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, [stopName, !!departures]);

    if (!stopId) return <DisplayMessage lines={["Brak ID przystanku w parametrach URL", "Dodaj parametr ?przystanek=ID_PRZYSTANKU do adresu URL"]} />;
    if (!stop && !error) return <DisplayMessage loading lines={["Łączenie z serwerem...", "Oczekiwanie na dane przystanku"]} />;
    if (!stop) return <DisplayMessage severity="info" lines={["Przystanek nie znaleziony", `Przystanek o ID ${stopId} nie został znaleziony`]} />;
    if (!departures && !error) return <DisplayMessage loading lines={["Ładowanie rozkładu jazdy...", "Pobieranie informacji o odjazdach"]} />;

    const header = (withTime: boolean) => (
        <DisplayHeader ref={headerRef} scheme={scheme} now={now} timeZone={timeZone} withTime={withTime}>
            {stopName && (
                <Box sx={{ maxWidth: "100%", overflow: "hidden", minWidth: "300px", flex: 1, color: scheme.headerText }}>
                    <MarqueeText
                        ref={marqueeRef}
                        text={<span style={{ fontSize: SIZE.displayLg, fontFamily: DISPLAY_FONT, fontWeight: "900", color: scheme.headerText }}>{stopName}</span>}
                        sectionWidth={window.innerWidth}
                        variant="h2"
                    />
                </Box>
            )}
        </DisplayHeader>
    );

    if (!departures) return <DisplayWarning header={header(false)} text="Nie udało się pobrać danych o rozkładzie jazdy" />;

    const nowMs = now.getTime();
    const upcoming = departures
        .map((departure) => {
            const info = departure[EStopDepartureTuple.departure];
            const hasGps = !!departure[EStopDepartureTuple.vehicle] && isLiveStatus(info[EDeparture.status]);
            const delay = hasGps ? Math.round(info[EDeparture.delay] / 60000) : 0;
            const expected = info[EDeparture.scheduledDeparture] + delay * 60000;
            return { departure, info, hasGps, delay, expected, minutes: Math.round((expected - nowMs) / 60000) };
        })
        .filter((entry) => entry.minutes >= 0)
        .sort((a, b) => a.minutes - b.minutes)
        .slice(0, 15);

    return (
        <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "background.default", overflow: "hidden" }}>
            {header(true)}
            <Box sx={{ position: "fixed", top: 0, bottom: "80px", left: 0, right: 0, overflow: "auto", paddingLeft: 2, paddingRight: 1, marginTop: `${headerHeight}px` }}>
                <List sx={{ padding: 1 }}>
                    {upcoming.map(({ departure, info, hasGps, delay, expected, minutes }, index) => {
                        const trip = departure[EStopDepartureTuple.trip];
                        const route = trip[ETripTuple.route];
                        const onDemand = (info[EDeparture.alight] & ALIGHT.OnDemand) !== 0;
                        const delayed = delay !== 0;
                        const chipClass = delayed ? `bg-${delayClassOf(delay)} text-white` : "";
                        return (
                            <Fragment key={`${trip[ETripTuple.tripId]}-${info[EDeparture.scheduledDeparture]}`}>
                                <ListItem disablePadding sx={{ position: "relative", borderRadius: 2, backgroundColor: "background.paper", paddingLeft: 3, paddingRight: 2, transition: "all 0.3s ease" }}>
                                    <ListItemText
                                        
                                        primary={
                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                                                <Box sx={{ flex: 1 }}>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                                                        <Box
                                                            sx={{
                                                                backgroundColor: scheme.headerBackground,
                                                                color: scheme.headerText,
                                                                padding: "8px 16px",
                                                                borderRadius: "6px",
                                                                minWidth: "60px",
                                                                textAlign: "center",
                                                                border: `2px solid ${scheme.headerBackground}`,
                                                            }}
                                                        >
                                                            <Typography variant="h2" sx={{ fontWeight: "900", fontSize: `${SIZE.displayMd} !important`, fontFamily: DISPLAY_FONT, lineHeight: 1 }}>
                                                                {route[ERouteTuple.routeName]}
                                                            </Typography>
                                                        </Box>
                                                        <Typography
                                                            variant="h4"
                                                            sx={{
                                                                fontWeight: "800",
                                                                fontSize: `${SIZE.displayMd} !important`,
                                                                color: scheme.text,
                                                                lineHeight: 1.3,
                                                                flex: 1,
                                                                wordBreak: "break-word",
                                                                overflowWrap: "break-word",
                                                                fontFamily: DISPLAY_FONT,
                                                            }}
                                                        >
                                                            {onDemand ? (
                                                                <>
                                                                    <PanToolIcon sx={{ fontSize: SIZE.h3, mr: 1, verticalAlign: "middle", color: "inherit" }} />
                                                                    {trip[ETripTuple.headsign]} - {t(city === "wroclaw" ? "global.onWish" : "global.onDemand")}
                                                                </>
                                                            ) : (
                                                                trip[ETripTuple.headsign]
                                                            )}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, flexShrink: 0, minWidth: "fit-content" }}>
                                                    <Typography variant="body1" sx={{ lineHeight: 1, fontSize: SIZE.displayMd, fontWeight: "700", color: scheme.text, fontFamily: DISPLAY_FONT }}>
                                                        {minutes === 0 ? "Teraz" : `${minutes} min`}
                                                    </Typography>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                        <Chip size="medium" label={hhmm(expected, timeZone)} sx={{ fontSize: SIZE.h3, height: "50px", fontWeight: "900", fontFamily: DISPLAY_FONT }} className={chipClass} />
                                                        {hasGps ? (
                                                            <GpsFixedIcon sx={{ fontSize: SIZE.h2, opacity: 0.8 }} className="text-success" />
                                                        ) : delayed ? (
                                                            <AccessTimeIcon sx={{ fontSize: SIZE.h2, opacity: 0.6 }} className="text-success" />
                                                        ) : (
                                                            <GpsOffIcon sx={{ fontSize: SIZE.h2, color: "text.disabled", opacity: 0.4 }} />
                                                        )}
                                                    </Box>
                                                </Box>
                                            </Box>
                                        }
                                    />
                                </ListItem>
                                {index < upcoming.length - 1 && (
                                    <Divider sx={{ my: 1, mx: 2, borderColor: theme.palette.mode === "dark" ? "grey.400" : "grey.600", borderWidth: "2px", opacity: 1 }} />
                                )}
                            </Fragment>
                        );
                    })}
                    {upcoming.length === 0 && (
                        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px" }}>
                            <Typography variant="h4" sx={{ fontFamily: DISPLAY_FONT, fontWeight: "800", fontSize: SIZE.h1, color: "text.secondary" }}>
                                Brak nadchodzących odjazdów
                            </Typography>
                        </Box>
                    )}
                </List>
            </Box>
            <DisplayFooter />
        </Box>
    );
}
