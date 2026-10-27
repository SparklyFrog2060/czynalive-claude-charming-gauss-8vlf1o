import { Alert, AlertTitle, Box, Button, Divider, FormControlLabel, FormGroup, Switch, Typography } from "@mui/material";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useCity } from "@/api/cities";
import { attributionFor, mapStyleFor, normalizeTileLayer } from "@/components/map/mapStyle";
import { useSettings } from "@/store/settings";

const DEFAULT_ZOOM = 15;

const LocationPicker = ({ center, position, onPick }: { center: [number, number]; position: [number, number] | null; onPick: (point: [number, number]) => void }) => {
    const { t } = useTranslation();
    const container = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markerRef = useRef<maplibregl.Marker | null>(null);
    const pickRef = useRef(onPick);
    pickRef.current = onPick;
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const [settings] = useSettings();
    const layer = normalizeTileLayer(settings.mapStyle);

    useEffect(() => {
        if (!container.current) return;
        const map = new maplibregl.Map({
            container: container.current,
            style: mapStyleFor(layer, dark),
            center: position ?? center,
            zoom: DEFAULT_ZOOM,
            attributionControl: false,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: attributionFor(layer) }), "bottom-right");
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        map.on("click", (event) => pickRef.current([event.lngLat.lng, event.lngLat.lat]));
        mapRef.current = map;
        return () => {
            markerRef.current = null;
            map.remove();
        };
    }, [dark]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (!position) {
            markerRef.current?.remove();
            markerRef.current = null;
            return;
        }
        if (markerRef.current) {
            markerRef.current.setLngLat(position);
            return;
        }
        const marker = new maplibregl.Marker({ draggable: true, color: "#29a847" })
            .setLngLat(position)
            .setPopup(new maplibregl.Popup({ closeButton: false }).setText(t("settings.chosenLocation")))
            .addTo(map);
        marker.togglePopup();
        marker.on("dragend", () => {
            const point = marker.getLngLat();
            pickRef.current([point.lng, point.lat]);
        });
        markerRef.current = marker;
    }, [position, dark]);

    return (
        <div style={{ height: 300 }}>
            <div ref={container} className="minimapgl noselect" style={{ height: "100%", width: "100%", border: "2px solid #29a847" }} />
        </div>
    );
};

export const StartLocationSection = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useSettings();
    const city = useCity(settings.city ?? undefined);
    const saved = city ? settings.startLocations[city.id] : undefined;
    const [position, setPosition] = useState<[number, number] | null>(saved ? [saved[0], saved[1]] : null);
    const [status, setStatus] = useState<"saved" | "removed" | null>(null);

    if (!city) {
        return (
            <Box sx={{ my: 2 }}>
                <Typography gutterBottom>Najpierw wybierz miasto.</Typography>
                <Button component={Link} to="/miasto" variant="contained">
                    {t("chooseCity.chooseCity")}
                </Button>
            </Box>
        );
    }

    const save = () => {
        if (!position) return;
        setSettings({ startLocations: { ...settings.startLocations, [city.id]: [position[0], position[1], DEFAULT_ZOOM] } });
        setStatus("saved");
    };
    const remove = () => {
        const next = { ...settings.startLocations };
        delete next[city.id];
        setSettings({ startLocations: next });
        setPosition(null);
        setStatus("removed");
    };

    return (
        <div>
            <Typography variant="body1" gutterBottom>
                {t("settings.locationPart1")}
            </Typography>
            <Divider style={{ margin: "20px 0" }} />
            <Typography variant="h4" gutterBottom>
                {t("settings.locationPart2")}
            </Typography>
            <Typography variant="body1" gutterBottom>
                {t("settings.locationPart3")}
            </Typography>
            {settings.useLastMapLocation ? (
                <Typography variant="body1" gutterBottom>
                    <strong>{t("settings.locationPart4")}</strong>
                </Typography>
            ) : (
                <>
                    <Typography variant="body1" gutterBottom>
                        {t("settings.locationPart5")} <strong>{city.name}.</strong>
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                        <strong>{t("settings.locationPart6")}:</strong>
                    </Typography>
                    <LocationPicker center={city.location} position={position} onPick={(point) => (setPosition(point), setStatus(null))} />
                    <Button style={{ marginTop: 20 }} color="primary" variant="contained" fullWidth disabled={!position} onClick={save}>
                        {t("settings.locationPart7")}
                    </Button>
                    {saved && (
                        <Button style={{ marginTop: 20 }} color="error" variant="outlined" fullWidth onClick={remove}>
                            {t("settings.locationPart8")}
                        </Button>
                    )}
                    {status === "saved" && (
                        <Alert severity="success" style={{ marginTop: 15 }}>
                            <AlertTitle sx={{ mb: 0 }}>{t("settings.locationPart9")}</AlertTitle>
                        </Alert>
                    )}
                    {status === "removed" && (
                        <Alert severity="error" style={{ marginTop: 15 }}>
                            <AlertTitle sx={{ mb: 0 }}>{t("settings.locationPart10")}</AlertTitle>
                        </Alert>
                    )}
                </>
            )}
            <Divider style={{ margin: "20px 0" }} />
            <Typography variant="h4" gutterBottom>
                {t("settings.lastSavedLocation1")}
            </Typography>
            <Typography variant="body1" gutterBottom style={{ marginBottom: 20, fontSize: "0.875rem" }}>
                <em>{t("settings.lastSavedLocation2")}</em>
            </Typography>
            <Typography variant="body1" gutterBottom>
                {t("settings.lastSavedLocation3")}
            </Typography>
            <Typography variant="body1" gutterBottom>
                {t("settings.lastSavedLocation4")}
            </Typography>
            <Typography variant="body1" gutterBottom>
                {t("settings.lastSavedLocation5")}: <strong>{city.name}.</strong>
            </Typography>
            <FormGroup>
                <FormControlLabel
                    control={<Switch checked={settings.useLastMapLocation} onChange={() => setSettings({ useLastMapLocation: !settings.useLastMapLocation })} color="primary" />}
                    label={t("settings.lastSavedLocation6")}
                />
            </FormGroup>
        </div>
    );
};
