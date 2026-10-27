import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";
import HistoryIcon from "@mui/icons-material/History";
import UpdateIcon from "@mui/icons-material/Update";
import { useTranslation } from "react-i18next";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
    Badge,
    Box,
    ButtonBase,
    Chip,
    Divider,
    IconButton,
    ListItemButton,
    ListItemIcon,
    ListItemSecondaryAction,
    ListItemText,
    Popover,
    Typography,
    type SxProps,
    type Theme,
    type TypographyProps,
} from "@mui/material";
import { forwardRef, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref } from "react";
import { Link } from "react-router-dom";
import { LiveBadgeIcon, RouteChip } from "./RouteChip";
import { typeIcons, vehicleTypeName } from "./VehicleTypeIcon";

export const ANGLE = 7.5;
export const CLIP_FIRST = `polygon(0 0, 100% 0, calc(100% - ${ANGLE}px) 100%, 0 100%)`;
export const CLIP_MIDDLE = `polygon(${ANGLE}px 0, 100% 0, calc(100% - ${ANGLE}px) 100%, 0 100%)`;
export const CLIP_LAST = `polygon(${ANGLE}px 0, 100% 0, 100% 100%, 0 100%)`;

const sxList = (sx?: SxProps<Theme>) => (Array.isArray(sx) ? sx : sx ? [sx] : []);

// ShowMoreButton: small icon button with a faded drop arrow.
export const ShowMoreButton = forwardRef<HTMLButtonElement, { expanded: boolean; onClick: () => void }>(({ expanded, onClick }, ref) => (
    <IconButton
        ref={ref}
        size="small"
        onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClick();
        }}
    >
        {expanded ? <ArrowDropUpIcon sx={{ opacity: 0.3 }} /> : <ArrowDropDownIcon sx={{ opacity: 0.3 }} />}
    </IconButton>
));
ShowMoreButton.displayName = "ShowMoreButton";

// VehicleTypeChip: rounded block(s) in the type colour with white glyphs, joined by angled cuts.
export const VehicleTypeChip = ({ types, size = 32, sx }: { types: number[]; size?: number; sx?: SxProps<Theme> }) => {
    if (types.length === 0) return null;
    const glyph = Math.round(size * 0.625);
    return (
        <Box sx={[{ display: "inline-flex", alignItems: "center", height: size, borderRadius: "6px", overflow: "hidden", flexShrink: 0 }, ...sxList(sx)]}>
            {types.map((type, index) => {
                const notFirst = index > 0;
                const notLast = index < types.length - 1;
                return (
                    <Box
                        key={type}
                        sx={{
                            height: "100%",
                            minWidth: size + (notFirst ? ANGLE : 0) + (notLast ? ANGLE : 0),
                            pl: notFirst ? `${ANGLE}px` : 0,
                            pr: notLast ? `${ANGLE}px` : 0,
                            ml: notFirst ? `-${ANGLE}px` : 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: `var(--${vehicleTypeName(type)})`,
                            color: "var(--white)",
                            clipPath: notFirst ? (notLast ? CLIP_MIDDLE : CLIP_LAST) : notLast ? CLIP_FIRST : undefined,
                            "& svg": { width: `${glyph}px !important`, height: `${glyph}px !important` },
                        }}
                    >
                        {typeIcons(type).whiteIcon}
                    </Box>
                );
            })}
        </Box>
    );
};

const applyMarquee = (container: HTMLElement, text: HTMLElement) => {
    const overflow = container.scrollWidth - container.offsetWidth;
    if (overflow > 0) {
        text.style.setProperty("--overflow", `${-overflow}px`);
        text.classList.add("marquee-animation");
    } else if (text.classList.contains("marquee-animation")) {
        text.classList.remove("marquee-animation");
        text.style.removeProperty("--overflow");
    }
};

// MarqueeText: single line that slides back and forth when it does not fit.
export const MarqueeText = forwardRef<HTMLElement, { text: ReactNode; sectionWidth?: number; variant?: TypographyProps["variant"]; fontWeight?: number | string; sx?: SxProps<Theme> }>(
    ({ text, sectionWidth, variant = "body2", fontWeight, sx }, forwarded) => {
        const own = useRef<HTMLElement | null>(null);
        const textRef = useRef<HTMLSpanElement | null>(null);
        const [width, setWidth] = useState(0);
        const setRef = (node: HTMLElement | null) => {
            own.current = node;
            if (typeof forwarded === "function") forwarded(node);
            else if (forwarded) (forwarded as { current: HTMLElement | null }).current = node;
        };
        useEffect(() => {
            const node = own.current;
            if (!node) return;
            const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
            observer.observe(node);
            return () => observer.disconnect();
        }, []);
        useEffect(() => {
            if (sectionWidth === 0) return;
            if (own.current && textRef.current) applyMarquee(own.current, textRef.current);
        }, [width, sectionWidth, text]);
        return (
            <Typography
                ref={setRef as Ref<HTMLSpanElement>}
                variant={variant}
                className="marquee-container"
                sx={sx}
                style={{ display: "flex", maxWidth: sectionWidth ? `${sectionWidth}px` : "100%", lineHeight: "normal", whiteSpace: "nowrap", overflow: "hidden", width: "100%", fontWeight }}
            >
                <span ref={textRef} className="marquee-text">
                    {text}
                </span>
            </Typography>
        );
    },
);
MarqueeText.displayName = "MarqueeText";

// BaseBadge: 28px high outlined pill.
export const BaseBadge = ({ children, height = 28, onClick, sx }: { children: ReactNode; height?: number; onClick?: () => void; sx?: SxProps<Theme> }) => (
    <Box
        component={onClick ? ButtonBase : "div"}
        onClick={onClick}
        sx={[
            (theme) => ({
                display: "flex",
                alignItems: "center",
                height,
                borderRadius: "6px",
                border: "1px solid",
                borderColor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.23)" : "rgba(0, 0, 0, 0.23)",
                overflow: "hidden",
            }),
            ...(onClick
                ? [
                      (theme: Theme) => ({
                          cursor: "pointer",
                          textAlign: "inherit",
                          color: "inherit",
                          font: "inherit",
                          transition: "filter 150ms ease",
                          "&:hover": { filter: "brightness(0.94)" },
                          "&:active": { filter: "brightness(0.88)" },
                          "&.Mui-focusVisible": { boxShadow: `0 0 0 2px ${theme.palette.primary.main}` },
                      }),
                  ]
                : []),
            ...sxList(sx),
        ]}
    >
        {children}
    </Box>
);

const LiveWrap = ({ isLive, isOffline, children }: { isLive?: boolean; isOffline?: boolean; children: ReactNode }) => {
    if (!isLive && !isOffline) return <>{children}</>;
    return (
        <Badge anchorOrigin={{ vertical: "top", horizontal: "right" }} badgeContent={<LiveBadgeIcon live={!!isLive} />} sx={{ maxWidth: "100%", "& .MuiBadge-badge": { zIndex: 10 } }}>
            {children}
        </Badge>
    );
};

// NameBadge (E$): leading block + uppercase name in an outlined pill.
export const NameBadge = ({
    leading,
    text,
    isLive,
    isOffline,
    onClick,
    fontWeight = 500,
    sx,
    textSx,
    angledDivider,
}: {
    leading?: ReactNode;
    text: ReactNode;
    isLive?: boolean;
    isOffline?: boolean;
    onClick?: () => void;
    fontWeight?: number | string;
    sx?: SxProps<Theme>;
    textSx?: SxProps<Theme>;
    angledDivider?: boolean;
}) => {
    const ref = useRef<HTMLElement | null>(null);
    return (
        <LiveWrap isLive={isLive} isOffline={isOffline}>
            <BaseBadge height={28} onClick={onClick} sx={[{ maxWidth: "100%", bgcolor: "transparent" }, ...sxList(sx)]}>
                {leading}
                <Box sx={[{ display: "flex", alignItems: "center" }, { height: "100%", pr: 1, flex: 1, minWidth: 0 }, angledDivider ? { pl: 0.5 } : { pl: 1 }]}>
                    <MarqueeText ref={ref} text={text} variant="body2" fontWeight={fontWeight} sx={textSx} />
                </Box>
            </BaseBadge>
        </LiveWrap>
    );
};

// Stop name with the stop's vehicle types in coloured blocks (Ope).
export const StopNameBadge = ({ text, stopTypes, angledDivider, onClick, sx }: { text: ReactNode; stopTypes: number[]; angledDivider?: boolean; onClick?: () => void; sx?: SxProps<Theme> }) => (
    <NameBadge
        text={text}
        onClick={onClick}
        sx={sx}
        fontWeight="normal"
        textSx={{ textTransform: "uppercase" }}
        angledDivider={angledDivider}
        leading={
            <Box sx={{ display: "flex", alignItems: "center", height: "100%", flexShrink: 0 }}>
                {stopTypes.map((type, index) => (
                    <Box
                        key={type}
                        sx={{
                            bgcolor: `var(--${vehicleTypeName(type)})`,
                            height: "100%",
                            minWidth: angledDivider ? `calc(30px + ${index === 0 ? ANGLE : ANGLE * 2}px)` : "30px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--white)",
                            "& svg": { width: "20px !important", height: "20px !important" },
                            ...(angledDivider && {
                                pr: `${ANGLE}px`,
                                clipPath: index === 0 ? CLIP_FIRST : CLIP_MIDDLE,
                                ...(index > 0 && { pl: `${ANGLE}px`, ml: `-${ANGLE}px` }),
                            }),
                        }}
                    >
                        {typeIcons(type).whiteIcon}
                    </Box>
                ))}
            </Box>
        }
    />
);

// Line chip glued to a headsign pill (Lpe).
export const RouteNameBadge = ({
    text,
    routeName,
    type,
    isLive,
    isOffline,
    onClick,
    sx,
    fontWeight,
    angledDivider,
}: {
    text: ReactNode;
    routeName: string;
    type: number | null;
    isLive?: boolean;
    isOffline?: boolean;
    onClick?: () => void;
    sx?: SxProps<Theme>;
    fontWeight?: number | string;
    angledDivider?: boolean;
}) =>
    text ? (
        <NameBadge
            text={text}
            isLive={isLive}
            isOffline={isOffline}
            onClick={onClick}
            sx={sx}
            fontWeight={fontWeight}
            textSx={{ textTransform: "uppercase" }}
            angledDivider={angledDivider}
            leading={
                <Box sx={{ display: "flex", alignItems: "center", zIndex: 2, position: "relative", height: "100%" }}>
                    <RouteChip
                        name={routeName}
                        type={type}
                        isLive={isLive}
                        animate={!!isLive}
                        sx={[{ height: "28px", borderTopRightRadius: 0, borderBottomRightRadius: 0 }, !!angledDivider && { clipPath: CLIP_FIRST, "& .MuiChip-label": { paddingRight: 1.5 } }]}
                    />
                </Box>
            }
        />
    ) : (
        <RouteChip name={routeName} type={type} isLive={isLive} animate={!!isLive} onClick={onClick} sx={[{ height: "28px" }, ...sxList(sx)]} />
    );

// ListRow (DP): list item button with an optional leading icon, a chevron and a faded divider.
export const ListRow = ({
    leading,
    primary,
    secondary,
    children,
    to,
    onClick,
    action,
    trailing,
    column = false,
    divider = true,
    sx,
}: {
    leading?: ReactNode;
    primary?: ReactNode;
    secondary?: ReactNode;
    children?: ReactNode;
    to?: string;
    onClick?: () => void;
    action?: "navigate";
    trailing?: ReactNode;
    column?: boolean;
    divider?: boolean;
    sx?: object;
}) => {
    const trail = trailing !== undefined ? trailing : action === "navigate" ? <ChevronRightIcon color="action" /> : null;
    const hasTrail = trail !== null && trail !== undefined;
    const rowSx = { ...(column ? { py: 1.5, display: "flex", flexDirection: "column", alignItems: "flex-start" } : {}), ...(sx ?? {}) };
    const content = (
        <>
            {leading ? <ListItemIcon>{leading}</ListItemIcon> : null}
            {children !== undefined ? (
                column ? (
                    <Box sx={[{ display: "flex", width: "100%" }, hasTrail ? { pr: 4 } : { pr: 0 }]}>{children}</Box>
                ) : (
                    children
                )
            ) : (
                <ListItemText sx={[hasTrail ? { pr: 2 } : { pr: 0 }]} primary={primary} secondary={secondary || undefined} />
            )}
            {hasTrail ? <ListItemSecondaryAction>{trail}</ListItemSecondaryAction> : null}
        </>
    );
    return (
        <>
            {to ? (
                <ListItemButton component={Link} to={to} onClick={onClick} alignItems="center" sx={rowSx}>
                    {content}
                </ListItemButton>
            ) : (
                <ListItemButton onClick={onClick} alignItems="center" sx={rowSx}>
                    {content}
                </ListItemButton>
            )}
            {divider ? <Divider sx={{ opacity: "0.6" }} /> : null}
        </>
    );
};

// Popup on click (s2e): inline element that opens a popover with more info.
export const PopupInfo = ({ element, popupContent, style }: { element: ReactNode; popupContent: ReactNode; style?: CSSProperties }) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const id = useId();
    const open = !!anchor;
    return (
        <>
            <span
                style={style}
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? id : undefined}
                onClick={(event: MouseEvent<HTMLSpanElement>) => {
                    event.stopPropagation();
                    setAnchor(event.currentTarget);
                }}
                onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setAnchor(event.currentTarget);
                }}
            >
                {element}
            </span>
            <Popover id={open ? id : undefined} open={open} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} onClick={(event) => event.stopPropagation()}>
                <Typography sx={{ p: 1 }} component="div">
                    {popupContent}
                </Typography>
            </Popover>
        </>
    );
};

// MinRemaining: "<1 min", "5 min", "1 h 5 min", "3 min temu" with bold h6 numbers.
export const MinRemaining = ({ minRemaining, agoLabel = "", className }: { minRemaining: number; agoLabel?: string; className?: string }) => {
    const big = (value: ReactNode) => (
        <Typography component="span" variant="h6" sx={{ fontWeight: "bold" }}>
            {value}
        </Typography>
    );
    const hours = Math.floor(Math.abs(minRemaining) / 60);
    const minutes = Math.abs(minRemaining) % 60;
    let content: ReactNode;
    if (minRemaining >= 60) {
        content = (
            <>
                {big(hours)} h
                {minutes > 0 && (
                    <span>
                        <Typography component="span" variant="h6" sx={{ fontWeight: "bold" }}>
                            {" "}
                            {minutes}
                        </Typography>{" "}
                        min
                    </span>
                )}
            </>
        );
    } else if (minRemaining >= 0) {
        content = (
            <>
                {big(minRemaining === 0 ? "<1" : minRemaining)} min
            </>
        );
    } else {
        content = (
            <>
                {big(Math.abs(minRemaining))} min {agoLabel}
            </>
        );
    }
    return (
        <Typography className={className} variant="body2" align="center" component="div">
            <span>{content}</span>
        </Typography>
    );
};

export const BlinkArrows = ({ style }: { style?: CSSProperties }) => (
    <span className="departing-animation" style={style}>
        <span className="departing-arrow">›</span>
        <span className="departing-arrow">›</span>
        <span className="departing-arrow">›</span>
    </span>
);

export const DELAY_CLASSES = [
    { from: -Infinity, to: -2, className: "before-time" },
    { from: -1, to: 1, className: "on-time" },
    { from: 2, to: 9, className: "delayed-slight" },
    { from: 10, to: 14, className: "delayed-minor" },
    { from: 15, to: 19, className: "delayed-moderate" },
    { from: 20, to: 24, className: "delayed-major" },
    { from: 25, to: Infinity, className: "delayed-critical" },
];

export const delayClassOf = (minutes: number | undefined) => {
    if (minutes === undefined) return "delayed-no-data";
    return DELAY_CLASSES.find((entry) => minutes >= entry.from && minutes <= entry.to)?.className ?? "delayed-no-data";
};

// Departure time chips (R1): strikethrough planned time + coloured live time.
export const TimeChips = ({
    depTime,
    delayedDepTime,
    delayInMin,
    minRemaining,
    agoLabel,
    layout = "horizontal",
}: {
    depTime: string;
    delayedDepTime?: string;
    delayInMin?: number;
    minRemaining?: number;
    agoLabel: string;
    layout?: "horizontal" | "vertical";
}) => {
    const live = delayInMin !== undefined;
    // Delayed only outside the on-time bucket, so sub-minute drift stays
    // "on time": a single green chip with the scheduled time, no strike-through.
    const delayed = live && delayClassOf(delayInMin) !== "on-time";
    const bg = live ? `bg-${delayClassOf(delayInMin)}` : "";
    if (layout === "horizontal") {
        return (
            <>
                {minRemaining !== undefined && <MinRemaining minRemaining={minRemaining} agoLabel={agoLabel} />}
                {delayed && delayedDepTime ? (
                    <>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            <s>{depTime}</s>
                        </Typography>
                        <Chip size="small" label={delayedDepTime} clickable={false} sx={{ height: 20, padding: 0, color: "var(--white)", borderRadius: "8px" }} className={bg} />
                    </>
                ) : (
                    <Chip
                        size="small"
                        label={depTime}
                        clickable={false}
                        variant={live ? "filled" : "outlined"}
                        sx={{ height: 20, padding: 0, borderRadius: "8px" }}
                        className={live ? `${bg} text-white` : ""}
                    />
                )}
            </>
        );
    }
    if (minRemaining === undefined) return null;
    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between" }}>
            {minRemaining < 0 ? <BlinkArrows /> : <MinRemaining minRemaining={minRemaining} agoLabel={agoLabel} />}
            <Box sx={{ display: "flex", gap: 0.5 }}>
                <Chip
                    size="small"
                    label={delayed ? <s>{depTime}</s> : <span className={live ? "text-white" : ""}>{depTime}</span>}
                    clickable={false}
                    variant="outlined"
                    className={delayed ? "" : live ? `${bg} text-white` : ""}
                    sx={{ opacity: minRemaining < 0 ? 0.5 : 1, borderRadius: "8px" }}
                />
                {delayed && delayedDepTime && (
                    <Chip
                        size="small"
                        label={<span className="text-white">{delayedDepTime}</span>}
                        clickable={false}
                        className={`${bg} text-white`}
                        sx={{ opacity: minRemaining < 0 ? 0.5 : 1, borderRadius: "8px" }}
                    />
                )}
            </Box>
        </Box>
    );
};

const escapeRegex = (value: string) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

// Bold every fragment matching the query (letters may be separated by spaces, dashes or dots).
export const Highlight = ({ text, query }: { text: string; query?: string }) => {
    if (!query || !text) return <>{text}</>;
    const pattern = new RegExp(query.split("").map(escapeRegex).join("[-\\s.]*"), "ig");
    const parts: { value: string; match: boolean; start: number }[] = [];
    let last = 0;
    let found = pattern.exec(text);
    while (found !== null) {
        if (found.index > last) parts.push({ value: text.slice(last, found.index), match: false, start: last });
        parts.push({ value: found[0], match: true, start: found.index });
        last = found.index + found[0].length;
        if (found.index === pattern.lastIndex) pattern.lastIndex++;
        found = pattern.exec(text);
    }
    if (last < text.length) parts.push({ value: text.slice(last), match: false, start: last });
    return <>{parts.map((part) => (part.match ? <b key={`m-${part.start}`}>{part.value}</b> : <span key={`t-${part.start}`}>{part.value}</span>))}</>;
};

// Delay chip of the original (x$): "5 min opóźnienia" / "2 min przed czasem" / "zgodnie z rozkładem".
export const DelayChip = ({ delayInSeconds, delayMinutes, style }: { delayInSeconds?: number; delayMinutes?: number; style?: CSSProperties }) => {
    const { t } = useTranslation();
    if (delayInSeconds === undefined && delayMinutes === undefined) return null;
    const seconds = delayInSeconds ?? 0;
    const minutes = delayMinutes !== undefined ? delayMinutes : seconds > 0 ? Math.floor(seconds / 60) : Math.floor(Math.abs(seconds / 60)) * -1;
    const className = `bg-${delayClassOf(minutes)} text-white`;
    const label =
        minutes > 0 ? `${minutes} min ${t("global.delayed").toLowerCase()}` : minutes < 0 ? `${Math.abs(minutes)} min ${t("global.beforeTime").toLowerCase()}` : t("global.onTime").toLowerCase();
    const Icon = minutes > 0 ? HistoryIcon : minutes < 0 ? UpdateIcon : CheckIcon;
    return (
        <Chip
            size="small"
            component="span"
            icon={<Icon className="text-white" fontSize="inherit" />}
            sx={{ height: "20px", marginTop: "3px", borderRadius: "8px" }}
            label={
                <Typography variant="body2" component="span">
                    {label}
                </Typography>
            }
            clickable={false}
            style={style}
            className={className}
        />
    );
};
