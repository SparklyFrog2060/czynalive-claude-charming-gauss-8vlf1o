import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import {
    Box,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputAdornment,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemSecondaryAction,
    ListItemText,
    Radio,
    RadioGroup,
    Skeleton,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useCity } from "@/api/cities";
import { ERouteTuple } from "@/api/types";
import { useApi } from "@/api/useApi";
import { PageHeader, PageTemplate } from "@/components/PageHeader";
import { ShowMoreButton } from "@/components/ShowMoreButton";
import { brigadeKey, fetchCityBrigades, fetchLiveBrigades, type CityBrigade, type LiveBrigadeRow } from "@/components/brigades/data";
import { DATE_PARAM, DateTabs, useBrigadeDate } from "@/components/brigades/DateTabs";
import { filterBrigades, type BrigadeSearchType } from "@/components/brigades/search";
import { ShareLink } from "@/components/brigades/ShareButton";
import { VehicleTypeIcon } from "@/components/brigades/VehicleTypeIcon";
import { parseVehicleId } from "@/lib/transit";
import { useSettings } from "@/store/settings";

const SEARCH_FORMATS: Record<BrigadeSearchType, { format: string; caption: string; placeholder: string }> = {
    "ROUTE_ID/BRIGADE": {
        format: "brigadeScheduleList.searchFormatLineBrigade",
        caption: "brigadeScheduleList.searchCaptionLineBrigade",
        placeholder: "brigadeScheduleList.searchLineBrigade",
    },
    "BRIGADE/ROUTE_ID": {
        format: "brigadeScheduleList.searchFormatBrigadeLine",
        caption: "brigadeScheduleList.searchCaptionBrigadeLine",
        placeholder: "brigadeScheduleList.searchBrigadeLine",
    },
};

export const brigadeUrl = (city: string, routeId: string, brigade: string, multi: boolean, date?: number) =>
    `/${city}/${multi ? "laczony-rozklad-jazdy-brygady" : "rozklad-jazdy-brygady"}/linia/${encodeURIComponent(routeId)}/brygada/${encodeURIComponent(brigade)}` +
    (date ? `?${DATE_PARAM}=${date}` : "");

const BrigadeLabel = ({ item, type }: { item: CityBrigade; type: BrigadeSearchType }) => {
    const { t } = useTranslation();
    const line = item.route[ERouteTuple.routeName];
    return type === "ROUTE_ID/BRIGADE" ? (
        <>
            {t("global.route_id")} <strong>{line}</strong>, {t("global.brigade")} <strong>{item.brigade}</strong>{" "}
            <small>
                ({line}/{item.brigade})
            </small>
        </>
    ) : (
        <>
            {t("global.brigade")} <strong>{item.brigade}</strong>, {t("global.route_id")} <strong>{line}</strong>{" "}
            <small>
                ({item.brigade}/{line})
            </small>
        </>
    );
};

const DESCRIPTION_COLLAPSED = {
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 1,
    whiteSpace: "pre-wrap",
    lineHeight: "34px",
} as const;

const LIST_STEP = 100;

const BrigadeSkeleton = () => (
    <Box>
        {[0, 1, 2].map((index) => (
            <Skeleton key={index} animation="wave" variant="text" sx={{ mb: 2, width: "100%", height: "50px" }} />
        ))}
    </Box>
);

export default function BrigadeListPage({ multi = false }: { multi?: boolean }) {
    const { city = "" } = useParams();
    const cityInfo = useCity(city);
    const { t } = useTranslation();
    const theme = useTheme();
    const desktop = useMediaQuery(theme.breakpoints.up("md"));
    const [settings, setSettings] = useSettings();
    const searchType = settings.brigadeSearchType ?? "ROUTE_ID/BRIGADE";
    const [query, setQuery] = useState("");
    const [formatOpen, setFormatOpen] = useState(false);
    const [descriptionOpen, setDescriptionOpen] = useState(false);
    const [limit, setLimit] = useState(LIST_STEP);
    const { dates, selected, setDate, isToday, loading: datesLoading, error: datesError } = useBrigadeDate(city);

    const brigades = useApi((signal) => fetchCityBrigades(city, selected, signal), [city, selected]);
    const live = useApi(isToday ? (signal) => fetchLiveBrigades(city, signal) : null, [city, isToday], 30000);

    const liveByBrigade = useMemo(() => {
        const map = new Map<string, LiveBrigadeRow[]>();
        for (const row of live.data ?? []) {
            const key = brigadeKey(row[1], row[2]);
            map.set(key, [...(map.get(key) ?? []), row]);
        }
        return map;
    }, [live.data]);

    const source = brigades.data?.brigades ?? [];
    const results = useMemo(() => filterBrigades(source, query, searchType), [source, query, searchType]);

    const title = t(multi ? "brigadeScheduleList.brigadeScheduleMulti" : "brigadeScheduleList.brigadeSchedule");
    const cityName = cityInfo?.name ?? city;
    const format = SEARCH_FORMATS[searchType];

    return (
        <PageTemplate title={`${cityName} - ${title}`} padding>
            <PageHeader
                documentTitle={`${t(multi ? "brigadeScheduleList.pageTitleMultiBrigadeList" : "brigadeScheduleList.pageTitleBrigadeList")} - ${cityName}`}
            />
            {multi ? (
                <Typography variant="h5" gutterBottom>
                    {t("brigadeScheduleList.descriptionMulti")} {cityName}.
                </Typography>
            ) : (
                <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Box style={descriptionOpen ? { display: "flex" } : DESCRIPTION_COLLAPSED} sx={{ flexDirection: "column" }}>
                        <Typography variant="h5" gutterBottom>
                            {t("brigadeScheduleList.description")} {cityName}.
                        </Typography>
                        <ShareLink title={`${t("brigadeScheduleList.description")} ${cityName}`} />
                    </Box>
                    <ShowMoreButton expanded={descriptionOpen} onClick={() => setDescriptionOpen((open) => !open)} />
                </Box>
            )}

            {datesLoading && !dates.length ? (
                <BrigadeSkeleton />
            ) : datesError && !dates.length ? (
                <Typography variant="body2">{t("global.error")}</Typography>
            ) : (
                <Box sx={{ pb: 2 }}>
                    <DateTabs dates={dates} selected={selected} onChange={(date) => (setDate(date), setLimit(LIST_STEP))} />
                    {brigades.loading && !brigades.data ? (
                        <BrigadeSkeleton />
                    ) : brigades.error ? (
                        <Typography variant="body2" noWrap sx={{ margin: "10px 0" }}>
                            {t("global.error")}
                        </Typography>
                    ) : !source.length ? (
                        <Typography variant="subtitle2" noWrap sx={{ margin: "10px 0" }}>
                            {t("global.nothingFound")}
                        </Typography>
                    ) : (
                        <div>
                            <div>
                                <form autoComplete="off" noValidate onSubmit={(event) => event.preventDefault()}>
                                    <TextField
                                        label={t("brigadeScheduleList.searchLabel")}
                                        placeholder={t(format.placeholder)}
                                        margin="normal"
                                        type="search"
                                        value={query}
                                        variant="outlined"
                                        onChange={(event) => (setQuery(event.target.value), setLimit(LIST_STEP))}
                                        onFocus={() => window.scrollTo({ top: 0, behavior: "auto" })}
                                        size="small"
                                        fullWidth
                                        slotProps={{
                                            input: {
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        {query !== "" && (
                                                            <IconButton aria-label="clear" size="small" onClick={() => setQuery("")}>
                                                                <CloseIcon fontSize="small" />
                                                            </IconButton>
                                                        )}
                                                        <IconButton type="submit" edge="end" size="small">
                                                            <SearchIcon />
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            },
                                            inputLabel: { shrink: true },
                                        }}
                                    />
                                </form>
                                <div>
                                    <Box onClick={() => setFormatOpen((open) => !open)} sx={{ display: "flex", alignItems: "center" }}>
                                        <Typography variant="body2">
                                            {t("global.searchFormat")}: <strong>{t(format.format)}</strong>
                                        </Typography>
                                        <ShowMoreButton expanded={formatOpen} onClick={() => setFormatOpen((open) => !open)} />
                                    </Box>
                                    {formatOpen && (
                                        <Box sx={{ display: "flex", flexDirection: "column" }}>
                                            <FormControl>
                                                <RadioGroup row value={searchType} onChange={(event) => setSettings({ brigadeSearchType: event.target.value as BrigadeSearchType })}>
                                                    {(Object.keys(SEARCH_FORMATS) as BrigadeSearchType[]).map((key) => (
                                                        <FormControlLabel
                                                            key={key}
                                                            value={key}
                                                            control={<Radio size="small" />}
                                                            label={<Typography variant="caption">{t(SEARCH_FORMATS[key].format)}</Typography>}
                                                        />
                                                    ))}
                                                </RadioGroup>
                                            </FormControl>
                                            <Typography variant="caption" gutterBottom>
                                                <Trans i18nKey={format.caption} components={[<strong key="0" />]} />
                                            </Typography>
                                        </Box>
                                    )}
                                </div>
                            </div>
                            <Divider sx={{ margin: "10px 0" }} />
                            <Typography variant="h5" gutterBottom>
                                {t("brigadeScheduleList.linesBrigadesList")}:
                            </Typography>
                            <Typography variant="subtitle2" noWrap sx={{ margin: "10px 0" }}>
                                {results.length === 0 ? t("global.nothingFound") : `${t("global.found")} ${t("plural.result", { count: results.length })}.`}
                            </Typography>
                            <List dense>
                                <Box
                                    sx={{ height: 400, overflowY: "auto" }}
                                    onScroll={(event) => {
                                        const box = event.currentTarget;
                                        if (box.scrollTop + box.clientHeight > box.scrollHeight - 400 && limit < results.length) setLimit((value) => value + LIST_STEP);
                                    }}
                                >
                                    {results.slice(0, limit).map((item, index) => {
                                        const routeId = item.route[ERouteTuple.routeId];
                                        const vehicles = liveByBrigade.get(brigadeKey(routeId, item.brigade));
                                        const vehicleText = vehicles?.map((row) => parseVehicleId(row[0]).number).join(", ");
                                        const operated = vehicleText ? (
                                            <Typography variant="caption" component="span">
                                                {desktop ? " - " : ""}
                                                {t("global.operatedByVehicle")}: <strong>#{vehicleText}</strong>
                                            </Typography>
                                        ) : null;
                                        return (
                                            <div key={`${routeId}-${item.brigade}`} style={{ marginBottom: index === results.length - 1 ? 80 : "initial" }}>
                                                <ListItemButton
                                                    dense
                                                    divider
                                                    alignItems="center"
                                                    component={Link}
                                                    to={brigadeUrl(city, routeId, item.brigade, multi, isToday ? undefined : selected)}
                                                >
                                                    <ListItemIcon sx={{ minWidth: 56 }}>
                                                        <VehicleTypeIcon type={item.route[ERouteTuple.routeType]} size={35} />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={
                                                            <Typography variant="body2">
                                                                <BrigadeLabel item={item} type={searchType} />
                                                                {desktop && operated}
                                                            </Typography>
                                                        }
                                                        secondary={!desktop && operated}
                                                    />
                                                    <ListItemSecondaryAction>
                                                        <IconButton edge="end" aria-label="navigate" size="small">
                                                            <ChevronRightIcon />
                                                        </IconButton>
                                                    </ListItemSecondaryAction>
                                                </ListItemButton>
                                            </div>
                                        );
                                    })}
                                </Box>
                            </List>
                        </div>
                    )}
                </Box>
            )}
        </PageTemplate>
    );
}
