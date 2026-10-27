import Grid from "@mui/material/Grid2";
import { IconButton, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { withCity, type RouteConfig } from "@/lib/navigation";

export const MenuGrid = ({ items, city }: { items: RouteConfig[]; city: string }) => {
    const { t } = useTranslation();
    return (
        <Grid container spacing={1} style={{ padding: 10 }} sx={{ alignItems: "stretch", justifyContent: "flex-start" }}>
            {items.map((item) => (
                <Grid
                    key={item.pattern}
                    component={Link}
                    to={withCity(item.pattern, city)}
                    size={{ xs: 4, sm: 3, md: 2, lg: 1, xl: 1 }}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        textAlign: "center",
                        textDecoration: "none",
                        cursor: "pointer",
                        color: "var(--default-text)",
                    }}
                >
                    <IconButton component="div">{item.settingsIcon}</IconButton>
                    <Typography variant="caption">{t(item.menuTitleKey ?? "")}</Typography>
                </Grid>
            ))}
        </Grid>
    );
};
