import { Box, Button, Divider, Tab, Tabs, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useCity } from "@/api/cities";
import { cityGet } from "@/api/client";
import { ERouteTuple, EStopTuple, type RouteTuple, type StopTuple } from "@/api/types";
import { useApi } from "@/api/useApi";
import { loadWstRoutes } from "@/api/wst";
import { PageHeader, PageTemplate } from "@/components/PageHeader";
import { ExpandableText, RouteGrid, routeLink, ShareUrl, sortRoutes, sortTypes, stopLink, TypeFilter, typeReadableKey, uniqueRoutes, useThemeMode, useUrlTab, agencyNameOf } from "@/components/timetable/common";
import { SearchStatus, StopList, StopSearchField, useDebounced, useStopSearch } from "@/components/timetable/StopSearch";
import { useRecentStops } from "@/components/timetable/recentStops";
import { LineSearchField } from "@/components/timetable/SearchField";

const TABS = ["route_id", "stop"] as const;

const TabPanel = ({ value, index, children }: { value: string; index: string; children: React.ReactNode }) => (
    <div role="tabpanel" hidden={value !== index} id={`tabpanel-${index}`} aria-labelledby={`tabpanel-${index}`}>
        {value === index && <Box sx={{ p: 0 }}>{children}</Box>}
    </div>
);

const RoutesTab = ({ city, routes }: { city: string; routes: RouteTuple[] }) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const [type, setType] = useState<number | null>(null);
    const sorted = useMemo(() => uniqueRoutes(sortRoutes(routes)), [routes]);
    const types = useMemo(() => sortTypes(sorted.map((route) => route[ERouteTuple.routeType])), [sorted]);
    const filtered = useMemo(() => {
        const needle = query.toUpperCase();
        if (!needle && type === null) return sorted;
        return sorted.filter((route) => (type === null || route[ERouteTuple.routeType] === type) && route[ERouteTuple.routeName].toUpperCase().includes(needle));
    }, [sorted, query, type]);

    return (
        <div>
            <LineSearchField value={query} onChange={setQuery} headerLabel={`${t("map.filterSearchLine")}:`} />
            {types.length > 1 && <TypeFilter types={types} selected={type} onToggle={(value) => setType((prev) => (prev === value ? null : value))} />}
            <Divider sx={{ my: 2 }} />
            {filtered.length === 0 ? (
                <Typography variant="subtitle2" noWrap sx={{ mt: 2, mx: 0 }}>
                    {t("global.nothingFound")}
                </Typography>
            ) : (
                <RouteGrid routes={filtered} linkFor={(route) => routeLink(city, route[ERouteTuple.routeId], route[ERouteTuple.city])} />
            )}
        </div>
    );
};

const StopsTab = ({ city }: { city: string }) => {
    const { t } = useTranslation();
    const [input, setInput] = useState("");
    const query = useDebounced(input, 500);
    const { results, loading, error } = useStopSearch(city, query);
    const { recent, add, clear } = useRecentStops(city);
    const dark = useThemeMode() === "dark";
    const linkFor = (stop: StopTuple) => stopLink(city, stop[EStopTuple.stopId], undefined, stop[EStopTuple.city]);

    return (
        <div>
            <div>
                <Typography variant="subtitle2" noWrap style={{ margin: "10px 0 5px" }}>
                    {t("favourites.searchStop")}:
                </Typography>
                <StopSearchField value={input} onChange={setInput} />
                <SearchStatus query={query} loading={loading} error={error} empty={!!results && results.length === 0} />
            </div>
            {!loading && results && results.length > 0 && (
                <>
                    <Typography variant="subtitle2" noWrap style={{ margin: "10px 0 5px" }}>
                        {t("global.searchResults")}:
                    </Typography>
                    <StopList stops={results} linkFor={linkFor} onSelect={add} query={query} style={{ marginBottom: 65 }} />
                </>
            )}
            {!results && !loading && recent.length > 0 && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="subtitle2" noWrap style={{ margin: "10px 0 5px" }}>
                            {t("timetables.lastChosen")}:
                        </Typography>
                        <Button size="small" color="primary" variant={dark ? "contained" : "outlined"} onClick={clear}>
                            {t("global.clear")}
                        </Button>
                    </div>
                    <StopList stops={recent} linkFor={linkFor} onSelect={add} style={{ overflowY: "auto", maxHeight: "calc(100dvh - 52px - 104px - 48px - 120px)" }} />
                </div>
            )}
        </div>
    );
};

export default function TimetableIndexPage() {
    const { city = "" } = useParams();
    const cityInfo = useCity(city);
    const { t } = useTranslation();
    const [tab, setTab] = useUrlTab("tab", TABS, "route_id");
    const routes = useApi(
        (signal) =>
            cityGet<RouteTuple[]>(city, "/routes", undefined, signal).then(async (apiRoutes) => {
                if (city !== "krakow") return apiRoutes;
                const wstRoutes = await loadWstRoutes(signal).catch(() => []);
                return [...apiRoutes, ...wstRoutes];
            }),
        [city],
    );
    const agencyName = agencyNameOf(city, cityInfo);
    const typeNames = useMemo(() => sortTypes((routes.data ?? []).map((route) => route[ERouteTuple.routeType])).map((type) => t(typeReadableKey(type))), [routes.data, t]);
    const title = `${t("timetables.pageTitleMain")} ${agencyName}${typeNames.length ? ` - ${typeNames.join(", ")}` : ""}`;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <PageTemplate title={title} padding>
            <PageHeader documentTitle={`${t("timetables.pageTitleMain")} ${typeNames.join(", ")} - ${agencyName}`} />
            <Box sx={{ display: "flex", alignItems: "flex-start", flexDirection: "column" }}>
                <ExpandableText>
                    <Typography variant="caption">
                        <Trans i18nKey="timetables.mainDescriptionPart1" values={{ agencyName }} components={[<strong key="1" />]} />
                    </Typography>
                    <Typography variant="caption">
                        <Trans i18nKey="timetables.mainDescriptionPart2" components={[<strong key="1" />]} />
                    </Typography>
                </ExpandableText>
                <ShareUrl text={`${cityInfo?.name ?? city} ${t("timetables.shareUrlDescription")}`} />
            </Box>
            {!routes.data && !routes.error ? (
                <Typography sx={{ mt: 3 }} variant="h5" gutterBottom>
                    {t("global.loading")}...
                </Typography>
            ) : routes.error ? (
                <Box style={{ padding: "0 0 80px" }}>
                    <Typography variant="body1">{t("global.error")}</Typography>
                </Box>
            ) : (
                <Box style={{ padding: "0 0 80px" }}>
                    <Box sx={{ my: 2 }}>
                        <Tabs
                            value={tab}
                            onChange={(_, value) => setTab(value)}
                            indicatorColor="primary"
                            textColor="primary"
                            variant="fullWidth"
                            scrollButtons="auto"
                            allowScrollButtonsMobile
                        >
                            <Tab value="route_id" label={t("global.route_ids")} />
                            <Tab value="stop" label={t("global.stops")} />
                        </Tabs>
                        <Box sx={{ my: 2 }}>
                            <TabPanel value={tab} index="route_id">
                                <RoutesTab city={city} routes={routes.data ?? []} />
                            </TabPanel>
                            <TabPanel value={tab} index="stop">
                                <StopsTab city={city} />
                            </TabPanel>
                        </Box>
                    </Box>
                </Box>
            )}
        </PageTemplate>
    );
}
