import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import { Badge, Chip, Typography, type SxProps, type Theme } from "@mui/material";
import { keyframes } from "@mui/system";
import { useTranslation } from "react-i18next";
import { typeIcons, vehicleTypeName } from "./VehicleTypeIcon";

type Props = {
    name: string;
    type: number | null;
    brigade?: string;
    showLiveBadge?: boolean;
    isLive?: boolean;
    animate?: boolean;
    onClick?: () => void;
    size?: "small" | "medium";
    sx?: SxProps<Theme>;
};

const shine = keyframes`
  0% { transform: translateX(-100%); opacity: 0; }
  10% { opacity: 0.5; }
  30% { transform: translateX(100%); opacity: 0; }
  100% { transform: translateX(100%); opacity: 0; }
`;

export const LIVE_COLOR = "hsl(124, 81%, 39%)";

export const LiveBadgeIcon = ({ live }: { live: boolean }) =>
    live ? (
        <WifiIcon className="opacity-animate" sx={{ color: LIVE_COLOR, width: 15, height: 15, rotate: "45deg", marginLeft: "-7px", marginTop: "-10px" }} />
    ) : (
        <WifiOffIcon sx={{ color: "var(--text-default)", width: 15, height: 15 }} />
    );

// The original's RouteId chip (line number in the vehicle-type colour, optional "/brigade" and live badge).
export const RouteChip = ({ name, type, brigade, showLiveBadge = false, isLive = false, animate = true, onClick, size = "small", sx }: Props) => {
    const { t } = useTranslation();
    const textClass = type === null ? "text-default" : "text-white";
    const label = (
        <span className={textClass} style={{ fontSize: "0.9375rem" }}>
            {name}
            {brigade ? (
                <Typography component="span" variant="caption" className={textClass}>
                    /{brigade}
                </Typography>
            ) : null}
        </span>
    );
    const chipSx = [
        {
            borderRadius: "6px",
            overflow: "hidden",
            position: "relative",
            flexShrink: 0,
            "& .MuiChip-label": { padding: brigade ? "0 4px" : "0 8px" },
            ...(animate && {
                "&::after": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(120deg, transparent 30%, rgba(255, 255, 255, 0.5) 50%, transparent 70%)",
                    transform: "translateX(-100%)",
                    animation: `${shine} 6s infinite ease-in-out`,
                },
            }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
    ] as SxProps<Theme>;
    const aria = brigade ? `${t("global.route_id")} ${name}, ${t("global.brigade")} ${brigade}` : `${t("global.route_id")} ${name}`;
    if (type === null) return <Chip size={size} sx={chipSx} label={label} onClick={onClick} aria-label={aria} />;
    const chip = (
        <Chip size={size} sx={chipSx} className={`bg-${vehicleTypeName(type)} text-white`} label={label} icon={typeIcons(type).chipIcon} onClick={onClick} aria-label={aria} />
    );
    // Live badge only when the trip is actually live; never show an "offline" icon.
    if (!showLiveBadge || !isLive) return chip;
    return (
        <Badge anchorOrigin={{ vertical: "top", horizontal: "right" }} badgeContent={<LiveBadgeIcon live={true} />}>
            {chip}
        </Badge>
    );
};
