import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { CitiesProvider, useCities } from "./api/cities";
import { Layout } from "./components/Layout";
import { Loading } from "./components/Loading";
import { useSettings } from "./store/settings";

const ChooseCityPage = lazy(() => import("./pages/city/ChooseCityPage"));
const MapPage = lazy(() => import("./pages/map/MapPage"));
const LcdMapPage = lazy(() => import("./pages/map/LcdMapPage"));
const TimetableIndexPage = lazy(() => import("./pages/timetable/TimetableIndexPage"));
const RouteTimetablePage = lazy(() => import("./pages/timetable/RouteTimetablePage"));
const StopTimetablePage = lazy(() => import("./pages/timetable/StopTimetablePage"));
const FavouritesPage = lazy(() => import("./pages/timetable/FavouritesPage"));
const StopDisplayPage = lazy(() => import("./pages/timetable/StopDisplayPage"));
const VehicleDisplayPage = lazy(() => import("./pages/timetable/VehicleDisplayPage"));
const AlertsPage = lazy(() => import("./pages/alerts/AlertsPage"));
const AlertPage = lazy(() => import("./pages/alerts/AlertPage"));
const AlertsHistoryPage = lazy(() => import("./pages/alerts/AlertsHistoryPage"));
const CancelledTripsPage = lazy(() => import("./pages/alerts/CancelledTripsPage"));
const DelaysPage = lazy(() => import("./pages/stats/DelaysPage"));
const DelaysRankingPage = lazy(() => import("./pages/stats/DelaysRankingPage"));
const StatsPage = lazy(() => import("./pages/stats/StatsPage"));
const BrigadeListPage = lazy(() => import("./pages/brigades/BrigadeListPage"));
const BrigadePage = lazy(() => import("./pages/brigades/BrigadePage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const SettingsSubPage = lazy(() => import("./pages/settings/SettingsSubPage"));
const AboutPage = lazy(() => import("./pages/settings/AboutPage"));

// Keeps settings.city in sync with the :city segment and rejects unknown cities.
const CityGate = ({ children }: { children: JSX.Element }) => {
    const { city } = useParams();
    const { byId, ready } = useCities();
    const [settings, setSettings] = useSettings();

    useEffect(() => {
        if (city && byId[city] && settings.city !== city) setSettings({ city });
    }, [city, byId[city ?? ""]]);

    if (!ready) return <Loading />;
    if (!city || !byId[city]) return <Navigate to="/miasto" replace />;
    return children;
};

const Home = () => {
    const [settings] = useSettings();
    const { byId, ready } = useCities();
    if (!ready) return <Loading />;
    return <Navigate to={settings.city && byId[settings.city] ? `/${settings.city}` : "/miasto"} replace />;
};

const ScrollReset = () => {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
};

const city = (element: JSX.Element) => <CityGate>{element}</CityGate>;

export default function App() {
    return (
        <CitiesProvider>
            <ScrollReset />
            <Suspense fallback={<Loading />}>
                <Routes>
                    <Route path="/:city/lcd-map" element={city(<LcdMapPage />)} />
                    <Route path="/:city/stop-display" element={city(<StopDisplayPage />)} />
                    <Route path="/:city/vehicle-display" element={city(<VehicleDisplayPage />)} />
                    <Route element={<Layout />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/miasto" element={<ChooseCityPage />} />
                        <Route path="/o-aplikacji" element={<AboutPage />} />
                        <Route path="/ustawienia" element={<SettingsPage />} />
                        <Route path="/ustawienia/:section" element={<SettingsSubPage />} />
                        <Route path="/opoznienia-ranking-miasta-autobusy-tramwaje" element={<DelaysRankingPage />} />
                        <Route path="/:city" element={city(<MapPage />)} />
                        <Route path="/:city/ulubione" element={city(<FavouritesPage />)} />
                        <Route path="/:city/statystyki" element={city(<StatsPage />)} />
                        <Route path="/:city/komunikaty" element={city(<AlertsPage />)} />
                        <Route path="/:city/komunikaty/komunikat" element={city(<AlertPage />)} />
                        <Route path="/:city/komunikaty/historia/:rodzaj/:strona" element={city(<AlertsHistoryPage />)} />
                        <Route path="/:city/komunikaty/:rodzaj" element={city(<AlertsPage />)} />
                        <Route path="/:city/rozklad-jazdy" element={city(<TimetableIndexPage />)} />
                        <Route path="/:city/rozklad-jazdy/linia/:routeId" element={city(<RouteTimetablePage />)} />
                        <Route path="/:city/rozklad-jazdy/przystanek/:stopId" element={city(<StopTimetablePage />)} />
                        <Route path="/:city/rozklad-jazdy/przystanek/:stopId/linia/:routeId" element={city(<StopTimetablePage />)} />
                        <Route path="/:city/rozklad-jazdy-brygady" element={city(<BrigadeListPage />)} />
                        <Route path="/:city/rozklad-jazdy-brygady/linia/:routeId/brygada/:brigade" element={city(<BrigadePage />)} />
                        <Route path="/:city/laczony-rozklad-jazdy-brygady" element={city(<BrigadeListPage multi />)} />
                        <Route path="/:city/laczony-rozklad-jazdy-brygady/linia/:routeId/brygada/:brigade" element={city(<BrigadePage multi />)} />
                        <Route path="/:city/opoznienia-autobusy-tramwaje" element={city(<DelaysPage />)} />
                        <Route path="/:city/odwolane-kursy" element={city(<CancelledTripsPage />)} />
                        <Route path="*" element={<Home />} />
                    </Route>
                </Routes>
            </Suspense>
        </CitiesProvider>
    );
}
