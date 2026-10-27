import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import CodeIcon from "@mui/icons-material/Code";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import EventNoteIcon from "@mui/icons-material/EventNote";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import GetAppIcon from "@mui/icons-material/GetApp";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import GpsOffIcon from "@mui/icons-material/GpsOff";
import LinkIcon from "@mui/icons-material/Link";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PlaceIcon from "@mui/icons-material/Place";
import RemoveIcon from "@mui/icons-material/Remove";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import {
    Alert,
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    Divider,
    FormControlLabel,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Skeleton,
    Snackbar,
    Stack,
    Switch,
    Tab,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCities, useCity } from "@/api/cities";
import { cityGet } from "@/api/client";
import { EDeparture, ERouteTuple, EStopDepartureTuple, EStopTuple, ETripTuple, EVehiclePosition, type RouteTuple, type StopTuple, type VehiclePosition } from "@/api/types";
import { useApi } from "@/api/useApi";
import { fetchCityAlerts } from "@/components/alerts/api";
import { DepartureRow, VehicleExtrasContext } from "@/components/departures/DepartureRow";
import { useNow } from "@/components/departures/departureUtils";
import { DelayChip, ListRow, RouteNameBadge, ShowMoreButton, VehicleTypeChip } from "@/components/departures/parts";
import { useDepartureVehicles } from "@/components/departures/useDepartureVehicles";
import { vehicleTypeName } from "@/components/departures/VehicleTypeIcon";
import { useStopDepartures } from "@/components/departures/useStopDepartures";
import { PageHeader, PageTemplate } from "@/components/PageHeader";
import { RouteButton, ShareIconAuto, sortRoutes, uniqueRoutes, useShare, agencyNameOf } from "@/components/timetable/common";
import { LineSearchField } from "@/components/timetable/SearchField";
import { SearchStatus, StopItemContent, StopSearchField, useDebounced, useStopSearch } from "@/components/timetable/StopSearch";
import { useRouteVehicles } from "@/components/timetable/useRouteVehicles";
import { parseVehicleId } from "@/lib/transit";
import {
    GROUP_NAME_LIMITS,
    groupItems,
    isValidGroupName,
    itemKey,
    useFavouriteGroups,
    type FavouriteGroup,
    type FavouriteItem,
    type FavouriteRouteData,
    type FavouriteStopData,
    type FavouriteVehicleData,
} from "@/store/favouriteGroups";
import { useSettings } from "@/store/settings";
import Grid from "@mui/material/Grid2";

const ExtrasContext = VehicleExtrasContext;
const useExtras = () => useContext(ExtrasContext) ?? {};

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

type UpdateGroup = (update: (group: FavouriteGroup) => FavouriteGroup) => void;

const SHARED_PARAM = "sharedGroup";
const MAX_URL_LENGTH = 2000;
const SEPARATOR = "::";
const CLAMP = { overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 1, whiteSpace: "pre-wrap", lineHeight: "34px" } as const;

const newGroup = (): FavouriteGroup => ({ id: Date.now(), name: "", items: [], expanded: true });

const useToast = () => {
    const [message, setMessage] = useState<string>();
    const node = <Snackbar open={!!message} autoHideDuration={3000} onClose={() => setMessage(undefined)} message={message} />;
    return { toast: setMessage, node };
};

const DialogHeader = ({ title, onClose }: { title: string; onClose: () => void }) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="subtitle1" sx={{ py: 1, px: 2 }}>
            {title}
        </Typography>
        <IconButton onClick={onClose} size="large">
            <CloseIcon />
        </IconButton>
    </Box>
);

const typeLabelKey = (type: FavouriteItem["favouriteType"]) => (type === "vehicle" ? "global.vehicle" : type === "stop" ? "global.stop" : "global.route_id");

const itemName = (item: FavouriteItem) => (item.favouriteType === "route_id" ? item.data.route_id : item.favouriteType === "stop" ? item.data.stop_name : `#${item.data.vehicleNo}`);

// Share link / code of a group, same encodings as the original.
const shareUrl = (group: FavouriteGroup, city: string) => {
    const payload = {
        n: group.name,
        c: city,
        i: group.items.map((item) =>
            item.favouriteType === "stop"
                ? `s${SEPARATOR}${item.data.stop_id}${SEPARATOR}${item.data.stop_name}`
                : item.favouriteType === "route_id"
                  ? `r${SEPARATOR}${item.data.type[0]}${SEPARATOR}${item.data.routeId}`
                  : `v${SEPARATOR}${item.data.id}`,
        ),
    };
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set(SHARED_PARAM, JSON.stringify(payload));
    return url.toString();
};

const groupCode = (group: FavouriteGroup, city: string) => JSON.stringify({ name: group.name, items: group.items, city });

type ImportedGroup = { name: string; city: string; items: FavouriteItem[] };

const parseCode = (text: string, city: string): { group?: ImportedGroup; wrongCity?: string } => {
    try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.name !== "string" || !Array.isArray(parsed?.items)) return {};
        if (typeof parsed.city === "string" && parsed.city !== city) return { wrongCity: parsed.city };
        const items = (parsed.items as FavouriteItem[]).filter((item) => item && ["stop", "route_id", "vehicle"].includes(item.favouriteType) && typeof item.data?.id === "string");
        if (!parsed.name.trim() || items.length === 0) return {};
        return { group: { name: parsed.name, city, items } };
    } catch {
        return {};
    }
};

// Decodes ?sharedGroup=… (short item codes) into a group; routes and stops are looked up for their names and types.
const decodeShared = async (raw: string, city: string): Promise<{ group?: ImportedGroup; wrongCity?: string; name?: string }> => {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.c !== "string") throw new Error("invalid");
    if (parsed.c !== city) return { wrongCity: parsed.c, name: typeof parsed.n === "string" ? parsed.n : "" };
    const routes = await cityGet<RouteTuple[]>(city, "/routes");
    const items: FavouriteItem[] = [];
    for (const code of (parsed.i ?? []) as string[]) {
        const parts = code.split(SEPARATOR);
        if (parts[0] === "s" && parts[1]) {
            const meta = await cityGet<{ stop: StopTuple }>(city, `/stops/${encodeURIComponent(parts[1])}/meta`).catch(() => null);
            if (!meta) continue;
            items.push({ favouriteType: "stop", data: { id: parts[1], stop_id: parts[1], stop_name: parts[2] ?? meta.stop[EStopTuple.stopName], type: meta.stop[EStopTuple.vehicleTypes] } });
        } else if (parts[0] === "r") {
            const route = routes.find((entry) => entry[ERouteTuple.routeId] === parts[2] && String(entry[ERouteTuple.routeType]) === parts[1]);
            if (!route) continue;
            items.push({ favouriteType: "route_id", data: routeData(route) });
        } else if (parts[0] === "v" && parts[1]) {
            const { number, type } = parseVehicleId(parts[1]);
            items.push({ favouriteType: "vehicle", data: { id: parts[1], vehicleNo: number, type: [type] } });
        }
    }
    if (!items.length) throw new Error("invalid");
    return { group: { name: parsed.n || "", city, items } };
};

const routeData = (route: RouteTuple): FavouriteRouteData => ({
    id: `${route[ERouteTuple.routeType]}/${route[ERouteTuple.routeId]}`,
    route_id: route[ERouteTuple.routeName],
    routeId: route[ERouteTuple.routeId],
    type: [route[ERouteTuple.routeType]],
    city: route[ERouteTuple.city],
    color: route[ERouteTuple.routeColor],
});

const PageDescription = ({ agencyName }: { agencyName: string }) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const { share, snackbar } = useShare();
    return (
        <Box sx={{ display: "flex", alignItems: "center" }}>
            <Box style={expanded ? { display: "flex" } : CLAMP} sx={{ flexDirection: "column" }}>
                <div>
                    <Typography variant="caption" gutterBottom>
                        {t("favourites.description")}
                    </Typography>
                </div>
                <Typography variant="caption" data-nosnippet>
                    {t("global.shareUrl")}:
                    <IconButton size="small" color="primary" onClick={() => share(`${agencyName} - ${t("favourites.pageTitle")}`)}>
                        <ShareIconAuto fontSize="small" />
                    </IconButton>
                </Typography>
            </Box>
            <ShowMoreButton expanded={expanded} onClick={() => setExpanded((value) => !value)} />
            {snackbar}
        </Box>
    );
};

const EmptyState = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 6, px: 2, textAlign: "center" }}>
        <FolderOpenIcon sx={{ fontSize: "4rem", color: "text.secondary", mb: 2 }} />
        <Typography variant="h6" gutterBottom sx={{ color: "text.secondary" }}>
            {title}
        </Typography>
        {subtitle && (
            <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 400 }}>
                {subtitle}
            </Typography>
        )}
    </Box>
);

const StopsPicker = ({ city, group, onUpdateGroup }: { city: string; group: FavouriteGroup; onUpdateGroup: UpdateGroup }) => {
    const { t } = useTranslation();
    const [input, setInput] = useState("");
    const query = useDebounced(input, 500);
    const { results, loading, error } = useStopSearch(city, query);
    const toggle = (stop: StopTuple) => {
        const id = stop[EStopTuple.stopId];
        onUpdateGroup((current) =>
            current.items.some((item) => item.favouriteType === "stop" && item.data.id === id)
                ? { ...current, items: current.items.filter((item) => item.favouriteType !== "stop" || item.data.id !== id) }
                : {
                      ...current,
                      items: [
                          ...current.items,
                          { favouriteType: "stop", data: { id, stop_id: id, stop_name: stop[EStopTuple.stopName], type: stop[EStopTuple.vehicleTypes], city: stop[EStopTuple.city] } },
                      ],
                  },
        );
    };
    return (
        <Box>
            <Typography variant="subtitle2" noWrap style={{ margin: "10px 0 5px" }}>
                {t("favourites.searchAndAddFavouriteStops")}:
            </Typography>
            <StopSearchField value={input} onChange={setInput} />
            <SearchStatus query={query} loading={loading} error={error} empty={!!results && results.length === 0} />
            {loading && (
                <div style={{ margin: 10 }}>
                    {[0, 1, 2].map((index) => (
                        <Skeleton key={index} animation="wave" variant="text" height={50} width="100%" style={{ marginBottom: 5 }} />
                    ))}
                </div>
            )}
            {!loading && results && results.length > 0 && (
                <div>
                    <Typography variant="subtitle2" noWrap style={{ margin: "10px 0 5px" }}>
                        {t("global.searchResults")}:
                    </Typography>
                    <List style={{ marginBottom: 65 }}>
                        {results.map((stop) => {
                            const active = group.items.some((item) => item.favouriteType === "stop" && item.data.id === stop[EStopTuple.stopId]);
                            return (
                                <ListRow
                                    key={`${stop[EStopTuple.city]}/${stop[EStopTuple.stopId]}`}
                                    column
                                    onClick={() => toggle(stop)}
                                    trailing={<IconButton size="large">{active ? <RemoveIcon /> : <AddIcon />}</IconButton>}
                                >
                                    <StopItemContent stop={stop} query={query} />
                                </ListRow>
                            );
                        })}
                    </List>
                </div>
            )}
        </Box>
    );
};

const LinesPicker = ({ city, group, onUpdateGroup }: { city: string; group: FavouriteGroup; onUpdateGroup: UpdateGroup }) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const routes = useApi((signal) => cityGet<RouteTuple[]>(city, "/routes", undefined, signal), [city]);
    const sorted = useMemo(() => uniqueRoutes(sortRoutes(routes.data ?? [])), [routes.data]);
    const filtered = useMemo(() => (query ? sorted.filter((route) => route[ERouteTuple.routeName].toUpperCase().includes(query.toUpperCase())) : sorted), [sorted, query]);
    const selected = new Set(group.items.filter((item) => item.favouriteType === "route_id").map((item) => item.data.id));
    const toggle = (route: RouteTuple) => {
        const data = routeData(route);
        onUpdateGroup((current) =>
            current.items.some((item) => item.favouriteType === "route_id" && item.data.id === data.id)
                ? { ...current, items: current.items.filter((item) => item.favouriteType !== "route_id" || item.data.id !== data.id) }
                : { ...current, items: [...current.items, { favouriteType: "route_id", data }] },
        );
    };
    return (
        <Box>
            <LineSearchField value={query} onChange={setQuery} headerLabel={`${t("favourites.addRouteId")}:`} placeholder="favourites.searchRouteId" />
            <Divider sx={{ my: 2 }} />
            {filtered.length === 0 ? (
                <Typography variant="subtitle2" noWrap sx={{ mt: 2, mx: 0 }}>
                    {t("global.nothingFound")}
                </Typography>
            ) : (
                <Grid container spacing={1} sx={{ alignItems: "center" }}>
                    {filtered.map((route) => (
                        <Grid key={`${route[ERouteTuple.routeType]}/${route[ERouteTuple.routeId]}`} size={{ xs: 4, sm: 3, md: 2, lg: 1 }}>
                            <RouteButton route={route} selected={selected.has(routeData(route).id)} onClick={() => toggle(route)} />
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
};

type VehicleSearchRow = [position: VehiclePosition, headsign?: string];

const VehiclesPicker = ({ city, group, onUpdateGroup }: { city: string; group: FavouriteGroup; onUpdateGroup: UpdateGroup }) => {
    const { t } = useTranslation();
    const [input, setInput] = useState("");
    const query = useDebounced(input, 500);
    const [state, setState] = useState<{ results?: VehiclePosition[]; loading: boolean; error?: boolean }>({ loading: false });
    useEffect(() => {
        if (query.trim().length < 1) {
            setState({ loading: false });
            return;
        }
        const controller = new AbortController();
        setState({ loading: true });
        cityGet<(VehiclePosition | VehicleSearchRow)[]>(city, "/positions/search", { query: query.trim() }, controller.signal)
            .then((rows) => setState({ loading: false, results: rows.map((row) => (Array.isArray(row[0]) ? (row as VehicleSearchRow)[0] : (row as VehiclePosition))) }))
            .catch(() => !controller.signal.aborted && setState({ loading: false, error: true }));
        return () => controller.abort();
    }, [city, query]);
    const selected = new Set(group.items.filter((item) => item.favouriteType === "vehicle").map((item) => item.data.id));
    const toggle = (position: VehiclePosition) => {
        const id = position[EVehiclePosition.id];
        const { number } = parseVehicleId(id);
        const data: FavouriteVehicleData = { id, vehicleNo: number, type: [position[EVehiclePosition.route][ERouteTuple.routeType]], city: position[EVehiclePosition.city] };
        onUpdateGroup((current) =>
            selected.has(id)
                ? { ...current, items: current.items.filter((item) => item.favouriteType !== "vehicle" || item.data.id !== id) }
                : { ...current, items: [...current.items, { favouriteType: "vehicle", data }] },
        );
    };
    return (
        <Box>
            <Typography variant="subtitle2" noWrap>
                {t("favourites.addVehicleToFavourites")}:
            </Typography>
            <form autoComplete="off" noValidate onSubmit={(event) => event.preventDefault()}>
                <TextField
                    label={t("global.vehicles")}
                    placeholder={t("favourites.searchVehiclesByVehicleNo")}
                    margin="normal"
                    type="search"
                    value={input}
                    variant="outlined"
                    onChange={(event) => setInput(event.target.value)}
                    size="small"
                    fullWidth
                    autoFocus
                    slotProps={{ inputLabel: { shrink: true } }}
                />
            </form>
            {state.loading && (
                <Typography variant="subtitle2" noWrap style={{ margin: "10px 0 5px" }}>
                    {t("global.searching")}...
                </Typography>
            )}
            {!state.loading && state.results?.length === 0 && (
                <Typography variant="subtitle2" noWrap style={{ margin: "10px 0 5px" }}>
                    {t("global.nothingFound")}
                </Typography>
            )}
            {!state.loading && state.results && state.results.length > 0 && (
                <Box>
                    <Typography variant="subtitle2" noWrap sx={{ my: "10px 0 5px" }}>
                        {t("global.searchResults")}:
                    </Typography>
                    <List dense>
                        {state.results.map((position) => {
                            const id = position[EVehiclePosition.id];
                            const route = position[EVehiclePosition.route];
                            return (
                                <ListItemButton key={id} onClick={() => toggle(position)}>
                                    <ListItemIcon>
                                        <VehicleTypeChip types={[route[ERouteTuple.routeType]]} />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Typography variant="body1">
                                                {t("global.vehicleNoShort")} {parseVehicleId(id).number}
                                            </Typography>
                                        }
                                        secondary={`${t("global.route_id")} ${route[ERouteTuple.routeName]}`}
                                    />
                                    {selected.has(id) ? <RemoveIcon /> : <AddIcon />}
                                </ListItemButton>
                            );
                        })}
                    </List>
                </Box>
            )}
        </Box>
    );
};

const GroupItemsTabs = ({ city, group, onUpdateGroup }: { city: string; group: FavouriteGroup; onUpdateGroup: UpdateGroup }) => {
    const { t } = useTranslation();
    const [tab, setTab] = useState(0);
    const counts = { stop: groupItems(group, "stop").length, route: groupItems(group, "route_id").length, vehicle: groupItems(group, "vehicle").length };
    return (
        <Box>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
                <Tab label={`${t("global.stops")} (${counts.stop})`} />
                <Tab label={`${t("global.lines")} (${counts.route})`} />
                <Tab label={`${t("global.vehicles")} (${counts.vehicle})`} />
            </Tabs>
            <div role="tabpanel" hidden={tab !== 0}>
                {tab === 0 && <StopsPicker city={city} group={group} onUpdateGroup={onUpdateGroup} />}
            </div>
            <div role="tabpanel" hidden={tab !== 1}>
                {tab === 1 && <LinesPicker city={city} group={group} onUpdateGroup={onUpdateGroup} />}
            </div>
            <div role="tabpanel" hidden={tab !== 2}>
                {tab === 2 && <VehiclesPicker city={city} group={group} onUpdateGroup={onUpdateGroup} />}
            </div>
        </Box>
    );
};

const CreateGroupForm = ({ city, onClose, onCreate }: { city: string; onClose: () => void; onCreate: (group: FavouriteGroup) => void }) => {
    const { t } = useTranslation();
    const [group, setGroup] = useState<FavouriteGroup>(newGroup);
    const [touched, setTouched] = useState(false);
    const valid = isValidGroupName(group.name);
    const save = () => {
        if (!valid) return;
        onCreate(group);
        onClose();
    };
    return (
        <Card elevation={2} sx={{ mb: 2, borderRadius: "8px", border: "2px solid", borderColor: "var(--primary)" }}>
            <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="h6">{t("favourites.createGroup")}</Typography>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        <IconButton aria-label={t("global.close")} onClick={onClose} size="small">
                            <CloseIcon />
                        </IconButton>
                        <IconButton aria-label={t("global.save")} onClick={save} size="small" color="primary" disabled={!valid}>
                            <CheckIcon />
                        </IconButton>
                    </Box>
                </Box>
                <Grid container spacing={3}>
                    <Grid size={12}>
                        <TextField
                            label={t("favourites.groupName")}
                            value={group.name}
                            onChange={(event) => {
                                setTouched(true);
                                setGroup((current) => ({ ...current, name: event.target.value }));
                            }}
                            fullWidth
                            autoFocus
                            size="small"
                            error={!valid && touched}
                            helperText={!valid && touched ? t("favourites.validation.groupNameLength", { min: GROUP_NAME_LIMITS.MIN_NAME_LENGTH, max: GROUP_NAME_LIMITS.MAX_NAME_LENGTH }) : ""}
                            sx={{ mb: 2 }}
                        />
                        <GroupItemsTabs city={city} group={group} onUpdateGroup={setGroup} />
                    </Grid>
                </Grid>
            </CardContent>
            <Divider />
            <CardActions sx={{ justifyContent: "flex-end", p: 2 }}>
                <Button onClick={onClose} color="inherit">
                    {t("global.cancel")}
                </Button>
                <Button onClick={save} variant="contained" color="primary" disabled={!valid} startIcon={<CheckIcon />}>
                    {t("global.save")}
                </Button>
            </CardActions>
        </Card>
    );
};

const SharedGroupDialog = ({ open, group, onClose, onAccept }: { open: boolean; group: ImportedGroup | null; onClose: () => void; onAccept: () => void }) => {
    const { t } = useTranslation();
    if (!group) return null;
    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogHeader title={t("favourites.importSharedGroup")} onClose={onClose} />
            <DialogContent sx={{ pt: 0 }}>
                <Typography variant="body1" gutterBottom sx={{ mb: 2 }}>
                    {t("favourites.sharedGroupDescription")}
                </Typography>
                <Typography variant="caption" gutterBottom>
                    {t("global.preview")}:
                </Typography>
                <Typography variant="h6">{group.name}</Typography>
                <List dense>
                    {group.items.map((item) => (
                        <ListItem key={itemKey(item)} divider sx={{ backgroundColor: "var(--default-bg)", p: 1, py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: 0 }}>
                                <VehicleTypeChip types={item.data.type} />
                            </ListItemIcon>
                            <Box sx={{ width: "100%", ml: 1, display: "flex" }}>
                                <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                    <Typography variant="body2">{itemName(item)}</Typography>
                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                        {t(typeLabelKey(item.favouriteType))}
                                    </Typography>
                                </Box>
                            </Box>
                        </ListItem>
                    ))}
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">
                    {t("global.cancel")}
                </Button>
                <Button onClick={onAccept} color="primary" variant="contained">
                    {t("favourites.importGroup")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const ImportForm = ({ city, onClose, onImport }: { city: string; onClose: () => void; onImport: (group: ImportedGroup) => void }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { byId } = useCities();
    const [tab, setTab] = useState<"url" | "code" | "file">("url");
    const [url, setUrl] = useState("");
    const [code, setCode] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState("");
    const [preview, setPreview] = useState<ImportedGroup | null>(null);
    const wrongCity = (id: string) => t("favourites.sharedGroupWrongCity", { city: byId[id]?.name ?? id });
    const submit = async () => {
        if (tab === "url") {
            if (!url.trim()) return setError(t("favourites.urlRequired"));
            try {
                const parsed = new URL(url);
                if (!parsed.searchParams.get(SHARED_PARAM) || parsed.origin !== window.location.origin) return setError(t("favourites.invalidUrl"));
                navigate(`${parsed.pathname}${parsed.search}`);
                onClose();
            } catch {
                setError(t("favourites.invalidUrl"));
            }
            return;
        }
        const text = tab === "code" ? code : file ? await file.text() : "";
        if (tab === "code" && !code.trim()) return setError(t("favourites.codeRequired"));
        if (tab === "file" && !file) return setError(t("favourites.selectFile"));
        const result = parseCode(text, city);
        if (result.wrongCity) return setError(wrongCity(result.wrongCity));
        if (!result.group) return setError(t(tab === "code" ? "favourites.invalidCode" : "favourites.invalidFileFormat"));
        setPreview(result.group);
    };
    return (
        <>
            <SharedGroupDialog
                open={!!preview}
                group={preview}
                onClose={() => setPreview(null)}
                onAccept={() => {
                    if (preview) onImport(preview);
                    setPreview(null);
                    onClose();
                }}
            />
            <Card elevation={2} sx={{ mb: 2, borderRadius: "8px", border: "2px solid", borderColor: "var(--primary)" }}>
                <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Typography variant="h6">{t("favourites.importGroup")}</Typography>
                        <IconButton aria-label={t("global.close")} onClick={onClose} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    <Typography variant="body2" gutterBottom sx={{ color: "text.secondary" }}>
                        {t("favourites.importGroupDescription")}
                    </Typography>
                    <Tabs
                        value={tab}
                        onChange={(_, value) => {
                            setTab(value);
                            setError("");
                        }}
                        indicatorColor="primary"
                        textColor="primary"
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                        sx={{ alignItems: "center", pb: 2, mt: 2 }}
                    >
                        <Tab icon={<LinkIcon />} iconPosition="start" label={t("favourites.importFromUrl")} value="url" sx={{ minHeight: "48px" }} />
                        <Tab icon={<CodeIcon />} iconPosition="start" label={t("favourites.importFromCode")} value="code" sx={{ minHeight: "48px" }} />
                        <Tab icon={<FileUploadIcon />} iconPosition="start" label={t("favourites.importFromFile")} value="file" sx={{ minHeight: "48px" }} />
                    </Tabs>
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}
                    {tab === "url" && (
                        <Box>
                            <Typography variant="body2" gutterBottom>
                                {t("favourites.importUrlDescription")}
                            </Typography>
                            <TextField
                                fullWidth
                                label={t("favourites.pasteUrl")}
                                value={url}
                                size="small"
                                onChange={(event) => {
                                    setUrl(event.target.value);
                                    setError("");
                                }}
                                placeholder="https://..."
                                sx={{ mt: 2 }}
                            />
                        </Box>
                    )}
                    {tab === "code" && (
                        <Box>
                            <Typography variant="body2" gutterBottom>
                                {t("favourites.groupCodeDescriptionImport")}
                            </Typography>
                            <TextField
                                fullWidth
                                multiline
                                minRows={4}
                                maxRows={4}
                                label={t("favourites.pasteCode")}
                                value={code}
                                onChange={(event) => {
                                    setCode(event.target.value);
                                    setError("");
                                }}
                                placeholder={'{"name": "...", "items": [...]}'}
                                sx={{ mt: 2, "& textarea": { fontFamily: "monospace", fontSize: "0.9375rem" } }}
                            />
                        </Box>
                    )}
                    {tab === "file" && (
                        <Box>
                            <Typography variant="body2" gutterBottom>
                                {t("favourites.importFromFileDescription")}
                            </Typography>
                            <Button variant="contained" component="label" startIcon={<FileUploadIcon />} fullWidth sx={{ mt: 2 }}>
                                {t("favourites.selectFile")}
                                <input
                                    type="file"
                                    hidden
                                    accept=".json,application/json"
                                    onChange={(event) => {
                                        const picked = event.target.files?.[0];
                                        if (picked) {
                                            setFile(picked);
                                            setError("");
                                        }
                                    }}
                                />
                            </Button>
                            {file && (
                                <Box sx={{ mt: 2, p: 1.5, border: 1, borderColor: "divider", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                                        {file.name}
                                    </Typography>
                                    <IconButton onClick={() => setFile(null)} size="small" color="error" sx={{ ml: 1 }}>
                                        <DeleteIcon />
                                    </IconButton>
                                </Box>
                            )}
                        </Box>
                    )}
                </CardContent>
                <Divider />
                <CardActions sx={{ justifyContent: "flex-end", p: 2 }}>
                    <Button onClick={onClose} color="inherit">
                        {t("global.cancel")}
                    </Button>
                    <Button onClick={submit} color="primary" variant="contained">
                        {t("favourites.importGroup")}
                    </Button>
                </CardActions>
            </Card>
        </>
    );
};

const ExportDialog = ({ open, onClose, group, city }: { open: boolean; onClose: () => void; group: FavouriteGroup; city: string }) => {
    const { t } = useTranslation();
    const [tab, setTab] = useState<"url" | "code" | "file">("url");
    const [copied, setCopied] = useState(false);
    const url = useMemo(() => shareUrl(group, city), [group, city]);
    const code = useMemo(() => groupCode(group, city), [group, city]);
    const { share, snackbar } = useShare();
    useEffect(() => {
        if (!copied) return;
        const timer = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(timer);
    }, [copied]);
    const download = () => {
        const blob = new Blob([code], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = `czynalive-${group.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(href);
    };
    return (
        <Dialog onClose={onClose} open={open} maxWidth="md" fullWidth>
            <DialogHeader title={t("favourites.exportGroup")} onClose={onClose} />
            <DialogContent sx={{ pt: 0 }}>
                <Typography variant="body2" gutterBottom sx={{ color: "text.secondary" }}>
                    {t("favourites.exportGroupDescription")}
                </Typography>
                <Tabs value={tab} onChange={(_, value) => setTab(value)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ alignItems: "center", pb: 2, mt: 2 }}>
                    <Tab icon={<LinkIcon />} iconPosition="start" label="URL" value="url" sx={{ minHeight: "48px" }} />
                    <Tab icon={<CodeIcon />} iconPosition="start" label={t("favourites.importFromCode")} value="code" sx={{ minHeight: "48px" }} />
                    <Tab icon={<DownloadIcon />} iconPosition="start" label={t("favourites.importFromFile")} value="file" sx={{ minHeight: "48px" }} />
                </Tabs>
                {tab === "url" && (
                    <Box>
                        {url.length > MAX_URL_LENGTH && (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                {t("favourites.groupMightBeTooLong")}
                            </Alert>
                        )}
                        <Box sx={{ display: "flex", alignItems: "center", pb: 1 }}>
                            <LinkIcon sx={{ pr: 0.5 }} />
                            <Typography variant="subtitle2">{t("favourites.shareGroupDescription")}</Typography>
                        </Box>
                        <TextField fullWidth size="small" value={url} slotProps={{ input: { readOnly: true } }} onFocus={(event) => event.target.select()} />
                        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                            <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true))}>
                                {t("global.copy")}
                            </Button>
                            <Button variant="contained" startIcon={<ShareIconAuto />} onClick={() => share(t("favourites.shareGroupDescription"))}>
                                {t("global.share")}
                            </Button>
                        </Box>
                        {copied && (
                            <Typography variant="caption" sx={{ color: "success.main", mt: 1, display: "block" }}>
                                {t("global.copied")}
                            </Typography>
                        )}
                    </Box>
                )}
                {tab === "code" && (
                    <Box>
                        <Typography variant="body2" gutterBottom sx={{ color: "text.secondary" }}>
                            {t("favourites.groupCodeDescription")}
                        </Typography>
                        <Paper elevation={0} sx={{ position: "relative", backgroundColor: "var(--default-bg)", border: "1px solid", borderColor: "divider", m: 2 }}>
                            <TextField
                                multiline
                                fullWidth
                                value={code}
                                onClick={(event) => (event.target as HTMLTextAreaElement).select?.()}
                                slotProps={{ input: { readOnly: true, sx: { fontFamily: "monospace", fontSize: "0.9375rem", height: "60px", alignItems: "flex-start", wordBreak: "break-all", overflow: "hidden" } } }}
                            />
                            <IconButton
                                onClick={() => navigator.clipboard?.writeText(code).then(() => setCopied(true))}
                                sx={{ position: "absolute", top: 8, right: 8, backgroundColor: "background.paper", "&:hover": { backgroundColor: "primary.main", color: "var(--white)" } }}
                            >
                                <ContentCopyIcon fontSize="small" />
                            </IconButton>
                        </Paper>
                        {copied && (
                            <Typography variant="caption" sx={{ color: "success.main", mt: 1, display: "block" }}>
                                {t("global.copied")}
                            </Typography>
                        )}
                    </Box>
                )}
                {tab === "file" && (
                    <Box>
                        <Typography variant="body2" gutterBottom sx={{ color: "text.secondary" }}>
                            {t("favourites.downloadGroupFileDescription")}
                        </Typography>
                        <Button variant="contained" startIcon={<DownloadIcon />} onClick={download} fullWidth sx={{ mt: 2 }}>
                            {t("favourites.downloadGroupFile")}
                        </Button>
                    </Box>
                )}
            </DialogContent>
            {snackbar}
        </Dialog>
    );
};

const GroupMenu = ({
    onEdit,
    onDelete,
    onShare,
    onShowOnMap,
    onMoveUp,
    onMoveDown,
    onAdd,
    canMoveUp,
    canMoveDown,
    hasItems,
}: {
    onEdit: () => void;
    onDelete: () => void;
    onShare: () => void;
    onShowOnMap: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onAdd: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
    hasItems: boolean;
}) => {
    const { t } = useTranslation();
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const run = (action: () => void) => (event: React.MouseEvent) => {
        event.stopPropagation();
        action();
        setAnchor(null);
    };
    const entry = (icon: ReactNode, label: string, action: () => void, disabled = false, danger = false) => (
        <MenuItem onClick={run(action)} disabled={disabled} dense>
            <ListItemIcon>{icon}</ListItemIcon>
            <ListItemText sx={danger ? { color: "error.main" } : undefined}>{label}</ListItemText>
        </MenuItem>
    );
    return (
        <>
            <IconButton
                size="small"
                onClick={(event) => {
                    event.stopPropagation();
                    setAnchor(event.currentTarget);
                }}
                aria-label={t("global.moreActions")}
            >
                <MoreVertIcon />
            </IconButton>
            <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
                {entry(<EditIcon fontSize="small" />, t("global.edit"), onEdit)}
                {entry(<AddIcon fontSize="small" />, t("favourites.addToGroup"), onAdd)}
                {entry(<PlaceIcon fontSize="small" />, t("global.showOnMap"), onShowOnMap, !hasItems)}
                {entry(<ShareIconAuto fontSize="small" />, t("global.share"), onShare)}
                <Divider />
                {entry(<ArrowUpwardIcon fontSize="small" />, t("global.moveUp"), onMoveUp, !canMoveUp)}
                {entry(<ArrowDownwardIcon fontSize="small" />, t("global.moveDown"), onMoveDown, !canMoveDown)}
                <Divider />
                {entry(<DeleteIcon fontSize="small" color="error" />, t("favourites.deleteGroup"), onDelete, false, true)}
            </Menu>
        </>
    );
};

const RouteVehiclesSummary = ({ city, data }: { city: string; data: FavouriteRouteData }) => {
    const { t } = useTranslation();
    const vehicles = useRouteVehicles(data.city ?? city, [data.routeId]);
    const extras = useExtras();
    const delays = vehicles.positions.map((position) => extras[position[EVehiclePosition.id]]?.[0]).filter((delay): delay is number => typeof delay === "number");
    const avgDelay = delays.length ? average(delays) / 1000 : null;
    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "end" }}>
            <Typography variant="caption">{t("plural.vehicle", { count: vehicles.positions.length })}</Typography>
            {avgDelay !== null && (
                <Box sx={{ display: "flex", alignItems: "flex-end" }}>
                    <Typography variant="caption" sx={{ mr: 1 }}>
                        {t("favourites.onAverageShort")}
                    </Typography>
                    <span style={{ marginTop: "-3px" }}>
                        <DelayChip delayInSeconds={avgDelay} />
                    </span>
                </Box>
            )}
        </Box>
    );
};

type VehicleLookup = [position: VehiclePosition | null, headsign: string, model: string];

const useVehicleLookup = (city: string, vehicleId: string) => {
    const [data, setData] = useState<VehicleLookup | null | undefined>();
    useEffect(() => {
        if (!city || !vehicleId) return;
        let timer: ReturnType<typeof setTimeout>;
        const controller = new AbortController();
        const load = () =>
            cityGet<VehicleLookup>(city, `/positions/vehicle/${encodeURIComponent(vehicleId)}`, undefined, controller.signal)
                .then(setData)
                .catch(() => !controller.signal.aborted && setData(null))
                .finally(() => {
                    if (!controller.signal.aborted) timer = setTimeout(load, 30000);
                });
        load();
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [city, vehicleId]);
    return data;
};

const VehicleLiveSummary = ({ lookup, type }: { lookup: VehicleLookup | null | undefined; type: number }) => {
    const position = lookup?.[0];
    const route = position?.[EVehiclePosition.route];
    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "end" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {position ? (
                        <GpsFixedIcon fontSize="small" className="opacity-animate" sx={{ color: `var(--${vehicleTypeName(type)})` }} />
                    ) : (
                        <GpsOffIcon fontSize="small" sx={{ opacity: 0.5 }} />
                    )}
                    {position && route && (
                        <Typography variant="caption">
                            <strong>
                                {route[ERouteTuple.routeName]}
                                {position[EVehiclePosition.brigade] ? <small>/{position[EVehiclePosition.brigade]}</small> : ""}
                            </strong>
                            {lookup?.[1] ? <> {lookup[1]}</> : null}
                        </Typography>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

const VehicleRow = ({ city, position, headsign }: { city: string; position: VehiclePosition; headsign: string }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const route = position[EVehiclePosition.route];
    const id = position[EVehiclePosition.id];
    const brigade = position[EVehiclePosition.brigade];
    const extra = useExtras()[id];
    const delay = extra?.[0];
    return (
        <ListRow onClick={() => navigate(`/${city}?pojazd=${encodeURIComponent(id)}`)} action="navigate" column>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", maxWidth: "100%" }}>
                <RouteNameBadge routeName={route[ERouteTuple.routeName]} type={route[ERouteTuple.routeType]} text={headsign || extra?.[1] || ""} fontWeight={400} angledDivider />
                <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                    <span>
                        {t("global.vehicleNo")} <span>{parseVehicleId(id).number}</span>
                    </span>
                    {brigade && (
                        <span>
                            , {t("global.brigade").toLowerCase()} {brigade}
                        </span>
                    )}
                    <br />
                    {typeof delay === "number" && (
                        <Box component="span" sx={{ mt: 0.5, display: "block" }}>
                            <DelayChip delayInSeconds={delay / 1000} />
                        </Box>
                    )}
                </Typography>
            </Box>
        </ListRow>
    );
};

const RouteVehiclesList = ({ city, data }: { city: string; data: FavouriteRouteData }) => {
    const { t } = useTranslation();
    const vehicles = useRouteVehicles(data.city ?? city, [data.routeId]);
    if (!vehicles.positions.length)
        return (
            <List>
                <Typography variant="caption" sx={{ p: 1, pt: 2 }}>
                    {t("global.nothingFound")}
                </Typography>
            </List>
        );
    return (
        <List sx={{ pt: 0 }}>
            {vehicles.positions.map((position) => (
                <VehicleRow key={position[EVehiclePosition.id]} city={city} position={position} headsign="" />
            ))}
        </List>
    );
};

const StopDeparturesList = ({ city, data, group }: { city: string; data: FavouriteStopData; group: FavouriteGroup }) => {
    const { t } = useTranslation();
    const [settings] = useSettings();
    const now = useNow();
    const onlyFavourites = group.favouriteDeparturesOnly === true;
    const routes = groupItems(group, "route_id").map((route) => route.routeId);
    const { departures, error } = useStopDepartures(data.city ?? city, data.stop_id, { limit: 10 });
    const shown = (departures ?? []).filter(
        (departure) => !onlyFavourites || routes.includes(departure[EStopDepartureTuple.trip][ETripTuple.route][ERouteTuple.routeId]),
    );
    return (
        <List sx={{ pt: 0 }}>
            {!departures && !error ? (
                <Typography variant="caption" sx={{ m: 2, p: 4 }}>
                    {t("global.loading")}...
                </Typography>
            ) : error && !departures ? (
                <Typography variant="caption" sx={{ m: 2 }}>
                    {t("global.error")}
                </Typography>
            ) : shown.length === 0 ? (
                <Box sx={{ py: 2 }}>
                    <Typography variant="caption" gutterBottom component="div">
                        {t("timetables.noUpcomingSchedule")}.
                    </Typography>
                    {onlyFavourites && (
                        <Typography variant="caption" component="div">
                            {t("favourites.turnOffShowOnlyFavourites")}
                        </Typography>
                    )}
                </Box>
            ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 0.5 }}>
                    {shown.map((departure) => (
                        <DepartureRow
                            key={`${departure[EStopDepartureTuple.trip][ETripTuple.tripId]}-${departure[EStopDepartureTuple.departure][EDeparture.scheduledDeparture]}`}
                            city={city}
                            departure={departure}
                            now={now}
                            compact
                            showBrigade={settings.departuresShowBrigade}
                            showVehicleNo={settings.departuresShowVehicleNo}
                        />
                    ))}
                </Box>
            )}
        </List>
    );
};

const FavouriteRow = ({ city, item, group, editMode, onRemove }: { city: string; item: FavouriteItem; group: FavouriteGroup; editMode: boolean; onRemove?: () => void }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const vehicleLookup = useVehicleLookup(item.favouriteType === "vehicle" && !editMode ? (item.data.city ?? city) : "", item.favouriteType === "vehicle" ? item.data.id : "");
    const lookup = item.favouriteType === "vehicle" ? <VehicleLiveSummary lookup={vehicleLookup} type={item.data.type[0] ?? 3} /> : null;
    const offlineVehicle = item.favouriteType === "vehicle" && !vehicleLookup?.[0];
    const mapLink =
        item.favouriteType === "stop"
            ? `/${city}?przystanek=${encodeURIComponent(item.data.id)}`
            : item.favouriteType === "vehicle"
              ? `/${city}?pojazd=${encodeURIComponent(item.data.id)}`
              : `/${city}?lines=${encodeURIComponent(item.data.id)}`;
    return (
        <>
            <ListItem divider onClick={() => !editMode && setOpen((value) => !value)} sx={{ backgroundColor: "var(--default-bg)", p: 1, py: 0.5 }}>
                {editMode && (
                    <ListItemIcon onClick={onRemove} sx={{ cursor: "pointer", minWidth: "24px", mr: 1 }}>
                        <CloseIcon />
                    </ListItemIcon>
                )}
                <ListItemIcon sx={{ minWidth: 0 }}>{item.data.type.length ? <VehicleTypeChip types={item.data.type} /> : null}</ListItemIcon>
                <Box sx={{ width: "100%", ml: 1, display: "flex" }}>
                    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <Typography variant="body2">{itemName(item)}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {t(typeLabelKey(item.favouriteType))}
                        </Typography>
                    </Box>
                    {!editMode && (
                        <Box sx={{ display: "flex", alignItems: "center", height: "100%", minHeight: "48px" }}>
                            <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
                                {item.favouriteType === "route_id" ? <RouteVehiclesSummary city={city} data={item.data} /> : lookup}
                            </Box>
                        </Box>
                    )}
                </Box>
                {!editMode && (
                    <>
                        <Box sx={{ display: "flex", gap: 0.5, mr: 0.5 }}>
                            {!offlineVehicle && (
                                <IconButton size="small" component={Link} to={mapLink} onClick={(event) => event.stopPropagation()}>
                                    <PlaceIcon />
                                </IconButton>
                            )}
                            {item.favouriteType === "stop" && (
                                <IconButton
                                    size="small"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        navigate(`/${city}/rozklad-jazdy/przystanek/${encodeURIComponent(item.data.stop_id)}`);
                                    }}
                                >
                                    <EventNoteIcon />
                                </IconButton>
                            )}
                        </Box>
                        <IconButton size="small">{open ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
                    </>
                )}
            </ListItem>
            {!editMode && (
                <Collapse in={open} timeout="auto" unmountOnExit>
                    <Paper elevation={1} sx={{ boxShadow: 3, mx: 1 }}>
                        <Box sx={{ minHeight: "35px", maxHeight: "300px", overflow: "auto", mx: 1 }}>
                            {item.favouriteType === "route_id" ? (
                                <RouteVehiclesList city={city} data={item.data} />
                            ) : item.favouriteType === "vehicle" ? (
                                <VehicleDetailsList city={city} data={item.data} />
                            ) : (
                                <StopDeparturesList city={city} data={item.data} group={group} />
                            )}
                        </Box>
                    </Paper>
                </Collapse>
            )}
        </>
    );
};

const VehicleDetailsList = ({ city, data }: { city: string; data: FavouriteVehicleData }) => {
    const { t } = useTranslation();
    const lookup = useVehicleLookup(data.city ?? city, data.id);
    if (lookup === undefined)
        return (
            <Typography variant="caption" sx={{ p: 2 }}>
                {t("global.loading")}...
            </Typography>
        );
    if (!lookup?.[0])
        return (
            <Typography variant="caption" sx={{ p: 2 }}>
                {t("global.nothingFound")}
            </Typography>
        );
    return (
        <List sx={{ pt: 0 }}>
            <VehicleRow city={city} position={lookup[0]} headsign={lookup[1]} />
        </List>
    );
};

const GroupExtras = ({ city, group, onUpdate }: { city: string; group: FavouriteGroup; onUpdate: (group: FavouriteGroup) => void }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const routes = groupItems(group, "route_id");
    const stops = groupItems(group, "stop");
    const alerts = useApi(routes.length ? (signal) => fetchCityAlerts(city, signal) : null, [city, routes.length > 0]);
    const affected = (alerts.data?.alerts ?? []).filter((alert) => alert.routes.some((route) => routes.some((entry) => entry.routeId === route[ERouteTuple.routeId])));
    return (
        <>
            {affected.length > 0 && (
                <Alert severity="warning" sx={{ py: 0, cursor: "pointer" }} onClick={() => setOpen((value) => !value)} action={<ShowMoreButton expanded={open} onClick={() => setOpen((value) => !value)} />}>
                    <Typography variant="body2">{t("favourites.favouriteLinesAlerts", { count: affected.length })}</Typography>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <ul>
                            {affected.map((alert) => (
                                <li key={alert.id}>
                                    <Link to={`/${city}/komunikaty/komunikat?id=${encodeURIComponent(alert.id)}`} style={{ marginTop: 10 }}>
                                        {alert.title}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </Collapse>
                </Alert>
            )}
            {routes.length > 0 && stops.length > 0 && (
                <Box sx={[{ px: 1 }, routes.length > 0 ? { mt: 1 } : { mt: 0 }]}>
                    <FormControlLabel
                        control={<Switch checked={group.favouriteDeparturesOnly === true} onChange={(event) => onUpdate({ ...group, favouriteDeparturesOnly: event.target.checked })} size="small" />}
                        label={<Typography variant="caption">{t("favourites.showOnlyFavouritesDepartures")}</Typography>}
                        labelPlacement="start"
                        sx={{ ml: 0, display: "flex", justifyContent: "end", width: "100%", "& .MuiFormControlLabel-label": { fontSize: "0.875rem" } }}
                    />
                </Box>
            )}
        </>
    );
};

const GroupCard = ({ city, group, index, count, toast }: { city: string; group: FavouriteGroup; index: number; count: number; toast: (message: string) => void }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { updateGroup, deleteGroup, moveGroupUp, moveGroupDown } = useFavouriteGroups(city);
    const [editing, setEditing] = useState(false);
    const [adding, setAdding] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [draft, setDraft] = useState(group);
    const [nameError, setNameError] = useState<string | null>(null);
    const active = editing || adding;
    useEffect(() => {
        if (!active) setDraft(group);
    }, [group, active]);
    const itemsChanged = draft.items.map(itemKey).join(",") !== group.items.map(itemKey).join(",");
    const canSave = (itemsChanged || draft.name !== group.name) && !nameError;
    const cancel = () => {
        setDraft(group);
        setNameError(null);
        setEditing(false);
        setAdding(false);
    };
    const save = () => {
        if (draft.name !== group.name || itemsChanged) {
            updateGroup(group.id, { ...group, name: draft.name, items: draft.items });
            toast(t("favourites.groupUpdated"));
        }
        setEditing(false);
        setAdding(false);
    };
    const toggleExpanded = () => updateGroup(group.id, { ...group, expanded: !group.expanded });
    const empty = group.items.length === 0 && group.expanded && !editing && !adding;
    const [title, setTitle] = [editing ? draft.name : group.name, (value: string) => setDraft((current) => ({ ...current, name: value }))];

    return (
        <>
            <Paper elevation={2} sx={{ mb: 2, borderRadius: "8px", overflow: "hidden" }}>
                <Box
                    sx={[{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", py: 1, px: 2, gap: 1 }, active ? { cursor: "default" } : { cursor: "pointer" }]}
                    onClick={active ? undefined : toggleExpanded}
                >
                    {editing ? (
                        <TextField
                            value={title}
                            onChange={(event) => {
                                setTitle(event.target.value);
                                setNameError(isValidGroupName(event.target.value) ? null : t("favourites.validation.groupNameLength", { min: GROUP_NAME_LIMITS.MIN_NAME_LENGTH, max: GROUP_NAME_LIMITS.MAX_NAME_LENGTH }));
                            }}
                            variant="outlined"
                            size="small"
                            fullWidth
                            onClick={(event) => event.stopPropagation()}
                            error={!!nameError}
                            helperText={nameError}
                        />
                    ) : (
                        <Typography variant="subtitle1" sx={{ fontWeight: "medium", color: "text.primary", wordBreak: "break-word" }}>
                            {group.name} ({group.items.length})
                        </Typography>
                    )}
                    <Box sx={{ display: "flex", ml: 1 }} onClick={(event) => event.stopPropagation()}>
                        {!active && (
                            <IconButton
                                size="small"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    toggleExpanded();
                                }}
                            >
                                {group.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                        )}
                        {active && (
                            <>
                                <IconButton size="small" onClick={cancel} sx={{ color: "text.secondary" }}>
                                    <CloseIcon />
                                </IconButton>
                                <IconButton size="small" onClick={save} color="primary" disabled={!canSave}>
                                    <CheckIcon />
                                </IconButton>
                            </>
                        )}
                        {!active && (
                            <GroupMenu
                                onEdit={() => (editing ? cancel() : (setDraft({ ...group }), setNameError(null), setEditing(true)))}
                                onDelete={() => setConfirmDelete(true)}
                                onShare={() => setExporting(true)}
                                onShowOnMap={() => {
                                    const lines = groupItems(group, "route_id").map((route) => route.id);
                                    const vehicles = groupItems(group, "vehicle").map((vehicle) => vehicle.id);
                                    const params = new URLSearchParams();
                                    if (lines.length) params.set("lines", lines.join(","));
                                    if (vehicles.length) params.set("vehicles", vehicles.join(","));
                                    const query = params.toString();
                                    navigate(query ? `/${city}?${query}` : `/${city}`);
                                }}
                                onMoveUp={() => {
                                    moveGroupUp(index);
                                    toast(t("favourites.groupMovedUp"));
                                }}
                                onMoveDown={() => {
                                    moveGroupDown(index);
                                    toast(t("favourites.groupMovedDown"));
                                }}
                                onAdd={() => setAdding(true)}
                                canMoveUp={index > 0}
                                canMoveDown={index < count - 1}
                                hasItems={group.items.length > 0}
                            />
                        )}
                    </Box>
                </Box>
                {empty && <EmptyState title={t("favourites.emptyGroup")} />}
                <Box sx={{ px: 0.25 }}>
                    <Collapse in={group.expanded || active} timeout="auto" unmountOnExit>
                        {!active && <GroupExtras city={city} group={group} onUpdate={(next) => updateGroup(group.id, next)} />}
                        {adding ? (
                            <Box sx={{ px: 2 }}>
                                <GroupItemsTabs city={city} group={draft} onUpdateGroup={(update) => setDraft((current) => update(current))} />
                            </Box>
                        ) : (
                            <List dense>
                                {(editing ? draft.items : group.items).map((item) => (
                                    <FavouriteRow
                                        key={itemKey(item)}
                                        city={city}
                                        item={item}
                                        group={group}
                                        editMode={editing}
                                        onRemove={() => setDraft((current) => ({ ...current, items: current.items.filter((entry) => itemKey(entry) !== itemKey(item)) }))}
                                    />
                                ))}
                            </List>
                        )}
                    </Collapse>
                </Box>
                {active && (
                    <Box sx={{ p: 2, pt: 2 }}>
                        <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
                            <Button onClick={cancel} color="inherit" variant="outlined" size="small">
                                {t("global.cancel")}
                            </Button>
                            <Button onClick={save} color="primary" variant="contained" size="small" disabled={!canSave}>
                                {t("global.save")}
                            </Button>
                        </Stack>
                    </Box>
                )}
            </Paper>
            <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} maxWidth="sm" fullWidth>
                <DialogHeader title={t("favourites.deleteGroup")} onClose={() => setConfirmDelete(false)} />
                <DialogContent>
                    <Typography>{t("favourites.confirmDeleteGroup", { name: group.name })}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDelete(false)} color="inherit">
                        {t("global.cancel")}
                    </Button>
                    <Button
                        onClick={() => {
                            deleteGroup(group.id);
                            setConfirmDelete(false);
                            toast(t("favourites.groupDeleted"));
                        }}
                        color="error"
                        variant="contained"
                    >
                        {t("favourites.deleteGroup")}
                    </Button>
                </DialogActions>
            </Dialog>
            {exporting && <ExportDialog open={exporting} onClose={() => setExporting(false)} group={group} city={city} />}
        </>
    );
};

const WrongCityDialog = ({ open, name, targetCity, onClose, onSwitch }: { open: boolean; name: string; targetCity: string | null; onClose: () => void; onSwitch: () => void }) => {
    const { t } = useTranslation();
    const { city = "" } = useParams();
    const { byId } = useCities();
    if (!targetCity) return null;
    const target = byId[targetCity]?.name ?? targetCity;
    const current = byId[city]?.name ?? city;
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogHeader title={t("favourites.sharedGroupWrongCityTitle")} onClose={onClose} />
            <DialogContent sx={{ textAlign: "center" }}>
                <LocationCityIcon fontSize="large" />
                <Typography sx={{ mt: 1 }}>{name ? t("favourites.sharedGroupWrongCityNamed", { name, city: target }) : t("favourites.sharedGroupWrongCity", { city: target })}</Typography>
            </DialogContent>
            <DialogActions sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Button onClick={onClose} color="inherit">
                    {t("map.differentCityPart4")}: {current}
                </Button>
                <Button onClick={onSwitch} color="primary" variant="contained">
                    {t("favourites.sharedGroupSwitchCity", { city: target })}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default function FavouritesPage() {
    const { city = "" } = useParams();
    const cityInfo = useCity(city);
    const { t } = useTranslation();
    const navigate = useNavigate();
    const agencyName = agencyNameOf(city, cityInfo);
    const { groups, addGroup, replaceGroups } = useFavouriteGroups(city);
    const [creating, setCreating] = useState(false);
    const [importing, setImporting] = useState(false);
    const [shared, setShared] = useState<ImportedGroup | null>(null);
    const [mismatch, setMismatch] = useState<{ city: string; name: string } | null>(null);
    const { toast, node } = useToast();
    const handled = useRef("");
    const allExpanded = groups.length === 0 || groups.every((group) => group.expanded);
    const extras = useDepartureVehicles(city, groups.length > 0, 30000);

    const clearShared = () => {
        const url = new URL(window.location.href);
        if (!url.searchParams.has(SHARED_PARAM)) return;
        url.searchParams.delete(SHARED_PARAM);
        navigate(`${url.pathname}${url.search}`, { replace: true });
    };

    useEffect(() => {
        const raw = new URLSearchParams(window.location.search).get(SHARED_PARAM);
        if (!raw || handled.current === raw) return;
        handled.current = raw;
        decodeShared(raw, city)
            .then((result) => {
                if (result.wrongCity) setMismatch({ city: result.wrongCity, name: result.name ?? "" });
                else if (result.group) setShared(result.group);
            })
            .catch(() => {
                toast(t("favourites.sharedGroupImportFailed"));
                clearShared();
            });
    });

    const add = (group: FavouriteGroup) => {
        addGroup(group);
        toast(t("favourites.addedGroup"));
    };

    return (
        <PageTemplate title={`${agencyName} - ${t("favourites.pageTitle")}`} padding>
            <PageHeader documentTitle={`${agencyName} - ${t("favourites.pageTitle")}`} />
            <ExtrasContext.Provider value={extras}>
                <Box style={{ padding: "0 0 80px" }}>
                    <Box sx={{ mb: 6 }}>
                        <PageDescription agencyName={cityInfo?.name ?? city} />
                        <Divider sx={{ my: 3 }} />
                        <Box>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                                <Typography variant="body1">{t("favourites.favouriteGroups")}</Typography>
                                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                    {groups.length > 0 && (
                                        <IconButton
                                            size="small"
                                            onClick={() => replaceGroups(groups.map((group) => ({ ...group, expanded: !allExpanded })))}
                                            title={t(allExpanded ? "favourites.collapseAllGroups" : "favourites.expandAllGroups")}
                                        >
                                            {allExpanded ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
                                        </IconButton>
                                    )}
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            setCreating(false);
                                            setImporting(true);
                                        }}
                                        title={t("global.import")}
                                    >
                                        <GetAppIcon />
                                    </IconButton>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={() => {
                                            setImporting(false);
                                            setCreating(true);
                                        }}
                                    >
                                        {t("global.create")}
                                    </Button>
                                </Box>
                            </Box>
                            {creating && <CreateGroupForm city={city} onClose={() => setCreating(false)} onCreate={add} />}
                            {importing && <ImportForm city={city} onClose={() => setImporting(false)} onImport={(group) => add({ id: Date.now(), name: group.name, items: group.items, expanded: true })} />}
                            {groups.length === 0 && !creating && !importing ? (
                                <EmptyState title={t("favourites.noGroups")} subtitle={t("favourites.addFirstGroup")} />
                            ) : (
                                groups.map((group, index) => <GroupCard key={group.id} city={city} group={group} index={index} count={groups.length} toast={toast} />)
                            )}
                            <SharedGroupDialog
                                open={!!shared}
                                group={shared}
                                onClose={() => {
                                    setShared(null);
                                    clearShared();
                                }}
                                onAccept={() => {
                                    if (shared) add({ id: Date.now(), name: shared.name, items: shared.items, expanded: true });
                                    setShared(null);
                                    clearShared();
                                }}
                            />
                            <WrongCityDialog
                                open={!!mismatch}
                                name={mismatch?.name ?? ""}
                                targetCity={mismatch?.city ?? null}
                                onClose={() => {
                                    setMismatch(null);
                                    clearShared();
                                }}
                                onSwitch={() => {
                                    if (!mismatch) return;
                                    window.location.href = `/${mismatch.city}/ulubione${window.location.search}`;
                                }}
                            />
                        </Box>
                    </Box>
                </Box>
            </ExtrasContext.Provider>
            {node}
        </PageTemplate>
    );
}

