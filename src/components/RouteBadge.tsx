import { Box } from "@mui/material";
import { ERouteTuple, type RouteTuple } from "@/api/types";
import { contrastText, routeColor } from "@/lib/transit";

type Props = { route: RouteTuple; size?: "small" | "medium" | "large"; onClick?: () => void };

// Line number chip in the route's color.
export const RouteBadge = ({ route, size = "medium", onClick }: Props) => {
    const color = routeColor(route);
    const fontSize = size === "small" ? 12 : size === "large" ? 18 : 14;
    return (
        <Box
            component="span"
            onClick={onClick}
            className="line-number"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: fontSize * 2.4,
                px: 0.75,
                py: 0.25,
                borderRadius: "6px",
                fontWeight: 700,
                fontSize,
                lineHeight: 1.3,
                background: color,
                color: color.startsWith("#") ? contrastText(color) : "#fff",
                cursor: onClick ? "pointer" : undefined,
                whiteSpace: "nowrap",
            }}
        >
            {route[ERouteTuple.routeName]}
        </Box>
    );
};
