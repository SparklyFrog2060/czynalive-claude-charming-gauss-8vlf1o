import CloseIcon from "@mui/icons-material/Close";
import { Box, IconButton } from "@mui/material";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

// notistack look-alike used by the map (the original's SnackbarProvider: bottom-left, 3 s, close button, max 3).
type Toast = { id: number; key?: string; message: ReactNode; variant: "default" | "error"; action?: (close: () => void) => ReactNode; duration: number };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const closeToast = (id: number) => {
    toasts = toasts.filter((toast) => toast.id !== id);
    emit();
};

export const showToast = (
    message: ReactNode,
    options: { key?: string; variant?: "default" | "error"; action?: (close: () => void) => ReactNode; duration?: number; preventDuplicate?: boolean } = {},
) => {
    if (options.preventDuplicate !== false && options.key && toasts.some((toast) => toast.key === options.key)) return;
    const toast: Toast = { id: nextId++, key: options.key, message, variant: options.variant ?? "default", action: options.action, duration: options.duration ?? 3000 };
    toasts = [...toasts, toast].slice(-3);
    emit();
    return toast.id;
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const ToastItem = ({ toast }: { toast: Toast }) => {
    const [hover, setHover] = useState(false);
    useEffect(() => {
        if (hover || !toast.duration) return;
        const timer = setTimeout(() => closeToast(toast.id), toast.duration);
        return () => clearTimeout(timer);
    }, [hover, toast.id]);
    const close = () => closeToast(toast.id);
    return (
        <div className="notistack-CollapseWrapper" style={{ display: "flex", padding: "6px 0" }}>
            <Box
                className={`notistack-MuiContent notistack-MuiContent-${toast.variant}`}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    flexGrow: { xs: 1, sm: 0 },
                    minWidth: { sm: 288 },
                    backgroundColor: toast.variant === "error" ? "#d32f2f" : "#313131",
                    color: "#fff",
                    fontSize: "0.875rem",
                    lineHeight: 1.43,
                    letterSpacing: "0.01071em",
                    borderRadius: "4px",
                    padding: "6px 16px",
                    boxShadow: "0px 3px 5px -1px rgba(0,0,0,0.2),0px 6px 10px 0px rgba(0,0,0,0.14),0px 1px 18px 0px rgba(0,0,0,0.12)",
                    wordBreak: "break-word",
                    pointerEvents: "auto",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", padding: "8px 0" }}>{toast.message}</div>
                <div style={{ display: "flex", alignItems: "center", marginLeft: "auto", paddingLeft: 16, marginRight: -8 }}>
                    {toast.action ? (
                        toast.action(close)
                    ) : (
                        <IconButton size="small" className="text-white snackbar-close-button" onClick={close} aria-label="close">
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    )}
                </div>
            </Box>
        </div>
    );
};

export const ToastHost = () => {
    const list = useSyncExternalStore(subscribe, () => toasts);
    useEffect(
        () => () => {
            toasts = [];
            emit();
        },
        [],
    );
    if (!list.length) return null;
    return (
        <Box
            className="notistack-SnackbarContainer snackbar-margin"
            sx={{
                position: "fixed",
                zIndex: 1400,
                display: "flex",
                flexDirection: "column-reverse",
                bottom: 14,
                left: { xs: 16, sm: 20 },
                right: { xs: 16, sm: "auto" },
                maxWidth: { xs: "calc(100% - 32px)", sm: 568 },
                pointerEvents: "none",
            }}
        >
            {[...list].reverse().map((toast) => (
                <ToastItem key={toast.id} toast={toast} />
            ))}
        </Box>
    );
};

export const CloseToastButton = ({ onClick }: { onClick: () => void }) => (
    <IconButton size="small" className="text-white snackbar-close-button" onClick={onClick} aria-label="close">
        <CloseIcon fontSize="small" />
    </IconButton>
);
