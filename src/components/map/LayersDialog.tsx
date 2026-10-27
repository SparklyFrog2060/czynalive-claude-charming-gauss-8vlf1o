import CloseIcon from "@mui/icons-material/Close";
import { Box, Button, Dialog, DialogActions, DialogContent, Divider, IconButton, Paper, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { RouteType, StopDepartureStatus, type StopDepartureTuple } from "@/api/types";
import { DepartureRow } from "@/components/departures/DepartureRow";
import { useSettings } from "@/store/settings";
import { ICON_PATHS, typeClass } from "./icons";
import { mapStyleFor, normalizeTileLayer, type TileLayer } from "./mapStyle";

type Props = { open: boolean; onClose: () => void; center: [number, number]; zoom: number; dark: boolean };

const TILE = 256;
const DARK_FILTER = "invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%) saturate(50%)";
const NO_AC_BADGE =
    '<div class="marker-badge no-ac-badge"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="white" d="M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4z"/></svg></div>';
const RAMP_PATHS =
    '<circle fill="white" cx="12.986" cy="2.916" r="1.91"/><path fill="white" d="M13.571,15.143l-1.833,0.535c0.441,1.514-0.435,3.113-1.947,3.555s-3.112-0.435-3.554-1.947 c-0.442-1.513,0.435-3.112,1.947-3.554l-0.536-1.833c-2.53,0.739-3.984,3.393-3.245,5.922c0.739,2.531,3.393,3.985,5.923,3.245 C12.857,20.327,14.312,17.673,13.571,15.143z M15.385,11.13l-1.704,0.498l0.548-3.812c0.202-1.383-1.098-2.496-2.454-2.099 L7.006,7.11C6.264,7.327,5.721,7.954,5.613,8.711l-0.132,1.83l1.902-0.028L7.57,8.936l2.026-0.592l-0.58,4.249 c-0.194,1.38,1.134,2.555,2.473,2.164l4.566-1.334l1.34,4.584l1.833-0.536l-1.474-5.042C17.46,11.42,16.394,10.836,15.385,11.13z"/><path fill="white" d="M9.662,23.837c-0.392,0-0.763-0.231-0.923-0.615c-0.213-0.51,0.028-1.095,0.538-1.308l13.089-5.462 c0.508-0.213,1.095,0.027,1.308,0.538c0.213,0.51-0.028,1.095-0.538,1.308L10.046,23.76C9.92,23.813,9.79,23.837,9.662,23.837z"/>';
const RAMP_BADGE = `<div class="marker-badge ramp-badge-yes"><svg viewBox="0 0 24 24" width="14" height="14">${RAMP_PATHS}</svg></div>`;

const optionSx = { cursor: "pointer", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", p: 1, gap: 1 } as const;
const cardSx = { cursor: "pointer", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", position: "relative", textAlign: "center", p: 1, gap: 1 } as const;

// Static marker as drawn by the original's layer previews.
const Marker = ({ type, dark, delayClass = "", arrow = true, brigade, vehicleNo, badge }: { type: number; dark: boolean; delayClass?: string; arrow?: boolean; brigade?: string; vehicleNo?: string; badge?: string }) => {
    const name = typeClass(type);
    const colors = dark ? `bg-${name} text-default-text border-default-text fill-default-text` : `bg-white text-${name} border-${name} fill-${name}`;
    return (
        <div className={`vehicle-marker ${delayClass} ${colors}`} style={{ maxWidth: 150, zIndex: "auto", transform: "none" }}>
            <div className="marker-data-row main">
                {arrow && (
                    <svg className="MuiSvgIcon-root" viewBox="0 0 24 24" style={{ transform: "rotate(209deg)" }} aria-hidden="true">
                        <path d={ICON_PATHS.arrow} />
                    </svg>
                )}
                <svg className="MuiSvgIcon-root" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={ICON_PATHS[name]} />
                </svg>
                <div className="route-id-number">{type === RouteType.Tram ? "10" : "100"}</div>
                {brigade && <div className="brigade">{brigade}</div>}
                {vehicleNo && <div className="vehicle-no">{vehicleNo}</div>}
            </div>
            {badge && <div className="marker-badges" dangerouslySetInnerHTML={{ __html: badge }} />}
        </div>
    );
};

const Choice = ({ selected, onClick, label, children, size = { xs: 6, sm: 6, md: 6 } }: { selected: boolean; onClick: () => void; label: ReactNode; children: ReactNode; size?: object }) => (
    <Grid onClick={onClick} size={size}>
        <Paper variant="outlined" sx={cardSx} className={selected ? "border-primary" : ""}>
            <Typography variant="subtitle2" gutterBottom>
                {label}
            </Typography>
            {children}
        </Paper>
    </Grid>
);

// Option cards laid out like the original's settings grid (three or two per row).
const Options = <T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; preview: ReactNode }[]; onChange: (value: T) => void }) => (
    <Grid container spacing={3}>
        {options.map((option) => (
            <Grid key={option.value} onClick={() => onChange(option.value)} size={{ xs: 12, sm: Math.floor(12 / options.length) }}>
                <Paper variant="outlined" sx={optionSx} className={value === option.value ? "border-primary" : ""}>
                    <Typography variant="subtitle2" sx={{ overflowWrap: "break-word", hyphens: "auto" }}>
                        {option.label}
                    </Typography>
                    {option.preview}
                </Paper>
            </Grid>
        ))}
    </Grid>
);

const worldPixel = (lat: number, lng: number, zoom: number) => {
    const scale = TILE * 2 ** zoom;
    const sin = Math.sin((lat * Math.PI) / 180);
    return { x: ((lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
};

const MiniMap = ({ style, center, zoom }: { style: ReturnType<typeof mapStyleFor>; center: [number, number]; zoom: number }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!ref.current) return;
        const map = new maplibregl.Map({ container: ref.current, style, center, zoom, interactive: false, attributionControl: false });
        return () => map.remove();
    }, []);
    return <div ref={ref} style={{ width: "100%", maxWidth: 100, maxHeight: 100, aspectRatio: "1", borderRadius: "4px", overflow: "hidden", pointerEvents: "none" }} />;
};

const sampleDeparture = (): StopDepartureTuple => {
    const now = Date.now();
    return [
        ["sample", "", ["11", "", "11", "", "default", RouteType.Bus, "#006b47"], "Zajezdnia Czynalive", "12", "", []],
        ["3:4417", "", ["212", "", "212", "", "default", RouteType.Bus, "#006b47"], "5", [21.0569, 52.3019], -75],
        [now, 180000, StopDepartureStatus.OnTrip, "", 1],
    ] as unknown as StopDepartureTuple;
};

// "Warstwy mapy": base layer, marker look and departure board options.
export const LayersDialog = ({ open, onClose, center, zoom, dark }: Props) => {
    const { t } = useTranslation();
    const [settings, setSettings] = useSettings();
    const tile = normalizeTileLayer(settings.mapStyle);
    const previewZoom = Math.min(Math.floor(zoom), 12) + 1;
    const pixel = worldPixel(center[1], center[0], previewZoom);
    const x = Math.floor(pixel.x / TILE);
    const y = Math.floor(pixel.y / TILE);
    const objectPosition = `${(pixel.x / TILE - x) * 100}% ${(pixel.y / TILE - y) * 100}%`;
    const imageSx = { width: "100%", maxWidth: 100, maxHeight: 100, aspectRatio: "1", objectFit: "cover" as const, objectPosition, borderRadius: "4px", filter: "none" };
    const setTile = (value: TileLayer) => setSettings({ mapStyle: value });
    const departure = sampleDeparture();
    const tileCard = (value: TileLayer, label: string, preview: ReactNode) => (
        <Grid onClick={() => setTile(value)} size={{ xs: 6, sm: 4 }}>
            <Paper
                variant="outlined"
                sx={{ cursor: "pointer", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", p: 1, gap: 1, overflow: "hidden" }}
                className={tile === value ? "border-primary" : ""}
            >
                {preview}
                <Typography variant="subtitle2">{label}</Typography>
            </Paper>
        </Grid>
    );

    return (
        <Dialog open={open} onClose={onClose} scroll="paper" style={{ overflowX: "hidden" }} fullScreen>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="subtitle1" style={{ padding: "4px 10px" }}>
                    {t("map.layersHeader")}
                </Typography>
                <IconButton onClick={onClose} size="large">
                    <CloseIcon />
                </IconButton>
            </Box>
            <DialogContent dividers sx={{ p: 2 }}>
                <Typography variant="body1" sx={{ pb: 2 }}>
                    {t("map.tileLayerHeader")}
                </Typography>
                <Grid container spacing={2} sx={{ justifyContent: "center" }}>
                    {tileCard(
                        "osm",
                        t("map.tileLayerOSM"),
                        <Box
                            component="img"
                            src={`https://tile.openstreetmap.org/${previewZoom}/${x}/${y}.png`}
                            alt={t("map.tileLayerOSM")}
                            referrerPolicy="strict-origin-when-cross-origin"
                            loading="lazy"
                            sx={[imageSx, dark ? { filter: `${DARK_FILTER} !important` } : { filter: "none" }]}
                        />,
                    )}
                    {tileCard(
                        "satellite",
                        t("map.tileLayerSatellite"),
                        <Box
                            component="img"
                            src={`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${previewZoom}/${y}/${x}`}
                            alt={t("map.tileLayerSatellite")}
                            loading="lazy"
                            sx={imageSx}
                        />,
                    )}
                    {tileCard("streets", t("map.tileLayerOpenFreeMap"), open && <MiniMap style={mapStyleFor("streets", dark)} center={center} zoom={previewZoom - 1} />)}
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body1" sx={{ pb: 2 }}>
                    {t("settings.markers")}
                </Typography>
                <Grid container spacing={3}>
                    <Choice selected={!settings.colorByDelay} onClick={() => setSettings({ colorByDelay: false })} label={t("map.layersColorBasedOnType")}>
                        <Marker type={RouteType.Bus} dark={dark} />
                        <Marker type={RouteType.Tram} dark={dark} />
                    </Choice>
                    <Choice selected={settings.colorByDelay} onClick={() => setSettings({ colorByDelay: true })} label={t("map.layersColorBasedOnDelay")}>
                        <Marker type={RouteType.Bus} dark={dark} delayClass="delayed-moderate " />
                        <Marker type={RouteType.Tram} dark={dark} delayClass="delayed-slight" />
                    </Choice>
                </Grid>
                <Grid container sx={{ pt: 1 }}>
                    <Grid size={{ xs: 6, sm: 6, md: 6 }} />
                    <Grid size={{ xs: 6, sm: 6, md: 6 }}>
                        <Typography variant="subtitle2" align="center">
                            <Link to="/ustawienia/znaczniki-pojazdow" style={dark ? { color: "var(--default-text)" } : undefined}>
                                {t("map.layersColorBasedOnDelayDetails")}
                            </Link>
                        </Typography>
                    </Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={3}>
                    <Choice selected={!settings.markerShowBrigade} onClick={() => setSettings({ markerShowBrigade: false })} label={t("map.layersNoShowBrigade")}>
                        <Marker type={RouteType.Bus} dark={dark} />
                    </Choice>
                    <Choice selected={settings.markerShowBrigade} onClick={() => setSettings({ markerShowBrigade: true })} label={t("map.layersShowBrigade")}>
                        <Marker type={RouteType.Bus} dark={dark} brigade="/06" />
                    </Choice>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={3}>
                    <Choice selected={!settings.markerShowVehicleNo} onClick={() => setSettings({ markerShowVehicleNo: false })} label={t("map.layersNoShowVehicle")}>
                        <Marker type={RouteType.Bus} dark={dark} brigade={settings.markerShowBrigade ? "/06" : undefined} />
                    </Choice>
                    <Choice selected={settings.markerShowVehicleNo} onClick={() => setSettings({ markerShowVehicleNo: true })} label={t("map.layersShowVehicle")}>
                        <Marker type={RouteType.Bus} dark={dark} brigade={settings.markerShowBrigade ? "/06" : undefined} vehicleNo="/4202" />
                    </Choice>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Options
                    value={settings.noAcBadgeMode}
                    onChange={(value) => setSettings({ noAcBadgeMode: value })}
                    options={[
                        { value: "never", label: t("map.layersNoAcNever"), preview: <Marker type={RouteType.Bus} dark={dark} arrow={false} /> },
                        { value: "hot", label: t("map.layersNoAcHot"), preview: <Marker type={RouteType.Bus} dark={dark} arrow={false} badge={NO_AC_BADGE} /> },
                        { value: "always", label: t("map.layersNoAcAlways"), preview: <Marker type={RouteType.Bus} dark={dark} arrow={false} badge={NO_AC_BADGE} /> },
                    ]}
                />
                <Typography variant="body2" sx={{ pt: 2 }}>
                    <em>{t("map.layersNoAcDescription")}</em>
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Options
                    value={settings.showRampBadge ? "show" : "hide"}
                    onChange={(value) => setSettings({ showRampBadge: value === "show" })}
                    options={[
                        { value: "hide", label: t("map.layersRampBadgeOff"), preview: <Marker type={RouteType.Bus} dark={dark} arrow={false} /> },
                        { value: "show", label: t("map.layersRampBadgeOn"), preview: <Marker type={RouteType.Bus} dark={dark} arrow={false} badge={RAMP_BADGE} /> },
                    ]}
                />
                <Typography variant="body2" sx={{ pt: 2 }}>
                    <em>{t("map.layersRampBadgeDescription")}</em>
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body1" sx={{ pb: 2 }}>
                    {t("settings.timetableSettings")}
                </Typography>
                <Grid container spacing={2}>
                    <Choice
                        size={{ xs: 12, sm: 6, md: 6 }}
                        selected={!settings.departuresShowBrigade}
                        onClick={() => setSettings({ departuresShowBrigade: false })}
                        label={t("map.layersNoShowBrigade")}
                    >
                        <Box sx={{ width: "100%" }}>
                            <DepartureRow city="" departure={departure} now={departure[2][0]} showBrigade={false} showVehicleNo={false} onSelect={() => undefined} />
                        </Box>
                    </Choice>
                    <Choice size={{ xs: 12, sm: 6, md: 6 }} selected={settings.departuresShowBrigade} onClick={() => setSettings({ departuresShowBrigade: true })} label={t("map.layersShowBrigade")}>
                        <Box sx={{ width: "100%" }}>
                            <DepartureRow city="" departure={departure} now={departure[2][0]} showBrigade showVehicleNo={false} onSelect={() => undefined} />
                        </Box>
                    </Choice>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2}>
                    <Choice
                        size={{ xs: 12, sm: 6, md: 6 }}
                        selected={!settings.departuresShowVehicleNo}
                        onClick={() => setSettings({ departuresShowVehicleNo: false })}
                        label={t("map.layersNoShowVehicle")}
                    >
                        <Box sx={{ width: "100%" }}>
                            <DepartureRow city="" departure={departure} now={departure[2][0]} showBrigade={settings.departuresShowBrigade} showVehicleNo={false} onSelect={() => undefined} />
                        </Box>
                    </Choice>
                    <Choice
                        size={{ xs: 12, sm: 6, md: 6 }}
                        selected={settings.departuresShowVehicleNo}
                        onClick={() => setSettings({ departuresShowVehicleNo: true })}
                        label={t("map.layersShowVehicle")}
                    >
                        <Box sx={{ width: "100%" }}>
                            <DepartureRow city="" departure={departure} now={departure[2][0]} showBrigade={settings.departuresShowBrigade} showVehicleNo onSelect={() => undefined} />
                        </Box>
                    </Choice>
                </Grid>
            </DialogContent>
            <DialogActions style={{ justifyContent: "flex-end", paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0))" }}>
                <Button onClick={onClose} color="primary" size="small" variant={dark ? "contained" : "text"} className="text-default-text">
                    {t("global.close")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
