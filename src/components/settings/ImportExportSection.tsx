import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadIcon from "@mui/icons-material/Upload";
import { Alert, Box, Button, Divider, IconButton, Paper, Typography } from "@mui/material";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { rebrand } from "./SimpleSections";

const PREFIX = "czynalive:";
const SKIPPED = new Set(["czynalive:cities"]);

type Backup = { app: "czynalive"; version: 1; exportedAt: string; data: Record<string, string> };

export const ImportExportSection = () => {
    const { t } = useTranslation();
    const input = useRef<HTMLInputElement | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
    const [file, setFile] = useState<File | null>(null);

    const exportData = () => {
        try {
            const data: Record<string, string> = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(PREFIX) && !SKIPPED.has(key)) data[key] = localStorage.getItem(key) ?? "";
            }
            const backup: Backup = { app: "czynalive", version: 1, exportedAt: new Date().toISOString(), data };
            const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = `czynalive-ustawienia-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setTimeout(() => setMessage({ type: "success", text: t("settings.exportSuccess") }), 500);
        } catch {
            setMessage({ type: "error", text: t("settings.exportError") });
        }
    };

    const importData = async (file: File) => {
        try {
            const backup = JSON.parse(await file.text()) as Partial<Backup>;
            if (backup?.app !== "czynalive" || !backup.data || typeof backup.data !== "object") {
                setMessage({ type: "error", text: rebrand(t("settings.importValidationError")) });
                return;
            }
            const entries = Object.entries(backup.data).filter(([key, value]) => key.startsWith(PREFIX) && typeof value === "string");
            if (!entries.length) {
                setMessage({ type: "error", text: rebrand(t("settings.importValidationError")) });
                return;
            }
            for (const [key, value] of entries) localStorage.setItem(key, value);
            setFile(null);
            setMessage({ type: "success", text: t("settings.importSuccess") });
            setTimeout(() => window.location.reload(), 3000);
        } catch {
            setMessage({ type: "error", text: t("settings.importError") });
        }
    };

    return (
        <div>
            <Typography variant="h3" gutterBottom>
                {t("settings.importExportPageTitle")}
            </Typography>
            <Alert variant="standard" severity="info" sx={{ my: 3 }}>
                <Typography variant="body2">{t("settings.importExportInfoPart1")}</Typography>
            </Alert>
            <Alert variant="standard" severity="warning" sx={{ my: 3 }}>
                <Typography variant="body2">{t("settings.importExportWarning")}</Typography>
            </Alert>
            <Divider sx={{ my: 3 }} />
            <Box>
                <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h5" gutterBottom>
                        {t("settings.exportSettings")}
                    </Typography>
                    <Typography variant="body2" gutterBottom sx={{ mb: 2 }}>
                        {t("settings.exportDescription")}
                    </Typography>
                    <Button variant="contained" startIcon={<DownloadIcon />} onClick={exportData} size="small">
                        {t("settings.exportButton")}
                    </Button>
                </Paper>
                <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h5" gutterBottom>
                        {t("settings.importSettings")}
                    </Typography>
                    <Typography variant="body2" gutterBottom sx={{ mb: 2 }}>
                        {t("settings.importDescription")}
                    </Typography>
                    <Button variant="contained" component="label" startIcon={<UploadIcon />} size="small" color="secondary">
                        {t("settings.selectFileToImport")}
                        <input
                            ref={input}
                            type="file"
                            accept=".json"
                            style={{ display: "none" }}
                            onChange={(event) => {
                                const selected = event.target.files?.[0];
                                if (selected) {
                                    setFile(selected);
                                    setMessage(null);
                                }
                                event.target.value = "";
                            }}
                        />
                    </Button>
                    {file && (
                        <>
                            <Box
                                sx={{
                                    mt: 2,
                                    p: 1.5,
                                    border: 1,
                                    borderColor: "divider",
                                    borderRadius: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                                    {file.name}
                                </Typography>
                                <IconButton onClick={() => (setFile(null), setMessage(null))} size="small" color="error" sx={{ ml: 1 }}>
                                    <DeleteIcon />
                                </IconButton>
                            </Box>
                            <Button variant="contained" color="primary" onClick={() => importData(file)} size="small" fullWidth sx={{ mt: 2 }}>
                                {t("global.import")}
                            </Button>
                        </>
                    )}
                </Paper>
                {message && (
                    <Alert variant="standard" severity={message.type} sx={{ mt: 2 }}>
                        {message.text}
                    </Alert>
                )}
            </Box>
        </div>
    );
};
