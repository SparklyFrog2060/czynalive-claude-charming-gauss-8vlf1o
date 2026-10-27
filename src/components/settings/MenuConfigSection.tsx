import Grid from "@mui/material/Grid2";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import { Alert, AlertTitle, Badge, Box, Button, Divider, IconButton, Typography } from "@mui/material";
import { BottomBar, BottomBarAction } from "@/components/Layout";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NAV_ENTRIES } from "@/lib/navigation";
import { DEFAULT_BOTTOM_NAV, useSettings, type BottomNavItem } from "@/store/settings";
import { rebrand } from "./SimpleSections";

// Order of the original route table (only screens that can become a shortcut).
const SHORTCUTS: BottomNavItem[] = ["multiBrigades", "brigades", "favourites", "timetable", "stats", "alerts", "delays", "cancelled"];
const FIXED: BottomNavItem[] = ["map", "menu"];

export const MenuConfigSection = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useSettings();
    const [config, setConfig] = useState<BottomNavItem[]>(settings.bottomNav);
    const [selected, setSelected] = useState<BottomNavItem | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const isCustom = JSON.stringify(settings.bottomNav) !== JSON.stringify(DEFAULT_BOTTOM_NAV);

    const replace = (key: BottomNavItem) => {
        const index = config.indexOf(key);
        if (index === -1 || !selected) {
            setMessage({ type: "error", text: t("global.error") });
            return;
        }
        const next = [...config];
        next[index] = selected;
        setConfig(next);
        setSelected(null);
    };

    return (
        <div>
            <Typography variant="h3" gutterBottom>
                {t("settings.menuConfigPageTitle")}
            </Typography>
            <Typography variant="body1" gutterBottom>
                <strong>{rebrand(t("settings.menuConfigPart1"))}</strong>
            </Typography>
            <Divider sx={{ my: 3 }} />

            <Typography variant="h4" gutterBottom>
                {t("settings.menuConfigPart3")}
            </Typography>
            <Typography variant="body1" gutterBottom>
                {t("settings.menuConfigPart4")}
            </Typography>
            <Grid container spacing={1} style={{ padding: 10 }} sx={{ alignItems: "stretch", justifyContent: "flex-start" }}>
                {SHORTCUTS.filter((key) => !config.includes(key)).map((key) => {
                    const entry = NAV_ENTRIES[key];
                    return (
                        <Grid
                            key={key}
                            onClick={() => setSelected(key)}
                            size={{ xs: 4, sm: 3, md: 2, lg: 1, xl: 1 }}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                textAlign: "center",
                                textDecoration: "none",
                                cursor: "pointer",
                                color: "var(--default-text)",
                            }}
                        >
                            <IconButton>
                                {selected === key ? (
                                    <Badge variant="standard" color="primary" badgeContent={<AutorenewIcon sx={{ fontSize: "0.875rem" }} />}>
                                        {entry.icon}
                                    </Badge>
                                ) : (
                                    entry.icon
                                )}
                            </IconButton>
                            <Typography variant="caption">{t(entry.titleKey)}</Typography>
                        </Grid>
                    );
                })}
            </Grid>
            <Divider sx={{ my: 3 }} />

            <Typography variant="h4" gutterBottom>
                {t("settings.menuConfigPart5")}
            </Typography>
            <Typography variant="body1" gutterBottom>
                {t("settings.menuConfigPart6")}
            </Typography>
            <BottomBar showLabels sx={{ position: "relative", boxShadow: "none", borderTop: "none" }}>
                {config.map((key) => {
                    const entry = NAV_ENTRIES[key];
                    const replaceable = !FIXED.includes(key);
                    return (
                        <BottomBarAction
                            key={key}
                            value=""
                            label={t(entry.titleKey)}
                            disabled={!replaceable || selected === null}
                            onClick={() => replace(key)}
                            icon={
                                selected && replaceable ? (
                                    <Badge variant="standard" color="secondary" badgeContent={<AutorenewIcon sx={{ fontSize: "0.875rem" }} />}>
                                        {entry.icon}
                                    </Badge>
                                ) : (
                                    <Box sx={{ color: "inherit", display: "inline-flex" }}>{entry.icon}</Box>
                                )
                            }
                        />
                    );
                })}
            </BottomBar>
            <Divider sx={{ my: 3 }} />

            <Button
                variant="contained"
                fullWidth
                size="small"
                onClick={() => {
                    setSettings({ bottomNav: config });
                    setMessage({ type: "success", text: `${t("global.saved")}!` });
                }}
            >
                {t("global.save")}
            </Button>
            {isCustom && (
                <Button
                    sx={{ mt: 3 }}
                    color="error"
                    variant="outlined"
                    fullWidth
                    size="small"
                    onClick={() => {
                        setSettings({ bottomNav: DEFAULT_BOTTOM_NAV });
                        setConfig(DEFAULT_BOTTOM_NAV);
                        setSelected(null);
                        setMessage({ type: "success", text: `${t("global.restored")}!` });
                    }}
                >
                    {t("global.restoreDefault")}
                </Button>
            )}
            {message && (
                <Alert severity={message.type} sx={{ mt: 2 }}>
                    <AlertTitle>{message.text}</AlertTitle>
                </Alert>
            )}
        </div>
    );
};
