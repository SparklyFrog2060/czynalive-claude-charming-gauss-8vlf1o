import { Box, Button, Typography } from "@mui/material";
import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ERouteTuple } from "@/api/types";
import { mapVehicleUrl, type LiveVehicle } from "./api";
import { DelayChip, SectionHeader, typeName } from "./common";
import { boldHeader, IS_MOBILE_AGENT, naturalCompare, StatsDataGrid } from "./StatsDataGrid";

type Props = {
    city: string;
    title: string;
    subtitle: string;
    vehicles: LiveVehicle[];
    types: number[];
    selectedType: number | "total";
    withDelay?: boolean;
    showEmpty?: boolean;
};

type Row = {
    id: string;
    type: number;
    route_id: string;
    brigade: string;
    vehicleNo: string;
    trip_headsign: string;
    delay: number | null;
    stop_name: string;
};

const EMPTY_SELECTION: GridRowSelectionModel = {
    type: "include",
    ids: new Set(),
};

export const VehicleGrid = ({ city, title, subtitle, vehicles, types, selectedType, withDelay, showEmpty }: Props) => {
    const { t } = useTranslation();
    const [selection, setSelection] = useState<GridRowSelectionModel>(EMPTY_SELECTION);
    const [hidden, setHidden] = useState<Set<string>>(new Set());
    const rows = useMemo<Row[]>(
        () =>
            vehicles
                .filter((vehicle) => !hidden.has(vehicle.id))
                .map((vehicle) => ({
                    id: vehicle.id,
                    type: vehicle.type,
                    route_id: vehicle.route[ERouteTuple.routeName],
                    brigade: vehicle.brigade,
                    vehicleNo: vehicle.vehicleNo,
                    trip_headsign: vehicle.headsign,
                    delay: vehicle.delay,
                    stop_name: vehicle.stop,
                })),
        [vehicles, hidden],
    );

    const columns = useMemo<GridColDef<Row>[]>(() => {
        const base: GridColDef<Row>[] = [
            {
                field: "type",
                headerName: t("delays.vehicleType"),
                hideable: false,
                flex: 1,
                minWidth: 80,
                maxWidth: 150,
                valueGetter: (_, row) => typeName(row.type),
                renderCell: (params) => <span title={String(params.row.type)}>{typeName(params.row.type)}</span>,
            },
            {
                field: "route_id",
                headerName: t("global.route_id"),
                hideable: false,
                flex: 1,
                minWidth: 60,
                maxWidth: 100,
                sortComparator: naturalCompare,
            },
            {
                field: "brigade",
                headerName: t("global.brigade"),
                hideable: false,
                flex: 1,
                minWidth: 80,
                maxWidth: 120,
                sortComparator: naturalCompare,
            },
            {
                field: "vehicleNo",
                headerName: t("global.vehicleNoShort"),
                hideable: false,
                flex: 1,
                minWidth: 60,
                maxWidth: 120,
                sortComparator: naturalCompare,
                renderCell: (params) => <Link to={mapVehicleUrl(city, params.row.id)}>{params.row.vehicleNo}</Link>,
            },
            {
                field: "trip_headsign",
                headerName: t("global.tripHeadsign"),
                hideable: false,
                flex: 2,
                minWidth: 130,
                renderCell: (params) => <span title={params.row.trip_headsign}>{params.row.trip_headsign}</span>,
            },
        ];
        if (withDelay) {
            base.push(
                {
                    field: "delay",
                    headerName: t("delays.delay"),
                    hideable: false,
                    flex: 1,
                    type: "number",
                    minWidth: 150,
                    maxWidth: 200,
                    valueFormatter: (value: number | null) => Math.round((value ?? 0) / 60),
                    renderCell: (params) => <DelayChip minutes={Math.round((params.row.delay ?? 0) / 60)} />,
                },
                {
                    field: "stop_name",
                    headerName: t("global.stop"),
                    hideable: false,
                    flex: 2,
                    minWidth: 150,
                },
            );
        }
        return base.map(boldHeader);
    }, [t, city, withDelay]);

    const selectedCount = selection.ids.size;

    return (
        <Box sx={{ my: 2 }}>
            <SectionHeader types={types} selectedType={selectedType} title={title} subtitle={subtitle} />
            {(hidden.size > 0 || selectedCount > 0) && (
                <Box sx={{ display: "flex", gap: 2, my: 1 }}>
                    {selectedCount > 0 && (
                        <Button
                            variant="contained"
                            size="small"
                            onClick={() => {
                                setHidden((prev) => new Set([...prev, ...[...selection.ids].map(String)]));
                                setSelection(EMPTY_SELECTION);
                            }}
                        >
                            {t("global.hideSelected", { count: selectedCount })}
                        </Button>
                    )}
                    {hidden.size > 0 && (
                        <Button variant="contained" size="small" onClick={() => setHidden(new Set())}>
                            {t("global.showHidden", { count: hidden.size })}
                        </Button>
                    )}
                </Box>
            )}
            {showEmpty && rows.length === 0 ? (
                <Typography variant="caption" sx={{ textAlign: "center" }}>
                    {t("global.noData")}
                </Typography>
            ) : (
                <div style={{ height: 600 }}>
                    {IS_MOBILE_AGENT && (
                        <Typography variant="body2" sx={{ textAlign: "center" }}>
                            {t("delays.tableIsMovable")}
                        </Typography>
                    )}
                    <StatsDataGrid<Row>
                        checkboxSelection={!IS_MOBILE_AGENT}
                        rowSelectionModel={selection}
                        onRowSelectionModelChange={setSelection}
                        disableRowSelectionOnClick
                        initialState={{
                            sorting: {
                                sortModel: [
                                    {
                                        field: withDelay ? "delay" : "route_id",
                                        sort: withDelay ? "desc" : "asc",
                                    },
                                ],
                            },
                        }}
                        rows={rows}
                        columns={columns}
                        density="compact"
                        disableColumnSelector
                        disableDensitySelector
                    />
                </div>
            )}
        </Box>
    );
};
