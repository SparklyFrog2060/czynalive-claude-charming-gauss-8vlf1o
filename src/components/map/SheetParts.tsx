import { Alert, AlertTitle, Box, IconButton, Snackbar, Tooltip, Typography } from "@mui/material";
import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { EAlertTuple, type AlertTuple } from "@/api/types";
import { showToast } from "./Toasts";

export const SheetIconButton = ({ title, onClick, children, active }: { title: string; onClick: (event: ReactMouseEvent<HTMLElement>) => void; children: ReactNode; active?: boolean }) => (
    <Tooltip title={title}>
        <IconButton
            aria-label={title}
            onClick={onClick}
            size="small"
            color="primary"
            className={active ? "bg-warning" : undefined}
            sx={{ border: 1, borderColor: "divider", width: 36, height: 36 }}
        >
            {children}
        </IconButton>
    </Tooltip>
);

export const SheetToolbar = ({ left, right }: { left?: ReactNode; right?: ReactNode }) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 2, py: 0.75, gap: 1 }}>
        <Box sx={{ display: "flex", gap: 1 }}>{left}</Box>
        <Box sx={{ display: "flex", gap: 1 }}>{right}</Box>
    </Box>
);

export const AlertList = ({ alerts }: { alerts: AlertTuple[] }) => {
    if (!alerts.length) return null;
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mx: 2, mb: 1 }}>
            {alerts.map((alert, index) => (
                <Alert key={index} severity={alert[EAlertTuple.detected] ? "warning" : "info"} variant="outlined" sx={{ py: 0 }}>
                    <AlertTitle sx={{ mb: 0, fontSize: "0.9rem" }}>{alert[EAlertTuple.title]}</AlertTitle>
                    {alert[EAlertTuple.description] && (
                        <Typography variant="body2" sx={{ whiteSpace: "pre-line", maxHeight: 120, overflow: "auto" }}>
                            {alert[EAlertTuple.description].replace(/[*_#>]/g, "")}
                        </Typography>
                    )}
                    {alert[EAlertTuple.url] && (
                        <a href={alert[EAlertTuple.url]} target="_blank" rel="noopener noreferrer nofollow">
                            {alert[EAlertTuple.url]}
                        </a>
                    )}
                </Alert>
            ))}
        </Box>
    );
};

export const useToast = () => ({ show: (message: string) => showToast(message), element: null });
