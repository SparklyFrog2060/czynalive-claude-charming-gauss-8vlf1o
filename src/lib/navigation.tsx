import AddToHomeScreenIcon from "@mui/icons-material/AddToHomeScreen";
import BarChartIcon from "@mui/icons-material/BarChart";
import CancelIcon from "@mui/icons-material/Cancel";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import DepartureBoardIcon from "@mui/icons-material/DepartureBoard";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ErrorIcon from "@mui/icons-material/Error";
import EventNoteIcon from "@mui/icons-material/EventNote";
import HistoryIcon from "@mui/icons-material/History";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import InfoIcon from "@mui/icons-material/Info";
import LightModeIcon from "@mui/icons-material/LightMode";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import LooksOneIcon from "@mui/icons-material/LooksOne";
import MenuIcon from "@mui/icons-material/Menu";
import RoomIcon from "@mui/icons-material/Room";
import StarIcon from "@mui/icons-material/Star";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import TranslateIcon from "@mui/icons-material/Translate";
import type { ReactNode } from "react";
import type { BottomNavItem } from "@/store/settings";

export type SettingsPart = "city" | "preferences" | "app";

// Port of the original route table: back target, owning bottom-nav tab and the settings menu entry of every screen.
export type RouteConfig = {
    pattern: string;
    back: string | null;
    mainPartBottomNav: string | null;
    settingsOrder?: number;
    settingsPart?: SettingsPart;
    settingsIcon?: ReactNode;
    menuTitleKey?: string;
    bottomNavTitleKey?: string;
    shortcut?: BottomNavItem;
};

const C = "/{{city}}";

export const ROUTES: RouteConfig[] = [
    { pattern: `${C}/rozklad-jazdy/linia/{{ROUTE_ID}}`, back: `${C}/rozklad-jazdy`, mainPartBottomNav: `${C}/rozklad-jazdy` },
    { pattern: `${C}/rozklad-jazdy/linia/{{ROUTE_ID}}?`, back: `${C}/rozklad-jazdy`, mainPartBottomNav: `${C}/rozklad-jazdy` },
    { pattern: `${C}/rozklad-jazdy/przystanek/{{STOP_NAME}}/linia/{{ROUTE_ID}}`, back: `${C}/rozklad-jazdy/przystanek/{{STOP_NAME}}`, mainPartBottomNav: `${C}/rozklad-jazdy` },
    { pattern: `${C}/rozklad-jazdy/przystanek/{{STOP_NAME}}`, back: `${C}/rozklad-jazdy`, mainPartBottomNav: `${C}/rozklad-jazdy` },
    { pattern: `${C}/laczony-rozklad-jazdy-brygady/linia/{{ROUTE_ID}}/brygada/{{BRIGADE}}`, back: `${C}/laczony-rozklad-jazdy-brygady`, mainPartBottomNav: `${C}/laczony-rozklad-jazdy-brygady` },
    {
        pattern: `${C}/laczony-rozklad-jazdy-brygady`,
        back: "/ustawienia",
        mainPartBottomNav: `${C}/laczony-rozklad-jazdy-brygady`,
        settingsOrder: 7,
        settingsPart: "city",
        settingsIcon: <DepartureBoardIcon />,
        menuTitleKey: "brigadeScheduleList.brigadeScheduleMulti",
        bottomNavTitleKey: "brigadeScheduleList.brigadeScheduleMultiBottomNav",
        shortcut: "multiBrigades",
    },
    { pattern: `${C}/rozklad-jazdy-brygady/linia/{{ROUTE_ID}}/brygada/{{BRIGADE}}`, back: `${C}/rozklad-jazdy-brygady`, mainPartBottomNav: `${C}/rozklad-jazdy-brygady` },
    {
        pattern: `${C}/rozklad-jazdy-brygady`,
        back: "/ustawienia",
        mainPartBottomNav: `${C}/rozklad-jazdy-brygady`,
        settingsOrder: 6,
        settingsPart: "city",
        settingsIcon: <DepartureBoardIcon />,
        menuTitleKey: "brigadeScheduleList.brigadeSchedule",
        bottomNavTitleKey: "brigadeScheduleList.brigadeScheduleBottomNav",
        shortcut: "brigades",
    },
    { pattern: "/ustawienia", back: null, mainPartBottomNav: "/ustawienia", settingsIcon: <MenuIcon />, menuTitleKey: "Menu", bottomNavTitleKey: "Menu", shortcut: "menu" },
    {
        pattern: "/miasto",
        back: "/ustawienia",
        mainPartBottomNav: "/ustawienia",
        settingsOrder: 1,
        settingsPart: "preferences",
        settingsIcon: <LocationCityIcon />,
        menuTitleKey: "chooseCity.city",
    },
    {
        pattern: `${C}/ulubione`,
        back: "/ustawienia",
        mainPartBottomNav: `${C}/ulubione`,
        settingsOrder: 2,
        settingsPart: "city",
        settingsIcon: <StarIcon />,
        menuTitleKey: "favourites.favourites",
        bottomNavTitleKey: "favourites.favourites",
        shortcut: "favourites",
    },
    {
        pattern: `${C}/rozklad-jazdy`,
        back: "/ustawienia",
        mainPartBottomNav: `${C}/rozklad-jazdy`,
        settingsOrder: 4,
        settingsPart: "city",
        settingsIcon: <EventNoteIcon />,
        menuTitleKey: "timetables.timetable",
        bottomNavTitleKey: "timetables.timetables",
        shortcut: "timetable",
    },
    {
        pattern: C,
        back: null,
        mainPartBottomNav: C,
        settingsOrder: 1,
        settingsPart: "city",
        settingsIcon: <RoomIcon />,
        menuTitleKey: "map.map",
        bottomNavTitleKey: "map.map",
        shortcut: "map",
    },
    {
        pattern: "/o-aplikacji",
        back: "/ustawienia",
        mainPartBottomNav: "/ustawienia",
        settingsOrder: 1,
        settingsPart: "app",
        settingsIcon: <InfoIcon />,
        menuTitleKey: "settings.aboutApp",
    },
    {
        pattern: `${C}/statystyki`,
        back: "/ustawienia",
        mainPartBottomNav: `${C}/statystyki`,
        settingsOrder: 8,
        settingsPart: "city",
        settingsIcon: <BarChartIcon />,
        menuTitleKey: "stats.stats",
        bottomNavTitleKey: "stats.stats",
        shortcut: "stats",
    },
    {
        pattern: "/ustawienia/instalacja",
        back: "/ustawienia",
        mainPartBottomNav: "/ustawienia",
        settingsOrder: 3,
        settingsPart: "app",
        settingsIcon: <AddToHomeScreenIcon className="fill-primary" />,
        menuTitleKey: "settings.appInstallation",
    },
    {
        pattern: "/ustawienia/znaczniki-pojazdow",
        back: "/ustawienia",
        mainPartBottomNav: "/ustawienia",
        settingsOrder: 4,
        settingsPart: "preferences",
        settingsIcon: <LooksOneIcon />,
        menuTitleKey: "settings.markers",
    },
    {
        pattern: "/ustawienia/przystanek-odjazdy",
        back: "/ustawienia",
        mainPartBottomNav: "/ustawienia",
        settingsOrder: 5,
        settingsPart: "preferences",
        settingsIcon: <EventNoteIcon />,
        menuTitleKey: "settings.timetableSettings",
    },
    {
        pattern: "/ustawienia/lokalizacjastartowa",
        back: "/ustawienia",
        mainPartBottomNav: "/ustawienia",
        settingsOrder: 3,
        settingsPart: "preferences",
        settingsIcon: <RoomIcon />,
        menuTitleKey: "settings.locationTitleShort",
    },
    {
        pattern: "/ustawienia/aktualizacja-aplikacji",
        back: "/ustawienia",
        mainPartBottomNav: "/ustawienia",
        settingsOrder: 2,
        settingsPart: "app",
        settingsIcon: <SystemUpdateIcon />,
        menuTitleKey: "settings.checkUpdate",
    },
    {
        pattern: "/ustawienia/wyglad-aplikacji",
        back: "/ustawienia",
        mainPartBottomNav: "/ustawienia",
        settingsOrder: 6,
        settingsPart: "preferences",
        settingsIcon: (
            <>
                <LightModeIcon />
                <DarkModeIcon />
            </>
        ),
        menuTitleKey: "settings.darkModeShortTitle",
    },
    {
        pattern: "/ustawienia/language",
        back: "/ustawienia",
        mainPartBottomNav: "/ustawienia",
        settingsOrder: 7,
        settingsPart: "preferences",
        settingsIcon: <TranslateIcon />,
        menuTitleKey: "changeLanguage.language",
    },
    {
        pattern: "/ustawienia/konfiguracja-menu",
        back: "/ustawienia",
        mainPartBottomNav: "/ustawienia",
        settingsOrder: 8,
        settingsPart: "preferences",
        settingsIcon: <MenuIcon />,
        menuTitleKey: "settings.menuConfigTitle",
    },
    {
        pattern: "/ustawienia/import-export-data",
        back: "/ustawienia",
        mainPartBottomNav: "/ustawienia",
        settingsOrder: 9,
        settingsPart: "preferences",
        settingsIcon: <ImportExportIcon />,
        menuTitleKey: "settings.importExportTitle",
    },
    { pattern: "/ustawienia/buswifi", back: "/ustawienia", mainPartBottomNav: null },
    {
        pattern: `${C}/komunikaty`,
        back: "/ustawienia",
        mainPartBottomNav: `${C}/komunikaty`,
        settingsOrder: 3,
        settingsPart: "city",
        settingsIcon: <ErrorIcon />,
        menuTitleKey: "alerts.alerts",
        bottomNavTitleKey: "alerts.alerts",
        shortcut: "alerts",
    },
    { pattern: `${C}/komunikaty/{{ALERTS_TYPE}}`, back: "/ustawienia", mainPartBottomNav: `${C}/komunikaty` },
    { pattern: `${C}/komunikaty/historia`, back: `${C}/komunikaty`, mainPartBottomNav: `${C}/komunikaty` },
    { pattern: `${C}/komunikaty/historia/{{ALERT_TYPE}}`, back: `${C}/komunikaty`, mainPartBottomNav: `${C}/komunikaty` },
    { pattern: `${C}/komunikaty/historia/{{ALERT_TYPE}}/{{PAGE}}`, back: `${C}/komunikaty`, mainPartBottomNav: `${C}/komunikaty` },
    { pattern: `${C}/komunikaty/komunikat?`, back: `${C}/komunikaty`, mainPartBottomNav: `${C}/komunikaty` },
    {
        pattern: `${C}/opoznienia-autobusy-tramwaje`,
        back: "/ustawienia",
        mainPartBottomNav: `${C}/opoznienia-autobusy-tramwaje`,
        settingsOrder: 5,
        settingsPart: "city",
        settingsIcon: <HistoryIcon />,
        menuTitleKey: "delays.delays",
        bottomNavTitleKey: "delays.delays",
        shortcut: "delays",
    },
    {
        pattern: "/opoznienia-ranking-miasta-autobusy-tramwaje",
        back: "/ustawienia",
        mainPartBottomNav: "/opoznienia-ranking-miasta-autobusy-tramwaje",
        settingsOrder: 9,
        settingsPart: "city",
        settingsIcon: <EmojiEventsIcon />,
        menuTitleKey: "allCitiesDelays.menuTitle",
        bottomNavTitleKey: "allCitiesDelays.menuTitle",
    },
    {
        pattern: `${C}/odwolane-kursy`,
        back: "/ustawienia",
        mainPartBottomNav: `${C}/odwolane-kursy`,
        settingsOrder: 9,
        settingsPart: "city",
        settingsIcon: <CancelIcon />,
        menuTitleKey: "cancelledTrips.menuTitle",
        bottomNavTitleKey: "cancelledTrips.menuTitle",
        shortcut: "cancelled",
    },
];

export type NavEntry = { key: BottomNavItem; titleKey: string; menuTitleKey: string; icon: ReactNode; path: (city: string) => string };

export const withCity = (pattern: string, city: string) => pattern.replace("{{city}}", city);

export const NAV_ENTRIES = Object.fromEntries(
    ROUTES.filter((route) => route.shortcut).map((route) => [
        route.shortcut,
        {
            key: route.shortcut,
            titleKey: route.bottomNavTitleKey ?? route.menuTitleKey ?? "",
            menuTitleKey: route.menuTitleKey ?? "",
            icon: route.settingsIcon,
            path: (city: string) => withCity(route.pattern, city),
        },
    ]),
) as Record<BottomNavItem, NavEntry>;

export const settingsMenu = (part: SettingsPart) =>
    ROUTES.filter((route) => route.settingsPart === part && route.settingsOrder !== undefined).sort((a, b) => a.settingsOrder! - b.settingsOrder!);

const trimSlash = (path: string) => (path.endsWith("/") ? path.slice(0, -1) : path);

// Same semantics as the original matcher: {{PARAM}} segments match anything, a trailing "?" requires a query string.
export const matchesPattern = (pathname: string, pattern: string, search: string, city: string) => {
    if (pathname === `/${city}`) return true;
    if (!pattern) return false;
    const patternParts = trimSlash(pattern).split(/\?|\//);
    const pathParts = trimSlash(pathname).split("/");
    if (search !== "") pathParts.push(search);
    const same = patternParts.every((part, index) =>
        part.includes("{{") ? true : index === patternParts.length - 1 && part === "" ? pathParts[index]?.[0] === "?" : pathParts[index] === part,
    );
    return same && patternParts.length === pathParts.length;
};

export const fillParams = (pathname: string, target: string) => {
    if (target === "" || !target.includes("{{")) return target;
    const pathParts = pathname.split("/");
    return target
        .split("/")
        .map((part, index) => (part.includes("{{") ? pathParts[index] : part))
        .join("/");
};

export const bottomNavPaths = (items: BottomNavItem[], city: string) => items.map((key) => NAV_ENTRIES[key]?.path(city)).filter(Boolean);

export const isBottomNavRoot = (pathname: string, search: string, rootPaths: string[], city: string) =>
    rootPaths.some((root) => matchesPattern(pathname, root, search, city) || matchesPattern(pathname, root, "", city));

const hasSettingsBackInBottomNav = (pathname: string, search: string, rootPaths: string[], city: string) =>
    ROUTES.some((route) => {
        const main = route.mainPartBottomNav && withCity(route.mainPartBottomNav, city);
        return matchesPattern(pathname, withCity(route.pattern, city), search, city) && !!main && rootPaths.includes(main) && route.back === "/ustawienia";
    });

export const resolveBackTarget = (pathname: string, search: string, history: string[], rootPaths: string[], city: string): string | null => {
    const lastIsSettings = history[history.length - 1] === "/ustawienia";
    if (((!lastIsSettings || rootPaths.includes(pathname)) && isBottomNavRoot(pathname, search, rootPaths, city)) || hasSettingsBackInBottomNav(pathname, search, rootPaths, city))
        return null;
    for (const route of ROUTES) {
        if (matchesPattern(pathname, withCity(route.pattern, city), search, city)) return route.back ? fillParams(pathname, withCity(route.back, city)) : null;
    }
    return "/";
};

export const activeBottomNavPath = (pathname: string, search: string, rootPaths: string[], city: string) => {
    for (const route of ROUTES) {
        if (!matchesPattern(pathname, withCity(route.pattern, city), search, city)) continue;
        if (rootPaths.includes(pathname)) return pathname;
        const main = route.mainPartBottomNav && withCity(route.mainPartBottomNav, city);
        if (main && rootPaths.includes(main)) return main;
    }
    return "/ustawienia";
};
