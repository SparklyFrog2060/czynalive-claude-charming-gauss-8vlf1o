import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import {
    Box,
    Divider,
    IconButton,
    InputAdornment,
    List,
    ListItemButton,
    ListItemSecondaryAction,
    ListItemText,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import { Fragment, useEffect, useMemo, useState, type MouseEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useCities } from "@/api/cities";
import { PageHeader, PageTemplate } from "@/components/PageHeader";
import { haversineMeters } from "@/lib/transit";
import { useSettings } from "@/store/settings";

const DETECTED_CITY_RADIUS_KM = 25;

const normalize = (text: string) =>
    text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/ł/g, "l");

const LocationDot = () => (
    <div className="city-location-dot">
        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="7" style={{ stroke: "var(--white)", strokeWidth: 3, fill: "#2A93EE", fillOpacity: 1, opacity: 1 }} />
        </svg>
    </div>
);

type Entry = { city: string; readableName: string; distanceKm: number | null };

export default function ChooseCityPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { cities } = useCities();
    const [settings, setSettings] = useSettings();
    const [query, setQuery] = useState("");
    const [sortMode, setSortMode] = useState<"alpha" | "distance">("alpha");
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

    useEffect(() => {
        if (!navigator.geolocation || !navigator.permissions) return;
        navigator.permissions
            .query({ name: "geolocation" })
            .then((status) => {
                if (status.state !== "granted") return;
                navigator.geolocation.getCurrentPosition((position) => setUserLocation([position.coords.longitude, position.coords.latitude]), () => {}, {
                    maximumAge: 600000,
                });
            })
            .catch(() => {});
    }, []);

    const isVirtual = (city: { category: string; virtual?: unknown }) => city.category === "virtual" || !!city.virtual;

    const citiesWithDistance: Entry[] = useMemo(
        () =>
            cities
                .map((city) => ({
                    city: city.id,
                    readableName: city.name,
                    // Virtual cities (PKP, Flixbus, …) span the country: no distance, never "detected".
                    distanceKm: userLocation && !isVirtual(city) ? Math.round(haversineMeters(userLocation, city.location) / 1000) : null,
                }))
                .sort((a, b) => a.readableName.localeCompare(b.readableName, "pl")),
        [cities, userLocation],
    );

    const filteredCities = useMemo(() => {
        const needle = normalize(query.trim());
        const list = needle ? citiesWithDistance.filter(({ city, readableName }) => normalize(readableName).includes(needle) || normalize(city).includes(needle)) : citiesWithDistance;
        return sortMode === "distance" && userLocation ? [...list].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)) : list;
    }, [citiesWithDistance, query, sortMode, userLocation]);

    const nearest = userLocation ? [...citiesWithDistance].filter((entry) => entry.distanceKm !== null).sort((a, b) => a.distanceKm! - b.distanceKm!)[0] : undefined;
    const detectedCity = nearest && (nearest.distanceKm ?? Infinity) <= DETECTED_CITY_RADIUS_KM ? nearest.city : null;
    const detectedEntry = citiesWithDistance.find((entry) => entry.city === detectedCity) ?? null;
    const showDetectedBanner = detectedCity !== null && detectedCity !== settings.city && sortMode !== "distance" && filteredCities.some((entry) => entry.city === detectedCity);

    const choose = (event: MouseEvent, city: string) => {
        event.preventDefault();
        setSettings({ city });
        navigate(`/${city}`);
    };

    const row = ({ city, readableName, distanceKm }: Entry, showDot: boolean) => (
        <Fragment key={`${city}-row`}>
            <ListItemButton component="a" href={`/${city}`} onClick={(event: MouseEvent) => choose(event, city)} sx={{ px: 0.5 }}>
                {showDot && (
                    <Box sx={{ display: "flex", alignItems: "center", mr: 1 }}>
                        <LocationDot />
                    </Box>
                )}
                <ListItemText
                    primary={
                        <>
                            {readableName}
                            {sortMode === "distance" && !showDot && distanceKm !== null && (
                                <Typography component="span" sx={{ fontSize: "0.875rem", color: "text.secondary", ml: 0.75 }}>
                                    ({distanceKm} km)
                                </Typography>
                            )}
                        </>
                    }
                    slotProps={{ primary: { sx: { lineHeight: 1.2 } } }}
                />
                <ListItemSecondaryAction sx={{ right: "6px" }}>
                    <IconButton edge="end" aria-label="navigate" size="small">
                        <ChevronRightIcon />
                    </IconButton>
                </ListItemSecondaryAction>
            </ListItemButton>
            <Divider />
        </Fragment>
    );

    return (
        <PageTemplate title={t("chooseCity.chooseCity")} padding>
            <PageHeader documentTitle={t("chooseCity.pageTitle")} />
            <Box sx={{ display: "flex", justifyContent: "space-between", flexDirection: "column" }}>
                <div>
                    <Typography variant="h4">
                        <Trans i18nKey="chooseCity.chooseCityHeader" components={[<strong key="0" />]} />:
                    </Typography>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder={t("chooseCity.search")}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        sx={{ mt: 1, mb: 1 }}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                                endAdornment: query ? (
                                    <InputAdornment position="end">
                                        <IconButton aria-label="clear" size="small" onClick={() => setQuery("")}>
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ) : undefined,
                            },
                        }}
                    />
                    {userLocation && (
                        <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
                            <ToggleButtonGroup
                                value={sortMode}
                                exclusive
                                size="small"
                                color="primary"
                                onChange={(_, value) => value && setSortMode(value)}
                                sx={{ "& .MuiToggleButton-root": { py: 0.25, fontSize: "0.875rem" } }}
                            >
                                <ToggleButton value="alpha">{t("chooseCity.sortAlpha")}</ToggleButton>
                                <ToggleButton value="distance">{t("chooseCity.sortDistance")}</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    )}
                    {showDetectedBanner && detectedEntry && (
                        <>
                            <Typography variant="overline" sx={{ px: 1, color: "text.secondary", display: "block", lineHeight: 1.6 }}>
                                {t("chooseCity.yourLocation")}
                            </Typography>
                            <List component="nav" disablePadding>
                                {row(detectedEntry, true)}
                            </List>
                        </>
                    )}
                    <Typography variant="overline" sx={{ px: 1, color: "text.secondary", mt: 1.5, display: "block", lineHeight: 1.6 }}>
                        {t("chooseCity.allCities")}
                    </Typography>
                    <List component="nav" disablePadding>
                        {filteredCities.map((entry) => row(entry, entry.city === detectedCity))}
                    </List>
                </div>
            </Box>
        </PageTemplate>
    );
}
