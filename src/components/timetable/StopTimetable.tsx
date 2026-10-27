import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    AlertTitle,
    Box,
    Collapse,
    Divider,
    FormControlLabel,
    Paper,
    Switch,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    Typography,
} from "@mui/material";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ALIGHT, type RouteLegendEntry, type StopTupleDetailed } from "@/api/types";
import { TripOnMapButton } from "@/components/departures/DepartureRow";
import { PopupInfo, ShowMoreButton } from "@/components/departures/parts";
import { dateIndexToDate, todayDateIndex } from "@/lib/transit";
import { typeReadableKey, useUrlTab } from "./common";

export type TimetableRow = [tripRef: string, departure: number, alight: number, notes: string, headsign?: string, brigade?: string];
export type StopTimetableResponse = { stop: StopTupleDetailed; timetable: Record<string, TimetableRow[]>; legend: RouteLegendEntry[] };

export type Weekday = "workday" | "friday" | "saturday" | "holiday";

type Entry = { hour: number; minute: number; secs: number; tripRef: string; headsign: string; exitOnly: boolean; brigade: string; closest?: boolean };

const isExitOnly = (alight: number) => (alight & ALIGHT.AlightOnly) !== 0 || ((alight & ALIGHT.IsLastStop) !== 0 && (alight & ALIGHT.BoardOnly) === 0);

// Weekday class of a date the way the original buckets it.
export const weekdayOf = (day: number, withFriday = false): Weekday => (day === 0 ? "holiday" : day === 6 ? "saturday" : withFriday && day === 5 ? "friday" : "workday");

const zonedNow = (timeZone: string) => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(new Date());
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
};

// Nearest service date of each weekday class (today's class uses today).
export const pickDates = (days: number[], timeZone: string) => {
    const today = todayDateIndex(timeZone);
    const sorted = [...days].sort((a, b) => a - b);
    const find = (match: (weekday: number) => boolean) =>
        (sorted.includes(today) && match(dateIndexToDate(today).getUTCDay()) ? today : undefined) ??
        sorted.find((index) => index >= today && match(dateIndexToDate(index).getUTCDay())) ?? sorted.find((index) => match(dateIndexToDate(index).getUTCDay()));
    return {
        workday: find((day) => day >= 1 && day <= 5 && day !== 5) ?? find((day) => day >= 1 && day <= 5),
        friday: find((day) => day === 5),
        saturday: find((day) => day === 6),
        holiday: find((day) => day === 0),
    } as Record<Weekday, number | undefined>;
};

export const serviceMidnight = (index: number, timeZone: string) => {
    const utc = dateIndexToDate(index).getTime();
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(utc + 12 * 3600000)));
    return utc - (hour - 12) * 3600000;
};

const WORDS = /[\s/.\-,]+/;
const words = (text: string) =>
    text
        .replace(/[()]/g, "")
        .split(WORDS)
        .filter((word) => word.length > 0);

// Headsign shortcuts of the original: first 3 letters, grown word by word until unique.
export const headsignShortcuts = (headsigns: string[]) => {
    const lengths = new Map<string, number[]>();
    for (const headsign of headsigns) lengths.set(headsign, words(headsign).map((_, index) => (index === 0 ? 3 : 0)));
    const shortcut = (headsign: string) => {
        const parts = words(headsign);
        const lens = lengths.get(headsign) ?? [];
        let out = "";
        for (let i = 0; i < parts.length; i++) {
            if (lens[i] > 0) out += parts[i].substring(0, lens[i]);
        }
        return out.toUpperCase();
    };
    let guard = 100;
    let changed = true;
    while (changed && guard > 0) {
        changed = false;
        guard--;
        const groups = new Map<string, string[]>();
        for (const headsign of headsigns) {
            const key = shortcut(headsign);
            groups.set(key, [...(groups.get(key) ?? []), headsign]);
        }
        for (const [, group] of groups) {
            if (group.length <= 1) continue;
            const withUnused = group.filter((headsign) => (lengths.get(headsign) ?? []).some((len) => len === 0));
            if (withUnused.length > 0) {
                for (const headsign of withUnused) {
                    const lens = lengths.get(headsign)!;
                    const index = lens.indexOf(0);
                    if (index !== -1) {
                        lens[index] = 3;
                        changed = true;
                    }
                }
            } else {
                for (const headsign of group) {
                    const lens = lengths.get(headsign)!;
                    const parts = words(headsign);
                    for (let i = 0; i < parts.length; i++) {
                        if (lens[i] > 0 && lens[i] < parts[i].length) {
                            lens[i]++;
                            changed = true;
                            break;
                        }
                    }
                }
            }
        }
    }
    return new Map(headsigns.map((headsign) => [headsign, shortcut(headsign)]));
};

// Headsign of a row: the one the backend knows, else the direction's, shortened by an "ends at" note.
export const rowHeadsign = (row: TimetableRow, legend: RouteLegendEntry[], fallback: string) => {
    if (row[4]) return row[4];
    for (const letter of row[3]) {
        const entry = legend.find((item) => item.letter === letter);
        if (entry?.kind === "endsAt") return entry.stops[0][2];
        if (entry?.kind === "extendedTo") return entry.stops[0][2];
        if (entry?.kind === "leavesTo") return (entry.stops[1] ?? entry.stops[0])[2];
    }
    return fallback;
};

type Props = {
    city: string;
    data: StopTimetableResponse;
    routeName: string;
    routeType: number;
    stopName: string;
    cityName: string;
    headsign: string;
    alerts?: ReactNode;
    brigadeLink?: (brigade: string) => string | undefined;
    timeZone?: string;
};

const WEEKDAYS = ["workday", "saturday", "holiday"] as const;

const TimetableTable = ({
    entries,
    shortcuts,
    showExitOnly,
    city,
    routeType,
    brigadeLink,
}: {
    entries: { hour: number; list: Entry[] }[];
    shortcuts: Map<string, string>;
    showExitOnly: boolean;
    city: string;
    routeType: number;
    brigadeLink?: (brigade: string) => string | undefined;
}) => {
    const { t } = useTranslation();
    const closestRef = useRef<HTMLSpanElement | null>(null);
    const shortcut = (headsign: string) => shortcuts.get(headsign) || headsign[0] || "?";
    useLayoutEffect(() => {
        closestRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, []);
    return (
        <TableContainer component={Paper}>
            <Table sx={{ background: "var(--default-bg)" }} size="small">
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ position: "sticky", left: 0, background: "var(--default-bg)", borderRight: "1px solid var(--neutral-light)", zIndex: "1", width: 20 }}>{t("stopDetails.hour")}</TableCell>
                        <TableCell>{t("timetables.minutes")}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {entries.map((group) => (
                        <TableRow key={group.hour}>
                            <TableCell component="th" scope="row" sx={{ position: "sticky", left: 0, borderRight: "1px solid var(--neutral-light)", zIndex: "1", width: 20 }}>
                                {group.hour}
                            </TableCell>
                            <TableCell>
                                {group.list.map((entry) =>
                                    entry.exitOnly && !showExitOnly ? null : (
                                        <PopupInfo
                                            key={`${entry.tripRef}-${entry.exitOnly ? 1 : 0}`}
                                            element={
                                                <span
                                                    ref={entry.closest ? closestRef : null}
                                                    style={{
                                                        marginRight: 5,
                                                        display: "inline-block",
                                                        cursor: "pointer",
                                                        border: entry.closest ? "2px solid var(--primary)" : "none",
                                                        padding: 5,
                                                        opacity: entry.closest === false || entry.exitOnly ? "0.5" : "1",
                                                        whiteSpace: "nowrap",
                                                        textAlign: "center",
                                                        textDecoration: "none",
                                                        backgroundColor: "transparent",
                                                        color: "inherit",
                                                        borderRadius: 0,
                                                    }}
                                                >
                                                    <span>{entry.minute < 10 ? `0${entry.minute}` : entry.minute}</span>
                                                    <span style={{ fontSize: "0.8125rem", marginLeft: 3 }}>
                                                        ({shortcut(entry.headsign)}
                                                        {entry.brigade && <span>/{entry.brigade}</span>})
                                                    </span>
                                                    {entry.exitOnly && <span>*</span>}
                                                </span>
                                            }
                                            popupContent={
                                                <span style={{ display: "flex", flexDirection: "column" }}>
                                                    <Typography variant="caption">
                                                        <strong>{t("stopDetails.hour")}</strong>: {entry.hour}:{entry.minute < 10 ? `0${entry.minute}` : entry.minute}
                                                    </Typography>
                                                    <Typography variant="caption">
                                                        <strong>{t("global.tripHeadsign")}</strong>: {entry.headsign} ({shortcut(entry.headsign)})
                                                    </Typography>
                                                    {entry.brigade && (
                                                        <Typography variant="caption">
                                                            <strong>{t("global.brigade")}</strong>:{" "}
                                                            {brigadeLink?.(entry.brigade) ? (
                                                                <Link to={brigadeLink(entry.brigade)!} style={{ color: "var(--primary)", textDecoration: "underline" }}>
                                                                    {entry.brigade}
                                                                </Link>
                                                            ) : (
                                                                entry.brigade
                                                            )}
                                                        </Typography>
                                                    )}
                                                    {entry.exitOnly && (
                                                        <>
                                                            <Typography variant="caption" sx={{ textTransform: "uppercase" }}>
                                                                <strong>* - {t("timetables.exitOnly")}</strong>
                                                            </Typography>
                                                            <Typography variant="caption">{t("timetables.exitOnlyDescription1")}</Typography>
                                                            <Typography variant="caption">{t("timetables.exitOnlyDescription2")}</Typography>
                                                        </>
                                                    )}
                                                    <TripOnMapButton city={city} tripId={entry.tripRef} routeType={routeType} />
                                                </span>
                                            }
                                        />
                                    ),
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export const StopTimetable = ({ city, data, routeName, routeType, stopName, cityName, headsign, alerts, brigadeLink, timeZone = "Europe/Warsaw" }: Props) => {
    const { t } = useTranslation();
    const [nowState, setNowState] = useState(() => zonedNow(timeZone));
    const todayClass = weekdayOf(nowState.day);
    const [weekday, setWeekday] = useUrlTab<(typeof WEEKDAYS)[number]>("weekday", WEEKDAYS, todayClass === "friday" ? "workday" : (todayClass as (typeof WEEKDAYS)[number]));
    const [showExitOnly, setShowExitOnly] = useState(false);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        const timer = setTimeout(
            () => {
                setNowState(zonedNow(timeZone));
                interval = setInterval(() => setNowState(zonedNow(timeZone)), 60000);
            },
            60000 - (Date.now() % 60000),
        );
        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, [timeZone]);

    const dates = useMemo(() => pickDates(Object.keys(data.timetable).map(Number), timeZone), [data, timeZone]);

    const schedule = useMemo(() => {
        const out: Record<(typeof WEEKDAYS)[number], { hour: number; list: Entry[] }[]> = { workday: [], saturday: [], holiday: [] };
        const nowSecs = nowState.minutes * 60;
        for (const key of WEEKDAYS) {
            const index = dates[key];
            if (index === undefined) continue;
            const midnight = serviceMidnight(index, timeZone);
            let found = false;
            for (const row of data.timetable[String(index)] ?? []) {
                if ((row[2] & ALIGHT.Forbidden) !== 0) continue;
                const exitOnly = isExitOnly(row[2]);
                if (!showExitOnly && exitOnly) continue;
                const secs = Math.round((row[1] - midnight) / 1000);
                const hour = Math.floor(secs / 3600) % 24;
                const entry: Entry = { hour, minute: Math.floor((secs % 3600) / 60), secs, tripRef: row[0], headsign: rowHeadsign(row, data.legend, headsign), exitOnly, brigade: row[5] ?? "" };
                if (!found && key === todayClass) {
                    if (secs >= nowSecs) {
                        found = true;
                        entry.closest = true;
                    } else entry.closest = false;
                }
                const last = out[key].find((group) => group.hour === hour);
                if (last) last.list.push(entry);
                else out[key].push({ hour, list: [entry] });
            }
        }
        return out;
    }, [data, dates, showExitOnly, nowState, todayClass, headsign, timeZone]);

    const shortcuts = useMemo(() => {
        const all = new Set<string>();
        for (const key of WEEKDAYS) for (const group of schedule[key]) for (const entry of group.list) if (entry.headsign) all.add(entry.headsign);
        return headsignShortcuts([...all]);
    }, [schedule]);

    const legend = useMemo(() => {
        const list: string[] = [];
        let exit = false;
        for (const group of schedule[weekday]) {
            for (const entry of group.list) {
                if (!entry.headsign) continue;
                if (!entry.exitOnly) {
                    list.push(entry.headsign);
                    continue;
                }
                if (showExitOnly) {
                    list.push(entry.headsign);
                    exit = true;
                }
            }
        }
        const items: { label: ReactNode; shortcut: string }[] = [...new Set(list)].map((value) => ({
            label: (
                <>
                    {t("global.tripHeadsign")} <em>{value}</em>
                </>
            ),
            shortcut: shortcuts.get(value) || value[0] || "?",
        }));
        if (exit) items.push({ label: <em>{t("timetables.exitOnly")}</em>, shortcut: "*" });
        return items;
    }, [schedule, weekday, shortcuts, showExitOnly, t]);

    const rawRows = (key: (typeof WEEKDAYS)[number]) => {
        const index = dates[key];
        return index === undefined ? [] : (data.timetable[String(index)] ?? []).filter((row) => (row[2] & ALIGHT.Forbidden) === 0);
    };
    const count = (key: (typeof WEEKDAYS)[number]) => rawRows(key).filter((row) => !isExitOnly(row[2])).length;

    const panel = (key: (typeof WEEKDAYS)[number]) => {
        const rows = rawRows(key);
        const hasExitOnly = rows.some((row) => isExitOnly(row[2]));
        const allExitOnly = !showExitOnly && rows.length > 0 && rows.every((row) => isExitOnly(row[2]));
        if (schedule[key].length === 0 && !allExitOnly) return <Typography variant="body1">{t("timetables.schedulesNotFound")}</Typography>;
        return (
            <>
                {hasExitOnly && (
                    <FormControlLabel
                        sx={{ m: 0.5 }}
                        control={<Switch size="small" checked={showExitOnly} onChange={() => setShowExitOnly((value) => !value)} color="primary" />}
                        label={t("timetables.showExitOnly")}
                    />
                )}
                {allExitOnly ? (
                    <Typography variant="body1" sx={{ my: 2 }}>
                        {t("timetables.schedulesNotFoundTurnOnExitOnly")}
                    </Typography>
                ) : (
                    <TimetableTable entries={schedule[key]} shortcuts={shortcuts} showExitOnly={showExitOnly} city={city} routeType={routeType} brigadeLink={brigadeLink} />
                )}
            </>
        );
    };

    return (
        <Box sx={{ marginBottom: "80px" }}>
            {alerts}
            <Tabs value={weekday} onChange={(_, value) => setWeekday(value)} indicatorColor="primary" textColor="primary" variant="fullWidth" scrollButtons="auto" allowScrollButtonsMobile>
                <Tab value="workday" label={t("timetables.workdays")} />
                <Tab value="saturday" label={t("timetables.saturdays")} />
                <Tab value="holiday" label={t("timetables.sundaysAndHolidays")} />
            </Tabs>
            <Box sx={{ my: 2 }}>
                {WEEKDAYS.map((key) => (
                    <div key={key} role="tabpanel" hidden={weekday !== key} id={`tabpanel-${key}`} aria-labelledby={`tabpanel-${key}`}>
                        {weekday === key && <Box sx={{ p: 0 }}>{panel(key)}</Box>}
                    </div>
                ))}
            </Box>
            <Divider sx={{ my: 2 }} />
            {legend.length > 0 && (
                <>
                    <Typography variant="body1">{t("timetables.legend")}:</Typography>
                    <ul style={{ marginTop: 0 }}>
                        {legend.map((item) => (
                            <li key={item.shortcut}>
                                <Typography variant="caption">
                                    <strong>{item.shortcut}</strong> - {item.label}
                                </Typography>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            <Typography variant="body1">
                <Trans i18nKey="timetables.description1" values={{ url_stop_name: stopName, city: cityName }} components={[<strong key="1" />]} />
            </Typography>
            <Typography variant="caption">
                <Trans i18nKey="timetables.description2" values={{ type: t(typeReadableKey(routeType)), url_stop_name: stopName, route_id: routeName, city: cityName }} components={[<strong key="1" />]} />
            </Typography>
            <ul style={{ margin: 0 }}>
                <li>
                    <Typography variant="caption">
                        {count("workday")} {t("timetables.description3")}
                    </Typography>
                </li>
                <li>
                    <Typography variant="caption">
                        {count("saturday")} {t("timetables.description4")}
                    </Typography>
                </li>
                <li>
                    <Typography variant="caption">
                        {count("holiday")} {t("timetables.description5")}
                    </Typography>
                </li>
            </ul>
        </Box>
    );
};

// Metro stations: departures listed per hour for each direction, with Friday as its own tab.
const FREQ_WEEKDAYS = ["workday", "friday", "saturday", "holiday"] as const;

export const SubwayTimetable = ({ data, routeName, routeType, stopName, cityName, headsign, alerts, timeZone = "Europe/Warsaw" }: Omit<Props, "city" | "brigadeLink">) => {
    const { t } = useTranslation();
    const now = zonedNow(timeZone);
    const todayClass = weekdayOf(now.day, true);
    const [weekday, setWeekday] = useUrlTab<(typeof FREQ_WEEKDAYS)[number]>("weekday", FREQ_WEEKDAYS, todayClass);
    const dates = useMemo(() => pickDates(Object.keys(data.timetable).map(Number), timeZone), [data, timeZone]);
    const byHeadsign = useMemo(() => {
        const out: Record<string, Record<string, { hour: string; times: string[] }[]>> = {};
        for (const key of FREQ_WEEKDAYS) {
            const index = dates[key] ?? (key === "friday" ? dates.workday : undefined);
            const table: Record<string, { hour: string; times: string[] }[]> = {};
            if (index !== undefined) {
                const midnight = serviceMidnight(index, timeZone);
                for (const row of data.timetable[String(index)] ?? []) {
                    if ((row[2] & ALIGHT.Forbidden) !== 0) continue;
                    const name = rowHeadsign(row, data.legend, headsign);
                    const secs = Math.round((row[1] - midnight) / 1000);
                    const hour = String(Math.floor(secs / 3600) % 24);
                    const list = (table[name] ??= []);
                    let group = list.find((item) => item.hour === hour);
                    if (!group) list.push((group = { hour, times: [] }));
                    group.times.push(String(Math.floor((secs % 3600) / 60)).padStart(2, "0"));
                }
            }
            out[key] = table;
        }
        return out;
    }, [data, dates, headsign, timeZone]);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    return (
        <Box>
            {alerts}
            <Tabs value={weekday} onChange={(_, value) => setWeekday(value)} indicatorColor="primary" textColor="primary" variant="fullWidth" scrollButtons="auto" allowScrollButtonsMobile>
                <Tab value="workday" label={t("timetables.workdays")} />
                <Tab value="friday" label={t("timetables.fridays")} />
                <Tab value="saturday" label={t("timetables.saturdays")} />
                <Tab value="holiday" label={t("timetables.sundaysAndHolidays")} />
            </Tabs>
            <Box sx={{ my: 2 }}>
                <Box>
                    {Object.keys(byHeadsign[weekday] ?? {}).map((name) => (
                        <Accordion key={name} expanded={!collapsed[name]} onChange={() => setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }))}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>
                                    {t("global.tripHeadsign")} → {name}
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>{t("stopDetails.hour")}</TableCell>
                                            <TableCell>{t("stopDetails.howOften")}</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {byHeadsign[weekday][name].map((group) => (
                                            <TableRow key={group.hour} className={weekday === todayClass && Math.floor(now.minutes / 60) === Number(group.hour) ? "border-primary" : ""}>
                                                <TableCell align="right">{group.hour}</TableCell>
                                                <TableCell>
                                                    {group.times.map((time, index) => (
                                                        <span key={`${group.hour}-${time}-${index}`}>
                                                            {time}
                                                            {index !== group.times.length - 1 && ", "}
                                                        </span>
                                                    ))}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption">
                <Trans i18nKey="timetables.subwayDescription1" values={{ url_stop_name: stopName, route_id: routeName, city: cityName }} components={[<strong key="1" />]} />
            </Typography>{" "}
            <Typography variant="caption">
                <Trans i18nKey="timetables.subwayDescription2" values={{ url_stop_name: stopName, route_id: routeName, city: cityName, type: t(typeReadableKey(routeType)) }} components={[<strong key="1" />]} />
            </Typography>
        </Box>
    );
};

// Warning box listing the line's alerts (collapsed by default).
export const RouteAlertBox = ({ routeName, items }: { routeName: string; items: { key: string; title: string; to?: string }[] }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    if (!items.length) return null;
    return (
        <Alert
            severity="warning"
            sx={{ my: 2, py: 0, cursor: "pointer" }}
            onClick={() => setOpen((value) => !value)}
            action={<ShowMoreButton expanded={open} onClick={() => setOpen((value) => !value)} />}
        >
            <AlertTitle>{t("timetables.alerts")}</AlertTitle>
            <Collapse in={open} timeout="auto" unmountOnExit>
                <>
                    <Typography variant="body1" gutterBottom>
                        <Trans i18nKey="timetables.alertsHeader" values={{ route_id: routeName }} components={[<strong key="1" />]} />
                    </Typography>
                    <ul>
                        {items.map((item) => (
                            <li key={item.key}>{item.to ? <Link to={item.to} style={{ marginTop: 10 }}>{item.title}</Link> : item.title}</li>
                        ))}
                    </ul>
                </>
            </Collapse>
        </Alert>
    );
};
