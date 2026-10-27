import PanToolIcon from "@mui/icons-material/PanTool";
import { Box, Chip, Divider, List, ListItem, ListItemText, Typography, useTheme } from "@mui/material";
import { Fragment, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";
import { useCity } from "@/api/cities";
import { apiUrl, cityGet } from "@/api/client";
import {
    ALIGHT,
    EItineraryStop,
    ERouteTuple,
    EStopTuple,
    ETripTuple,
    EVehiclePosition,
    type ItineraryTuple,
    type TripStopTime,
    type TripTuple,
    type VehiclePosition,
    type VehiclePositionDetailed,
} from "@/api/types";
import { hhmm, isLiveStatus } from "@/components/departures/departureUtils";
import { delayClassOf, MarqueeText } from "@/components/departures/parts";
import { DISPLAY_FONT, DisplayFooter, DisplayHeader, DisplayMessage, DisplayWarning, SIZE, useClock, useDisplayScheme } from "@/components/timetable/DisplayChrome";

const distanceMetres = (a: [number, number], b: [number, number]) => {
    const rad = Math.PI / 180;
    const x = (b[0] - a[0]) * rad * Math.cos(((a[1] + b[1]) / 2) * rad);
    const y = (b[1] - a[1]) * rad;
    return Math.sqrt(x * x + y * y) * 6371000;
};

type Initial = { trip: TripTuple; itinerary?: ItineraryTuple };
type Message = { position: VehiclePositionDetailed | VehiclePosition; stops?: TripStopTime[]; sequence?: number };
type LookupResponse = [position: VehiclePosition | null, headsign: string, model: string];

export default function VehicleDisplayPage() {
    const { city = "" } = useParams();
    const [params] = useSearchParams();
    const rawId = (params.get("pojazd") ?? "").replace(/^(\d+)\//, "$1:");
    const dataCity = params.get("miasto") || city;
    const { t } = useTranslation();
    const theme = useTheme();
    const scheme = useDisplayScheme(city);
    const timeZone = useCity(city)?.timezone;
    const now = useClock();
    const [vehicleId, setVehicleId] = useState<string | null | undefined>(rawId.includes(":") ? rawId : undefined);
    const [initial, setInitial] = useState<Initial>();
    const [message, setMessage] = useState<Message>();
    const [status, setStatus] = useState<"connecting" | "open" | "lost" | "notFound">("connecting");
    const listRef = useRef<HTMLDivElement>(null);
    const currentRef = useRef<HTMLLIElement | null>(null);

    useEffect(() => {
        if (!rawId || rawId.includes(":")) {
            setVehicleId(rawId || null);
            return;
        }
        const controller = new AbortController();
        cityGet<LookupResponse>(dataCity, `/positions/vehicle/${encodeURIComponent(rawId)}`, undefined, controller.signal)
            .then((response) => setVehicleId(response[0]?.[EVehiclePosition.id] ?? null))
            .catch(() => !controller.signal.aborted && setVehicleId(null));
        return () => controller.abort();
    }, [dataCity, rawId]);

    useEffect(() => {
        if (!vehicleId) return;
        setStatus("connecting");
        const source = new EventSource(apiUrl(`/${dataCity}/positions/${encodeURIComponent(vehicleId)}/stream`));
        source.addEventListener("initial", (event) => {
            try {
                setInitial(JSON.parse((event as MessageEvent).data));
            } catch {}
        });
        source.addEventListener("message", (event) => {
            try {
                setMessage(JSON.parse((event as MessageEvent).data));
                setStatus("open");
            } catch {}
        });
        source.addEventListener("errorCode", () => {
            source.close();
            setStatus("notFound");
        });
        source.onerror = () => setStatus((prev) => (prev === "open" ? "lost" : prev));
        return () => source.close();
    }, [dataCity, vehicleId]);

    const sequence = message?.sequence ?? null;
    useEffect(() => {
        const scroller = listRef.current;
        const element = currentRef.current;
        if (!scroller || !element) return;
        const top = element.offsetTop - scroller.clientHeight / 2 + element.offsetHeight / 2;
        scroller.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    }, [sequence, initial]);

    const trip = initial?.trip;
    const position = message?.position;
    const route = trip?.[ETripTuple.route] ?? position?.[EVehiclePosition.route];
    const routeName = route?.[ERouteTuple.routeName] ?? "";
    const headsign = trip?.[ETripTuple.headsign] ?? "";

    useEffect(() => {
        document.title = routeName ? `${routeName} ${headsign} - Tablica pojazdu - Czynalive` : "Tablica pojazdu - Czynalive";
    }, [routeName, headsign]);

    if (!rawId) return <DisplayMessage lines={["Brak ID pojazdu w parametrach URL", "Dodaj parametr ?pojazd=ID_POJAZDU do adresu URL"]} />;
    if (vehicleId === null || status === "notFound") return <DisplayMessage severity="info" lines={["Pojazd nie znaleziony", `Pojazd o ID ${rawId} nie został znaleziony lub nie przesyła sygnału GPS`]} />;
    if (!message) return <DisplayMessage loading lines={[status === "lost" ? "Ponowne łączenie..." : "Łączenie z serwerem...", "Oczekiwanie na dane pojazdów"]} />;

    const routeBox = (
        <Box
            sx={{
                backgroundColor: scheme.headerText,
                color: scheme.headerBackground,
                padding: "12px 20px",
                borderRadius: "8px",
                minWidth: "100px",
                textAlign: "center",
                border: `3px solid ${scheme.headerBackground}`,
            }}
        >
            <Typography variant="h1" component="h1" sx={{ color: scheme.headerBackground, fontWeight: "900", fontSize: `${SIZE.displayLg} !important`, fontFamily: DISPLAY_FONT, lineHeight: 1 }}>
                {routeName}
            </Typography>
        </Box>
    );
    const header = (withTime: boolean) => (
        <DisplayHeader scheme={scheme} now={now} timeZone={timeZone} withTime={withTime}>
            {routeBox}
            {headsign && (
                <Box sx={{ maxWidth: "80%", overflow: "hidden", minWidth: "300px", flex: 1, color: scheme.headerText }}>
                    <MarqueeText
                        text={<span style={{ fontSize: SIZE.displayLg, fontFamily: DISPLAY_FONT, fontWeight: "900", color: scheme.headerText }}>{headsign}</span>}
                        sectionWidth={window.innerWidth * 0.8}
                        variant="h2"
                    />
                </Box>
            )}
        </DisplayHeader>
    );

    const stops = initial?.itinerary?.[0] ?? [];
    const times = message.stops ?? [];
    if (!stops.length || !trip) return <DisplayWarning header={header(false)} text="Nie udało się pobrać danych o trasie pojazdu" />;

    const location = position?.[EVehiclePosition.location];
    const nextStop = sequence !== null ? stops[sequence]?.[EItineraryStop.stop] : undefined;
    const atStop = !!(location && nextStop && distanceMetres(location, nextStop[EStopTuple.location]) < 60);

    return (
        <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "background.default", overflow: "hidden" }}>
            {header(true)}
            <Box ref={listRef} sx={{ position: "fixed", top: 0, bottom: "80px", left: 0, right: 0, overflow: "auto", paddingLeft: 2, paddingRight: 1, marginTop: "200px" }}>
                <List sx={{ padding: 1 }}>
                    {stops.map((itineraryStop, index) => {
                        const stop = itineraryStop[EItineraryStop.stop];
                        const time = times[index]?.[1] ?? times[index]?.[0];
                        const stoppedAt = sequence === index && atStop;
                        const inTransit = sequence === index && !atStop;
                        const highlighted = stoppedAt || inTransit;
                        const passed = sequence !== null && index < sequence;
                        const onDemand = (itineraryStop[EItineraryStop.alight] & ALIGHT.OnDemand) !== 0;
                        const live = !!time && isLiveStatus(time[2]);
                        const delayMin = live && time ? (time[1] > 0 ? Math.floor(time[1] / 60000) : Math.floor(Math.abs(time[1] / 60000)) * -1) : undefined;
                        const delayed = delayMin !== undefined && Math.abs(delayMin) >= 1;
                        const chipClass = delayMin ? `bg-${delayClassOf(delayMin)} text-white` : "";
                        const name = stop[EStopTuple.stopName];
                        return (
                            <Fragment key={`${stop[EStopTuple.stopId]}-${index}`}>
                                <ListItem
                                    ref={highlighted ? currentRef : null}
                                    disablePadding
                                    sx={{
                                        position: "relative",
                                        margin: "16px 0",
                                        borderRadius: 2,
                                        backgroundColor: highlighted ? scheme.secondaryBackground : "background.paper",
                                        paddingLeft: 3,
                                        paddingRight: 2,
                                        paddingTop: 4,
                                        paddingBottom: 4,
                                        transition: "all 0.3s ease",
                                    }}
                                >
                                    <ListItemText
                                        
                                        primary={
                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                                                <Typography
                                                    variant="h3"
                                                    sx={{
                                                        fontWeight: stoppedAt ? "900" : "800",
                                                        fontSize: `${SIZE.displayLg} !important`,
                                                        color: highlighted ? scheme.secondaryText : scheme.text,
                                                        lineHeight: 1.3,
                                                        flex: 1,
                                                        wordBreak: "break-word",
                                                        overflowWrap: "break-word",
                                                        fontFamily: DISPLAY_FONT,
                                                    }}
                                                >
                                                    {onDemand ? (
                                                        <>
                                                            <PanToolIcon sx={{ fontSize: SIZE.displaySm, mr: 1, verticalAlign: "middle", color: "inherit" }} />
                                                            {name} - {t(city === "wroclaw" ? "global.onWish" : "global.onDemand")}
                                                        </>
                                                    ) : (
                                                        name
                                                    )}
                                                </Typography>
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0, minWidth: "fit-content" }}>
                                                    {!passed && time && (
                                                        <Chip
                                                            size="medium"
                                                            label={hhmm(time[0] + (delayMin ?? 0) * 60000, timeZone)}
                                                            sx={{ backgroundColor: delayed ? undefined : "transparent", fontSize: SIZE.displayMd, height: "100px", fontWeight: "900", fontFamily: DISPLAY_FONT }}
                                                            className={chipClass}
                                                        />
                                                    )}
                                                </Box>
                                            </Box>
                                        }
                                        secondary={
                                            highlighted && (
                                                <Box sx={{ mt: 1 }}>
                                                    <Box sx={{ display: "flex", alignItems: "center" }}>
                                                        <Box
                                                            sx={{
                                                                width: 8,
                                                                height: 8,
                                                                borderRadius: "50%",
                                                                backgroundColor: scheme.secondaryText,
                                                                mr: 1,
                                                                animation: stoppedAt ? "pulse 2s infinite" : "none",
                                                            }}
                                                        />
                                                        <Typography
                                                            variant="h5"
                                                            sx={{
                                                                fontWeight: "900",
                                                                fontSize: `${SIZE.h3} !important`,
                                                                color: scheme.secondaryText,
                                                                textTransform: "uppercase",
                                                                letterSpacing: 1,
                                                                fontFamily: DISPLAY_FONT,
                                                            }}
                                                        >
                                                            {stoppedAt ? "Aktualny przystanek" : "Następny przystanek"}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            )
                                        }
                                    />
                                </ListItem>
                                {index < stops.length - 1 && (
                                    <Divider sx={{ my: 2, mx: 2, borderColor: theme.palette.mode === "dark" ? "grey.400" : "grey.600", borderWidth: "2px", opacity: 1 }} />
                                )}
                            </Fragment>
                        );
                    })}
                </List>
            </Box>
            <DisplayFooter />
        </Box>
    );
}
