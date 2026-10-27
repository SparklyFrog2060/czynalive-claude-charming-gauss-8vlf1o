import ShareIcon from "@mui/icons-material/Share";
import { IconButton, Snackbar, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export const ShareLink = ({ title }: { title: string }) => {
    const { t } = useTranslation();
    const [message, setMessage] = useState<string | null>(null);

    const share = async () => {
        const url = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ title, url });
                return;
            }
            await navigator.clipboard.writeText(url);
            setMessage(t("settings.urlCopied"));
        } catch (error) {
            if ((error as Error)?.name !== "AbortError") setMessage(t("settings.urlCopyError"));
        }
    };

    return (
        <Typography variant="caption" data-nosnippet>
            {t("global.shareUrl")}:
            <IconButton size="small" color="primary" onClick={share} aria-label={t("global.share")}>
                <ShareIcon fontSize="small" />
            </IconButton>
            <Snackbar open={!!message} autoHideDuration={3000} onClose={() => setMessage(null)} message={message} />
        </Typography>
    );
};
