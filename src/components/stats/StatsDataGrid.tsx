import { DataGrid, GridToolbar, type DataGridProps, type GridColDef, type GridValidRowModel } from "@mui/x-data-grid";
import { plPL } from "@mui/x-data-grid/locales";

export const IS_MOBILE_AGENT = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);

export const naturalCompare = (a: unknown, b: unknown) =>
    a
        ? b
            ? String(a).localeCompare(String(b), undefined, {
                  numeric: true,
                  sensitivity: "base",
              })
            : 1
        : -1;

const collator = new Intl.Collator("pl", { numeric: true, sensitivity: "base" });

export const compareValues = (a: unknown, b: unknown) => {
    if (a === b) return 0;
    if (a === null || a === undefined || a === "") return 1;
    if (b === null || b === undefined || b === "") return -1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return collator.compare(String(a), String(b));
};

// Bold header like the original's renderHeader.
export const boldHeader = <R extends GridValidRowModel>(column: GridColDef<R>): GridColDef<R> => ({
    ...column,
    renderHeader: () => <span style={{ fontWeight: 500 }}>{column.headerName}</span>,
});

const LOCALE = plPL.components.MuiDataGrid.defaultProps.localeText;

// MUI X DataGrid with the Polish locale and the original's toolbar slot (hidden unless showToolbar).
export const StatsDataGrid = <R extends GridValidRowModel>(props: DataGridProps<R>) => (
    <DataGrid<R>
        localeText={LOCALE}
        slots={{ toolbar: GridToolbar }}
        slotProps={{
            toolbar: {
                showQuickFilter: true,
                printOptions: { disableToolbarButton: true },
                quickFilterProps: { debounceMs: 300 },
            },
        }}
        {...props}
    />
);
