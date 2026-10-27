import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Cell, Label, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { vehicleTypeName } from "@/components/departures/VehicleTypeIcon";
import type { RouteDelay } from "./api";

const typeColor = (type: number) =>
    (typeof document !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue(`--${vehicleTypeName(type)}`).trim()) || "hsl(124, 81%, 29%)";

const ChartTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    const { t } = useTranslation();
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as RouteDelay;
    return (
        <div className="bg-default-bg text-default-text" style={{ padding: 8 }}>
            <div>
                {t("global.route_id")}: {row.routeName}
            </div>
            <div>
                {t("delays.averageDelay")}: {row.avgDelay} min
            </div>
            <div>
                {t("global.count")}: {t("plural.vehicle", { count: row.count })}
            </div>
        </div>
    );
};

export const TopLinesChart = ({ data }: { data: RouteDelay[] }) => {
    const theme = useTheme();
    const desktop = useMediaQuery(theme.breakpoints.up("md"));
    const { t } = useTranslation();
    return (
        <Box>
            <Typography variant="h6">{t("delays.top10LinesChartHeader")}:</Typography>
            <ResponsiveContainer width="100%" height={desktop ? 600 : 300}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <Bar dataKey="avgDelay">
                        {data.map((row) => (
                            <Cell key={`${row.city}/${row.routeId}`} fill={typeColor(row.type)} />
                        ))}
                    </Bar>
                    <XAxis dataKey="routeName" height={80}>
                        <Label style={{ textAnchor: "middle" }} offset={10} value={t("global.route_id")} />
                    </XAxis>
                    <YAxis
                        type="number"
                        allowDecimals={false}
                        domain={([min, max]: readonly number[]) => {
                            const top = Math.max(Math.abs(min), Math.abs(max));
                            return [min < 0 ? min : 0, top + Math.round(top * 0.3)];
                        }}
                    >
                        <Label style={{ textAnchor: "middle" }} dx={-10} offset={10} angle={270} value={`${t("delays.averageDelay")} (min)`} />
                    </YAxis>
                    <Tooltip cursor={{ fill: "var(--default-text)", fillOpacity: 0.4 }} content={<ChartTooltip />} />
                </BarChart>
            </ResponsiveContainer>
        </Box>
    );
};
