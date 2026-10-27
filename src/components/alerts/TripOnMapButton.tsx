import MapIcon from "@mui/icons-material/Map";
import { Button, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { vehicleTypeName } from "@/components/departures/VehicleTypeIcon";

export const TripOnMapButton = ({ city, tripId, type }: { city: string; tripId: string; type: number }) => {
    const { t } = useTranslation();
    const name = vehicleTypeName(type);
    const dark = useTheme().palette.mode === "dark";
    return (
        <Button
            component={Link}
            to={`/${city}?kurs=${encodeURIComponent(tripId)}`}
            size="small"
            variant="outlined"
            startIcon={<MapIcon sx={{ fontSize: "0.9375rem !important" }} />}
            onClick={(event) => event.stopPropagation()}
            className={dark ? `border-tiny-${name} text-default-text` : `border-tiny-${name} text-${name}`}
            sx={{ textTransform: "none", px: 1, py: 0, minWidth: 0 }}
        >
            {t("stopDetails.tripOnMap")}
        </Button>
    );
};
