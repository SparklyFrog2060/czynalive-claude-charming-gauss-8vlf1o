import Grid from "@mui/material/Grid2";
import { Box, Card, Divider, FormControlLabel, FormGroup, List, ListItem, ListItemIcon, ListItemText, Paper, SvgIcon, Switch, Typography } from "@mui/material";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useCity } from "@/api/cities";
import { cityGet } from "@/api/client";
import { ERouteTuple, RouteType, type RouteTuple } from "@/api/types";
import { useApi } from "@/api/useApi";
import { VehicleGlyph, VehicleTypeIcon } from "@/components/brigades/VehicleTypeIcon";
import { ICON_PATHS } from "@/components/map/icons";
import { vehicleType, type DelayClass } from "@/lib/transit";
import { useSettings, type Settings } from "@/store/settings";

const TYPE_ORDER = [RouteType.Ferry, RouteType.Subway, RouteType.Tram, RouteType.Trolleybus, RouteType.Bus, RouteType.Rail];

const DELAY_SAMPLES: { cls: DelayClass; label: string; values: number[] }[] = [
    { cls: "delayed-no-data", label: "settings.delayNoData", values: [] },
    { cls: "before-time", label: "settings.delayRange1", values: [2] },
    { cls: "on-time", label: "settings.delayRange2", values: [1, 3] },
    { cls: "delayed-slight", label: "settings.delayRange3", values: [4, 9] },
    { cls: "delayed-minor", label: "settings.delayRange4", values: [10, 14] },
    { cls: "delayed-moderate", label: "settings.delayRange4", values: [15, 19] },
    { cls: "delayed-major", label: "settings.delayRange4", values: [20, 24] },
    { cls: "delayed-critical", label: "settings.delayRange5", values: [25] },
];

const NO_AC_BADGE =
    '<div class="marker-badge no-ac-badge"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="white" d="M15 13V5c0-1.66-1.34-3-3-3S9 3.34 9 5v8c-1.21.91-2 2.37-2 4 0 2.76 2.24 5 5 5s5-2.24 5-5c0-1.63-.79-3.09-2-4z"/></svg></div>';

const useResolvedMode = () => {
    const [settings] = useSettings();
    const [mode, setMode] = useState(() => document.documentElement.getAttribute("data-theme") ?? "light");
    useEffect(() => {
        const timer = setTimeout(() => setMode(document.documentElement.getAttribute("data-theme") ?? "light"));
        return () => clearTimeout(timer);
    }, [settings.theme]);
    return mode;
};

export const MarkerPreview = ({ type, delayClass, brigade, vehicleNo, mode }: { type: number; delayClass?: DelayClass; brigade: boolean; vehicleNo: boolean; mode: string }) => {
    const key = vehicleType(type).key;
    const base = mode === "dark" ? `bg-${key} text-default-text border-default-text fill-default-text` : `bg-white text-${key} border-${key} fill-${key}`;
    return (
        <div className={`vehicle-marker ${base} ${delayClass ?? ""}`} style={{ maxWidth: 150, zIndex: "auto", transform: "none" }}>
            <div className="marker-data-row main">
                <SvgIcon viewBox="0 0 24 24" style={{ transform: "rotate(209deg)" }}>
                    <path d={ICON_PATHS.arrow} />
                </SvgIcon>
                <VehicleGlyph vehicle={type} />
                <div className="route-id-number">100</div>
                {brigade && <div className="brigade">/23</div>}
                {vehicleNo && <div className="vehicle-no">/5689</div>}
            </div>
        </div>
    );
};

const PreviewCard = ({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) => (
    <Paper sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", position: "relative" }}>
        <Box sx={{ alignItems: "center", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", p: 1 }}>
            <Typography variant="body1" gutterBottom>
                {title}
            </Typography>
            {caption && (
                <Typography variant="caption" gutterBottom>
                    {caption}:
                </Typography>
            )}
            {children}
        </Box>
    </Paper>
);

const ToggleBlock = ({ title, description, label, field }: { title: string; description: ReactNode; label: string; field: keyof Settings }) => {
    const [settings, setSettings] = useSettings();
    return (
        <FormGroup>
            <Typography variant="h4">{title}</Typography>
            <Typography variant="body2">
                <em>{description}</em>
            </Typography>
            <FormControlLabel
                control={<Switch checked={!!settings[field]} onChange={() => setSettings({ [field]: !settings[field] } as Partial<Settings>)} color="primary" />}
                label={label}
            />
        </FormGroup>
    );
};

export const MarkersSection = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useSettings();
    const city = useCity(settings.city ?? undefined);
    const mode = useResolvedMode();
    const routes = useApi(city ? (signal) => cityGet<RouteTuple[]>(city.id, "/routes", undefined, signal) : null, [city?.id]);
    const cityTypes = new Set((routes.data ?? []).filter((route) => route[ERouteTuple.city] === city?.id).map((route) => route[ERouteTuple.routeType]));
    const types = cityTypes.size ? TYPE_ORDER.filter((type) => cityTypes.has(type)) : [RouteType.Tram, RouteType.Bus];

    return (
        <div>
            <Typography variant="h3" gutterBottom>
                {t("settings.markers")}
            </Typography>
            <Typography variant="body1" gutterBottom>
                <strong>{t("settings.markerPart1")}</strong>
            </Typography>
            <Divider style={{ margin: "20px 0" }} />
            <ToggleBlock
                title={t("settings.showBrigade")}
                description={<Trans i18nKey="settings.brigadeDescription" components={[<strong key="0" />]} />}
                label={t("settings.showBrigadeLabel")}
                field="markerShowBrigade"
            />
            <Divider style={{ margin: "20px 0" }} />
            <ToggleBlock
                title={t("settings.showVehicleNo")}
                description={<Trans i18nKey="settings.vehicleNoDescription" components={[<strong key="0" />]} />}
                label={t("settings.showVehicleNoLabel")}
                field="markerShowVehicleNo"
            />
            <Divider style={{ margin: "20px 0" }} />
            <ToggleBlock
                title={t("settings.colorByDelay")}
                description={<Trans i18nKey="settings.colorByDelayDescription" components={[<strong key="0" />]} />}
                label={t("settings.colorByDelayLabel")}
                field="colorByDelay"
            />
            <Divider style={{ margin: "20px 0" }} />
            <ToggleBlock title={t("settings.showVehiclePhotos")} description={t("settings.vehiclePhotosDescription")} label={t("settings.showVehiclePhotosLabel")} field="showVehiclePhotos" />
            <Divider style={{ margin: "20px 0" }} />
            <FormGroup>
                <Typography variant="h4">{t("settings.noAcBadgeMode")}</Typography>
                <Typography variant="body2" gutterBottom>
                    <em>{t("settings.noAcBadgeModeDescription")}</em>
                </Typography>
                <Grid container spacing={3}>
                    {(["never", "hot", "always"] as const).map((value) => (
                        <Grid key={value} size={{ xs: 12, sm: 4 }} onClick={() => setSettings({ noAcBadgeMode: value })}>
                            <Card
                                variant="outlined"
                                className={settings.noAcBadgeMode === value ? "border-primary" : ""}
                                sx={{ cursor: "pointer", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", p: 1, gap: 1 }}
                            >
                                <Typography variant="subtitle2" sx={{ overflowWrap: "break-word", hyphens: "auto" }}>
                                    {t(value === "never" ? "settings.noAcBadgeModeNever" : value === "hot" ? "settings.noAcBadgeModeHot" : "settings.noAcBadgeModeAlways")}
                                </Typography>
                                <div className={`vehicle-marker ${mode === "dark" ? "bg-bus text-default-text border-default-text fill-default-text" : "bg-white text-bus border-bus fill-bus"}`} style={{ maxWidth: 150, zIndex: "auto", transform: "none" }}>
                                    <div className="marker-data-row main">
                                        <VehicleGlyph vehicle={RouteType.Bus} />
                                        <div className="route-id-number">100</div>
                                    </div>
                                    {value !== "never" && <div className="marker-badges" dangerouslySetInnerHTML={{ __html: NO_AC_BADGE }} />}
                                </div>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </FormGroup>
            <Divider style={{ margin: "20px 0" }} />
            <ToggleBlock title={t("settings.showRampBadge")} description={t("settings.showRampBadgeDescription")} label={t("settings.showRampBadgeLabel")} field="showRampBadge" />
            <Divider style={{ margin: "20px 0" }} />

            <Typography variant="h4">{t("global.preview")}:</Typography>
            <Box sx={{ my: 3 }}>
                {settings.colorByDelay ? (
                    types.map((type) => (
                        <Fragment key={type}>
                            <Grid container spacing={1}>
                                {DELAY_SAMPLES.map((sample) => (
                                    <Grid key={sample.cls} size={{ xs: 6, sm: 4, md: 2 }}>
                                        <PreviewCard title={vehicleType(type).name} caption={t(sample.label, { one: sample.values[0], two: sample.values[1] })}>
                                            <MarkerPreview type={type} delayClass={`${sample.cls} z-index-2` as DelayClass} brigade={settings.markerShowBrigade} vehicleNo={settings.markerShowVehicleNo} mode={mode} />
                                        </PreviewCard>
                                    </Grid>
                                ))}
                            </Grid>
                            <Divider sx={{ my: 2 }} />
                        </Fragment>
                    ))
                ) : (
                    <Grid container spacing={1}>
                        {types.map((type) => (
                            <Grid key={type} size={{ xs: 6, sm: 4, md: 2 }}>
                                <PreviewCard title={vehicleType(type).name}>
                                    <MarkerPreview type={type} brigade={settings.markerShowBrigade} vehicleNo={settings.markerShowVehicleNo} mode={mode} />
                                </PreviewCard>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Box>

            <Typography variant="h4" gutterBottom>
                {t("settings.markers")}
            </Typography>
            <Typography variant="h5" gutterBottom>
                <Trans i18nKey="settings.markerColors" values={{ city: city?.name ?? "" }} components={[<strong key="0" />]} />
            </Typography>
            <List>
                {types.map((type) => (
                    <Fragment key={type}>
                        <ListItem
                            secondaryAction={<Box sx={{ width: 30, height: 30, borderRadius: "4px", backgroundColor: vehicleType(type).cssVar }} />}
                        >
                            <ListItemIcon>
                                <VehicleTypeIcon type={type} />
                            </ListItemIcon>
                            <ListItemText primary={<Typography variant="body1">{vehicleType(type).name}</Typography>} />
                        </ListItem>
                        <Divider />
                    </Fragment>
                ))}
            </List>
        </div>
    );
};
