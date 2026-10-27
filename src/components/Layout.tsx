import AddToHomeScreenIcon from "@mui/icons-material/AddToHomeScreen";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import SearchIcon from "@mui/icons-material/Search";
import { AppBar, BottomNavigation, BottomNavigationAction, Box, Button, IconButton, Toolbar, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCity } from "@/api/cities";
import { Loading } from "@/components/Loading";
import { useInstallPrompt } from "@/components/settings/install";
import { activeBottomNavPath, bottomNavPaths, isBottomNavRoot, NAV_ENTRIES, resolveBackTarget } from "@/lib/navigation";
import { APP_BAR_HEIGHT, BOTTOM_NAV_HEIGHT, setShowSearch, shellStore, useShell } from "@/lib/shell";
import { useSettings } from "@/store/settings";

const GlobalSearch = lazy(() => import("@/components/search/GlobalSearch"));

const IS_MOBILE = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);
const HIDDEN_SEARCH_QUERIES = ["przystanek=", "pojazd="];

const TopToolbar = styled(Toolbar)`
    && {
        justify-content: space-between;
        min-height: ${APP_BAR_HEIGHT}px;
    }
`;

const CityLink = styled(Link)({
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
    textDecoration: "none",
    color: "inherit",
    cursor: "pointer",
    height: `${APP_BAR_HEIGHT}px`,
});

const CityRow = styled("div", { shouldForwardProp: (prop) => prop !== "hasCustomText" })<{ hasCustomText: boolean }>(({ hasCustomText }) => ({
    display: "flex",
    alignItems: "center",
    transformOrigin: "left center",
    transform: hasCustomText ? "scale(0.875)" : "scale(1)",
    transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
}));

const CityName = styled(Typography)({
    display: "block",
    maxWidth: "14ch",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

const CustomText = styled(Typography)({
    display: "block",
    fontSize: "0.875rem",
    lineHeight: 1.2,
    color: "rgba(0, 0, 0, 0.6)",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    animation: "slideUp 0.3s ease",
    "@keyframes slideUp": {
        from: { opacity: 0, transform: "translateY(8px)" },
        to: { opacity: 1, transform: "translateY(0)" },
    },
});

export const BottomBar = styled(BottomNavigation)({
    width: "100%",
    position: "fixed",
    bottom: 0,
    zIndex: 1000,
    height: `calc(env(safe-area-inset-bottom) + ${BOTTOM_NAV_HEIGHT}px)`,
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
    boxShadow: "0px -5px 10px 0px rgba(0, 0, 0, 0.12)",
    backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.09))",
    transition: "transform 250ms ease-out",
    "body.drawer-column-active &": { transform: "translateY(100%)", pointerEvents: "none" },
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
});

export const BottomBarAction = styled(BottomNavigationAction)`
    padding: 0 6px;

    && .Mui-selected {
        font-size: 0.9375rem;
        color: var(--primary);
    }

    .MuiBottomNavigationAction-label {
        font-size: 0.9375rem;
        text-align: center;
    }
` as typeof BottomNavigationAction;

const useRootPaths = () => {
    const [settings] = useSettings();
    const city = settings.city ?? "";
    return { city, rootPaths: useMemo(() => bottomNavPaths(settings.bottomNav, city), [settings.bottomNav, city]) };
};

const BackButton = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { city, rootPaths } = useRootPaths();
    const history = useShell((shell) => shell.viewsHistory);
    const { pathname, search } = location;

    useEffect(() => {
        if (pathname === "/") return;
        const current = shellStore.get().viewsHistory;
        if ((current[current.length - 1] !== "/ustawienia" || rootPaths.includes(pathname)) && isBottomNavRoot(pathname, search, rootPaths, city)) {
            shellStore.set({ viewsHistory: [pathname] });
            return;
        }
        const next = current.filter((entry) => entry !== pathname + search);
        if ((location.state as { addToHistory?: boolean } | null)?.addToHistory !== false) next.push(pathname + search);
        shellStore.set({ viewsHistory: next });
    }, [location]);

    const target = useMemo(() => resolveBackTarget(pathname, search, history, rootPaths, city), [pathname, search, history, rootPaths, city]);
    if (!history.length || !target) return null;

    const goBack = () => {
        const next = [...history];
        next.pop();
        shellStore.set({ viewsHistory: next });
        navigate(history.length > 1 ? next[next.length - 1] : target, { replace: true });
    };

    return (
        <Box sx={{ display: "inline-flex", animation: "backIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)", "@keyframes backIn": { from: { opacity: 0, transform: "translateX(-20px)" }, to: { opacity: 1, transform: "none" } } }}>
            <IconButton style={{ padding: 0, marginRight: 12 }} color="inherit" onClick={goBack} size="large" aria-label="Wstecz">
                <ArrowBackIcon />
            </IconButton>
        </Box>
    );
};

const TopBar = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const [settings] = useSettings();
    const city = useCity(settings.city ?? undefined);
    const customText = useShell((shell) => shell.customText);
    const { canPrompt, installed, install } = useInstallPrompt();
    const showInstall = !installed && IS_MOBILE && !!settings.city;
    const maxWidth = showInstall ? "calc(100vw - 48px - 36px - 48px - 15px - 115px)" : "calc(100vw - 48px - 36px - 48px - 15px)";
    const cityName = city?.name ?? t("chooseCity.chooseCity");

    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="fixed" color="default">
                <TopToolbar>
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <BackButton />
                        <CityLink to="/miasto" style={{ maxWidth }}>
                            <CityRow hasCustomText={!!customText}>
                                <CityName variant="body1" noWrap>
                                    {cityName}
                                </CityName>
                                {location.pathname !== "/miasto" && <ArrowDropDownIcon />}
                            </CityRow>
                            {customText && (
                                <CustomText variant="body2" noWrap>
                                    {customText}
                                </CustomText>
                            )}
                        </CityLink>
                    </div>
                    {HIDDEN_SEARCH_QUERIES.every((query) => !location.search.includes(query)) && (
                        <Box sx={{ display: "flex" }}>
                            <IconButton color="inherit" onClick={() => setShowSearch(true)} size="large" aria-label="Search">
                                <SearchIcon />
                            </IconButton>
                            {showInstall &&
                                (canPrompt ? (
                                    <Button variant="text" color="inherit" onClick={() => void install()} size="small" startIcon={<AddToHomeScreenIcon />}>
                                        {t("settings.install")}
                                    </Button>
                                ) : (
                                    <Button variant="text" color="inherit" component={Link} to="/ustawienia/instalacja" size="small" startIcon={<AddToHomeScreenIcon />}>
                                        {t("settings.install")}
                                    </Button>
                                ))}
                        </Box>
                    )}
                </TopToolbar>
            </AppBar>
        </Box>
    );
};

const BottomMenu = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const [settings] = useSettings();
    const { city, rootPaths } = useRootPaths();
    const [value, setValue] = useState<string | null>(null);

    useEffect(() => {
        setValue(activeBottomNavPath(location.pathname, location.search, rootPaths, city));
    }, [location.pathname, location.search, rootPaths, city]);

    return (
        <div>
            <BottomBar value={value} onChange={(_, next) => setValue(next)} showLabels className="safe-area-bottom">
                {settings.bottomNav
                    .map((key) => NAV_ENTRIES[key])
                    .filter(Boolean)
                    .map((entry) => {
                        const path = entry.path(city);
                        const label = t(entry.titleKey);
                        return (
                            <BottomBarAction
                                key={entry.key}
                                component={Link}
                                to={path}
                                label={label}
                                value={path}
                                icon={
                                    <IconButton component="div" color="inherit" size="large" sx={{ p: 0 }} aria-label={label}>
                                        {entry.icon}
                                    </IconButton>
                                }
                            />
                        );
                    })}
            </BottomBar>
        </div>
    );
};

export const Layout = () => {
    const location = useLocation();
    const [settings] = useSettings();
    const showSearch = useShell((shell) => shell.showSearch);
    const isMap = !!settings.city && location.pathname === `/${settings.city}`;

    return (
        <>
            <TopBar />
            <main className={isMap ? "app-content fullscreen" : "app-content"}>
                <Suspense fallback={<Loading />}>
                    <Outlet />
                </Suspense>
            </main>
            <BottomMenu />
            {showSearch && (
                <Suspense fallback={null}>
                    <GlobalSearch />
                </Suspense>
            )}
        </>
    );
};
