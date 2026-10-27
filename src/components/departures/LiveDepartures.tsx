import { Box, Button, Skeleton, Typography } from "@mui/material";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EDeparture, EStopDepartureTuple, ETripTuple, type StopDepartureTuple } from "@/api/types";
import { useSettings } from "@/store/settings";
import { DepartureRow, VehicleExtrasContext } from "./DepartureRow";
import { useDepartureVehicles } from "./useDepartureVehicles";
import { useNow } from "./departureUtils";
import { useStopDepartures } from "./useStopDepartures";

type Props = {
    city: string;
    stopId: string;
    limit?: number;
    compact?: boolean;
    routes?: string[];
    showMore?: boolean;
    onSelect?: (departure: StopDepartureTuple) => void;
    mapCity?: string;
};

const MAX_LIMIT = 100;

export const LiveDepartures = ({ city, stopId, limit: initialLimit = 10, compact, routes, showMore = true, onSelect, mapCity }: Props) => {
    const { t } = useTranslation();
    const [settings] = useSettings();
    const [limit, setLimit] = useState(initialLimit);
    const [loadingMore, setLoadingMore] = useState(false);
    const now = useNow();
    const [active, setActive] = useState<number | null>(null);
    const { departures, error } = useStopDepartures(city, stopId, { limit, routes });
    const provided = useContext(VehicleExtrasContext);
    const ownExtras = useDepartureVehicles(city, provided === null);

    useEffect(() => setLimit(initialLimit), [city, stopId, initialLimit]);
    useEffect(() => setLoadingMore(false), [departures]);

    if (!departures && error) {
        return (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", m: 2 }}>
                <Typography variant="h4">{error === "STOP_NOT_FOUND" ? t("stopDetails.stopNotFound") : t("global.error")}</Typography>
            </Box>
        );
    }

    if (!departures) {
        return (
            <div>
                {["first", "second", "third"].map((key) => (
                    <Skeleton key={key} animation="wave" variant="text" height={50} width="100%" style={{ marginBottom: 5 }} />
                ))}
            </div>
        );
    }

    if (departures.length === 0) {
        return (
            <Box sx={{ m: 2 }}>
                <Typography variant="body1">{t("stopDetails.noSchedulesInfo")}</Typography>
            </Box>
        );
    }

    return (
        <VehicleExtrasContext.Provider value={provided ?? ownExtras}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {departures.map((departure, index) => (
                    <DepartureRow
                        key={`${departure[EStopDepartureTuple.trip][ETripTuple.tripId]}-${departure[EStopDepartureTuple.departure][EDeparture.scheduledDeparture]}`}
                        city={mapCity ?? city}
                        departure={departure}
                        now={now}
                        compact={compact}
                        showBrigade={settings.departuresShowBrigade}
                        showVehicleNo={settings.departuresShowVehicleNo}
                        active={index === active}
                        onSelect={
                            onSelect
                                ? (selected) => {
                                      setActive(index);
                                      onSelect(selected);
                                  }
                                : undefined
                        }
                    />
                ))}
                {showMore && limit < MAX_LIMIT && departures.length >= limit && (
                    <Button
                        variant="outlined"
                        fullWidth
                        disabled={loadingMore}
                        sx={{ mt: 4 }}
                        className="text-default-text"
                        onClick={() => {
                            setLoadingMore(true);
                            setLimit((value) => Math.min(MAX_LIMIT, value + 10));
                        }}
                    >
                        {loadingMore ? `${t("global.loading")}...` : t("stopDetails.showLaterSchedules")}
                    </Button>
                )}
            </Box>
        </VehicleExtrasContext.Provider>
    );
};

export default LiveDepartures;
