import { Tab, Tabs } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { cityGet } from "@/api/client";
import { useCity } from "@/api/cities";
import { useApi } from "@/api/useApi";
import { dateIndexToDate, todayDateIndex } from "@/lib/transit";

export const DATE_PARAM = "dzien";

// dayjs "pl" weekdaysShort, as in the original tabs.
const WEEKDAYS_SHORT = ["ndz", "pon", "wt", "śr", "czw", "pt", "sob"];

export const formatDateTab = (index: number) => {
    const date = dateIndexToDate(index);
    const weekday = WEEKDAYS_SHORT[date.getUTCDay()];
    const day = date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
    return `${weekday}, ${day}`;
};

export const formatDateLong = (index: number) =>
    dateIndexToDate(index).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Service dates of the city plus the selected one (kept in the ?dzien= search param, default today).
export const useBrigadeDate = (city: string) => {
    const cityInfo = useCity(city);
    const timeZone = cityInfo?.timezone ?? "Europe/Warsaw";
    const [params, setParams] = useSearchParams();
    const dates = useApi((signal) => cityGet<number[]>(city, "/dates", undefined, signal), [city]);
    const today = todayDateIndex(timeZone);
    const fromUrl = Number(params.get(DATE_PARAM));
    const available = dates.data ?? [];
    const selected = fromUrl > 0 ? fromUrl : available.includes(today) || !available.length ? today : available[0];

    const setDate = (date: number) => {
        const next = new URLSearchParams(params);
        if (date === today) next.delete(DATE_PARAM);
        else next.set(DATE_PARAM, String(date));
        setParams(next, { replace: true });
    };

    return { dates: available, loading: dates.loading, error: dates.error, selected, today, setDate, isToday: selected === today, timeZone };
};

export const DateTabs = ({ dates, selected, onChange }: { dates: number[]; selected: number; onChange: (date: number) => void }) => {
    const list = dates.includes(selected) ? dates : [...dates, selected].sort((a, b) => a - b);
    return (
        <Tabs
            value={list.indexOf(selected)}
            onChange={(_, index) => onChange(list[index])}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
        >
            {list.map((date) => (
                <Tab key={date} label={formatDateTab(date)} />
            ))}
        </Tabs>
    );
};
