import BusinessIcon from "@mui/icons-material/Business";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CommuteIcon from "@mui/icons-material/Commute";
import { Alert, Box, List, ListItem, ListItemIcon, ListItemText, Skeleton, Typography, type SvgIconProps } from "@mui/material";
import { Fragment, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { cityGet } from "@/api/client";
import { EVehicle, type VehicleTuple } from "@/api/types";
import { useApi } from "@/api/useApi";
import { parseVehicleId } from "@/lib/transit";

type Props = { city: string; vehicleId: string; brigade: string };

type Row = [field: string, value: string, Icon: ComponentType<SvgIconProps>];

// "Pojazd" tab: fleet data (phototrans / ilostan) laid out as the original's technical data list.
export const VehicleInfoTab = ({ city, vehicleId }: Props) => {
    const { t } = useTranslation();
    const { number } = parseVehicleId(vehicleId);
    const { data, error, loading } = useApi((signal) => cityGet<VehicleTuple>(city, `/vehicles/vehicle/${encodeURIComponent(vehicleId)}`, undefined, signal), [city, vehicleId]);

    if (loading && !data) {
        return (
            <div>
                {["a", "b", "c"].map((key) => (
                    <Skeleton key={key} animation="wave" variant="text" height={50} width="100%" style={{ marginBottom: 5 }} />
                ))}
            </div>
        );
    }
    if (error || !data) {
        return (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <h4>{t("vehicleDetails.noVehicleData")}</h4>
            </Box>
        );
    }

    const [brand, ...model] = (data[EVehicle.model] ?? "").split(" ");
    const rows: Row[] = [
        ["brand", brand, CommuteIcon],
        ["brandModel", model.join(" "), CommuteIcon],
        ["productionYear", data[EVehicle.year] ? String(data[EVehicle.year]) : "", CalendarMonthIcon],
        ["operator", data[EVehicle.agency] ?? "", BusinessIcon],
    ];
    const technical = rows.filter(([, value]) => value !== "");

    return (
        <Box>
            <Fragment>
                <Typography variant="subtitle1" gutterBottom>
                    {t("global.vehicleNoShort")} #{number}
                </Typography>
                {technical.length > 0 && (
                    <>
                        <Typography variant="subtitle1" gutterBottom>
                            {t("vehicleInformation.technicalData")}
                        </Typography>
                        <List sx={{ mb: 2 }}>
                            {technical.map(([field, value, Icon]) => (
                                <ListItem key={field} dense>
                                    <ListItemIcon>
                                        <Icon />
                                    </ListItemIcon>
                                    <ListItemText primary={t(`vehicleInformation.${field}`)} secondary={value} />
                                </ListItem>
                            ))}
                        </List>
                    </>
                )}
            </Fragment>
            <Alert severity="info" sx={{ mt: 2 }}>
                {t("vehicleInformation.equipmentDisclaimer")}
            </Alert>
        </Box>
    );
};
