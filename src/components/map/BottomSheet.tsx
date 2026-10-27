import { Box, Paper, useMediaQuery } from "@mui/material";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
    open: boolean;
    header: ReactNode;
    children: ReactNode;
    initialSnap?: number;
    onHeightChange?: (px: number, side: boolean) => void;
};

const SNAPS = [0.18, 0.45, 0.92];

// Draggable bottom sheet on phones, left side panel on wide screens (czynaczas drawer).
export const BottomSheet = ({ open, header, children, initialSnap = 1, onHeightChange }: Props) => {
    const side = useMediaQuery("(min-width: 900px)");
    const rootRef = useRef<HTMLDivElement>(null);
    const [snap, setSnap] = useState(SNAPS[initialSnap]);
    const [drag, setDrag] = useState<number | null>(null);
    const dragStart = useRef<{ y: number; fraction: number; parent: number } | null>(null);

    useEffect(() => {
        if (open) setSnap(SNAPS[initialSnap]);
    }, [open, initialSnap]);

    const fraction = drag ?? snap;

    useEffect(() => {
        const parent = rootRef.current?.parentElement;
        if (!onHeightChange) return;
        if (!open) return onHeightChange(0, side);
        if (side) return onHeightChange(420, true);
        if (drag === null && parent) onHeightChange(Math.round(parent.clientHeight * snap), false);
    }, [open, snap, side, drag === null]);

    useEffect(() => () => onHeightChange?.(0, side), []);

    if (!open) return null;

    const onPointerDown = (event: React.PointerEvent) => {
        if (side) return;
        const target = event.target as HTMLElement;
        if (target.closest("button, a, input, [role=tab]")) return;
        const parent = rootRef.current?.parentElement;
        if (!parent) return;
        dragStart.current = { y: event.clientY, fraction: snap, parent: parent.clientHeight };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: React.PointerEvent) => {
        const start = dragStart.current;
        if (!start) return;
        const next = start.fraction + (start.y - event.clientY) / start.parent;
        setDrag(Math.max(0.1, Math.min(0.95, next)));
    };
    const onPointerUp = () => {
        const start = dragStart.current;
        dragStart.current = null;
        if (!start || drag === null) {
            setDrag(null);
            return;
        }
        const moved = drag - start.fraction;
        let target = SNAPS.reduce((best, value) => (Math.abs(value - drag) < Math.abs(best - drag) ? value : best), SNAPS[0]);
        if (Math.abs(moved) > 0.05 && target === start.fraction) {
            const index = SNAPS.indexOf(start.fraction);
            target = SNAPS[Math.max(0, Math.min(SNAPS.length - 1, index + (moved > 0 ? 1 : -1)))];
        }
        setSnap(target);
        setDrag(null);
    };

    return (
        <Paper
            ref={rootRef}
            elevation={8}
            className="bg-default-bg"
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
            sx={
                side
                    ? { position: "absolute", zIndex: 1200, top: 0, left: 0, bottom: 0, width: 420, display: "flex", flexDirection: "column", borderRadius: 0 }
                    : {
                          position: "absolute",
                          zIndex: 1200,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: `${fraction * 100}%`,
                          display: "flex",
                          flexDirection: "column",
                          borderRadius: "16px 16px 0 0",
                          transition: drag === null ? "height 250ms ease" : "none",
                      }
            }
        >
            <Box
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={() => !side && setSnap(snap >= 0.9 ? SNAPS[1] : SNAPS[2])}
                sx={{ flexShrink: 0, touchAction: side ? "auto" : "none", cursor: side ? "default" : "grab" }}
            >
                {!side && (
                    <Box sx={{ display: "flex", justifyContent: "center", pt: 1, pb: 0.5 }}>
                        <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: "text.disabled" }} />
                    </Box>
                )}
                {header}
            </Box>
            <Box sx={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", pb: "calc(8px + var(--sab))" }}>{children}</Box>
        </Paper>
    );
};
