import ClearIcon from "@mui/icons-material/Clear";
import { IconButton, InputAdornment, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

export const ClearButton = ({ visible, onClear }: { visible: boolean; onClear: () => void }) =>
    visible ? (
        <InputAdornment position="end">
            <IconButton aria-label="clear" size="small" onClick={onClear}>
                <ClearIcon fontSize="small" />
            </IconButton>
        </InputAdornment>
    ) : null;

// "Szukaj linii:" header + "Linie" search input of the original line filter.
export const LineSearchField = ({ value, onChange, headerLabel, placeholder = "map.filterEnterLine" }: { value: string; onChange: (value: string) => void; headerLabel: string; placeholder?: string }) => {
    const { t } = useTranslation();
    return (
        <>
            <Typography variant="subtitle2" noWrap sx={{ mt: 1, mb: 2 }}>
                {headerLabel}
            </Typography>
            <TextField
                label={t("global.route_ids")}
                placeholder={t(placeholder)}
                margin="dense"
                value={value}
                type="search"
                variant="outlined"
                onChange={(event) => onChange(event.target.value)}
                size="small"
                fullWidth
                autoComplete="off"
                slotProps={{ input: { endAdornment: <ClearButton visible={value !== ""} onClear={() => onChange("")} /> }, inputLabel: { shrink: true } }}
            />
        </>
    );
};
