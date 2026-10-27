import DragHandleIcon from "@mui/icons-material/DragHandle";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import HistoryIcon from "@mui/icons-material/History";
import UpdateIcon from "@mui/icons-material/Update";
import CheckIcon from "@mui/icons-material/Check";
import { Box, Chip, Fab, IconButton, Typography, type SvgIconProps } from "@mui/material";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ComponentType,
    type CSSProperties,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { BlinkArrows, delayClassOf } from "@/components/departures/parts";

// czynaczas drawer detents: fractions of the window height, 0 = closed.
const SNAPS = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];

type SheetContextValue = { snapTo: (fraction: number) => void; offset: number };
const SheetContext = createContext<SheetContextValue>({ snapTo: () => undefined, offset: 0 });
export const useSheet = () => useContext(SheetContext);

type Props = {
    open: boolean;
    header: ReactNode;
    children: ReactNode;
    initialFraction?: number;
    className?: string;
    // visible sheet height in px measured from the bottom of the window
    onHeightChange?: (visiblePx: number) => void;
};

// Bottom drawer shaped like react-modal-sheet (fixed root over the whole app, container with detents).
export const MapSheet = ({ open, header, children, initialFraction = 0.5, className = "bg-default-bg", onHeightChange }: Props) => {
    const [viewport, setViewport] = useState(() => window.innerHeight);
    const [fraction, setFraction] = useState(initialFraction);
    const [drag, setDrag] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState(0);
    const start = useRef<{ y: number; visible: number } | null>(null);

    useEffect(() => {
        const onResize = () => setViewport(window.innerHeight);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        if (open) setFraction(initialFraction);
    }, [open, initialFraction]);

    useLayoutEffect(() => {
        if (containerRef.current) setContainerHeight(containerRef.current.offsetHeight);
    }, [open, viewport]);

    const snapVisible = Math.round(viewport * fraction);
    const visible = drag ?? snapVisible;
    const translate = Math.max(0, containerHeight - visible);

    useEffect(() => {
        if (!onHeightChange) return;
        onHeightChange(open ? snapVisible : 0);
    }, [open, snapVisible]);
    useEffect(() => () => onHeightChange?.(0), []);

    const snapTo = useCallback((value: number) => setFraction(value), []);
    const context = useMemo(() => ({ snapTo, offset: translate }), [snapTo, translate]);

    if (!open) return null;

    const onPointerDown = (event: React.PointerEvent) => {
        if ((event.target as HTMLElement).closest("button:not([aria-label=resize]), a, input, [role=tab]")) return;
        start.current = { y: event.clientY, visible: snapVisible };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: React.PointerEvent) => {
        if (!start.current) return;
        const next = start.current.visible + (start.current.y - event.clientY);
        setDrag(Math.max(viewport * 0.1, Math.min(containerHeight, next)));
    };
    const onPointerUp = () => {
        const began = start.current;
        start.current = null;
        if (began && drag === null) setFraction(SNAPS[0]);
        if (!began || drag === null) return setDrag(null);
        const target = SNAPS.reduce((best, value) => (Math.abs(value * viewport - drag) < Math.abs(best * viewport - drag) ? value : best), SNAPS[0]);
        setFraction(target);
        setDrag(null);
    };

    return createPortal(
        <div
            className="react-modal-sheet-root drawer-force"
            style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 9999, visibility: "visible" }}
        >
            <div
                ref={containerRef}
                className={`react-modal-sheet-container ${className} notranslate`}
                style={{
                    zIndex: 2,
                    position: "absolute",
                    left: 0,
                    bottom: 0,
                    width: "100%",
                    pointerEvents: "auto",
                    display: "flex",
                    flexDirection: "column",
                    borderTopRightRadius: 8,
                    borderTopLeftRadius: 8,
                    boxShadow: "rgba(0, 0, 0, 0.3) 0px -2px 16px",
                    maxHeight: "80%",
                    height: "calc(100% - env(safe-area-inset-top) - 34px)",
                    transform: `translateY(${translate}px)`,
                    transition: drag === null ? "transform 300ms cubic-bezier(0.25, 0.1, 0.25, 1)" : "none",
                }}
            >
                <SheetContext.Provider value={context}>
                    <div
                        className="react-modal-sheet-header-container"
                        style={{ width: "100%", userSelect: "none", touchAction: "none" }}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerUp}
                        onClick={(event) => {
                            if ((event.target as HTMLElement).closest("[role=tab]")) setFraction(SNAPS[0]);
                        }}
                    >
                        {header}
                    </div>
                    <div
                        className="react-modal-sheet-content"
                        style={{ minHeight: 0, position: "relative", flexGrow: 1, display: "flex", flexDirection: "column", paddingBottom: translate }}
                    >
                        <div className="react-modal-sheet-content-scroller" style={{ height: "100%", overflowY: "auto", overscrollBehaviorY: "none" }}>
                            {children}
                        </div>
                    </div>
                </SheetContext.Provider>
            </div>
        </div>,
        document.body,
    );
};

// Round Fab of the drawer header: small secondary (30px) or primary (40px).
export const SheetFab = ({
    Icon,
    onClick,
    color,
    className,
    label,
}: {
    Icon: ComponentType<SvgIconProps>;
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
    color: "primary" | "secondary";
    className?: string;
    label?: string;
}) => (
    <Fab
        color={color}
        size="small"
        onClick={onClick}
        className={className}
        aria-label={label}
        sx={color === "secondary" ? { width: 30, height: 30, minHeight: 30 } : undefined}
    >
        <Icon sx={{ fontSize: color === "primary" ? 24 : 18 }} />
    </Fab>
);

// Header row: Fabs straddling the top edge on both sides, drag handle in the middle.
export const SheetHeaderRow = ({ left, right }: { left: ReactNode; right: ReactNode }) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-around", flex: "1", mt: -4 }}>{left}</Box>
        <Box sx={{ display: "flex", justifyContent: "center", flex: "0" }}>
            <IconButton size="small" aria-label="resize">
                <DragHandleIcon />
            </IconButton>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-around", flex: "1", mt: -4 }}>{right}</Box>
    </Box>
);

export const SheetInfoRow = ({ children }: { children: ReactNode }) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{children}</Box>
);

const delayMinutesOf = (seconds: number) => (seconds > 0 ? Math.floor(seconds / 60) : Math.floor(Math.abs(seconds / 60)) * -1);

// Delay chip of the vehicle / trip headers ("5 min opóźniony", "Odjazd za 3 min"...).
export const DelayChip = ({
    delayMinutes,
    delayInSeconds,
    stopSequence,
    firstStopMinRemaining,
    style,
}: {
    delayMinutes?: number;
    delayInSeconds?: number;
    stopSequence?: number;
    firstStopMinRemaining?: number;
    style?: CSSProperties;
}) => {
    const { t } = useTranslation();
    if (delayInSeconds === undefined && delayMinutes === undefined) return null;
    const minutes = delayMinutes !== undefined ? delayMinutes : delayMinutesOf(delayInSeconds ?? 0);
    const bg = `bg-${delayClassOf(minutes)} text-white`;
    let label: ReactNode = null;
    let icon: ReactNode | undefined;
    if (stopSequence === 0 && minutes <= 0) {
        const text =
            firstStopMinRemaining !== undefined && firstStopMinRemaining > 0 ? (
                t("vehicleDetails.departureInXMins", { min: firstStopMinRemaining })
            ) : firstStopMinRemaining === 0 ? (
                t("vehicleDetails.departureInXMins", { min: "<1" })
            ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
                    <span style={{ fontSize: "0.65em", display: "inline-flex" }}>
                        <BlinkArrows style={{ fontWeight: "normal" }} />
                    </span>
                    {t("vehicleDetails.departing")}
                </span>
            );
        label = (
            <Typography variant="body2" component="span">
                {text}
            </Typography>
        );
        icon = firstStopMinRemaining === undefined || firstStopMinRemaining < 0 ? undefined : <FirstPageIcon className="text-white" fontSize="inherit" />;
    } else if (minutes > 0) {
        label = (
            <Typography variant="body2" component="span">
                {minutes} min {t("global.delayed").toLowerCase()}
            </Typography>
        );
        icon = <HistoryIcon className="text-white" fontSize="inherit" />;
    } else if (minutes < 0) {
        label = (
            <Typography variant="body2" component="span">
                {Math.abs(minutes)} min {t("global.beforeTime").toLowerCase()}
            </Typography>
        );
        icon = <UpdateIcon className="text-white" fontSize="inherit" />;
    } else {
        label = (
            <Typography variant="body2" component="span">
                {t("global.onTime").toLowerCase()}
            </Typography>
        );
        icon = <CheckIcon className="text-white" fontSize="inherit" />;
    }
    return (
        <Chip
            size="small"
            component="span"
            icon={icon as React.ReactElement | undefined}
            sx={{ height: "20px", marginTop: "3px", borderRadius: "8px" }}
            label={label}
            clickable={false}
            style={style}
            className={bg}
        />
    );
};
