import IosShareIcon from "@mui/icons-material/IosShare";
import ShareIcon from "@mui/icons-material/Share";
import { IconButton, Snackbar } from "@mui/material";
import { useState } from "react";

const isApple = typeof navigator !== "undefined" && /iPhone|iPad|Macintosh/.test(navigator.userAgent);

// Web Share API with clipboard fallback, like czynaczas "Udostępnij link".
export const ShareButton = ({ text }: { text?: string }) => {
    const [message, setMessage] = useState<string | null>(null);

    const share = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({ title: "Czynalive", text, url });
                return;
            } catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") return;
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            setMessage("Skopiowano URL!");
        } catch {
            setMessage("BŁĄD. Skopiuj link ręcznie.");
        }
    };

    return (
        <>
            <IconButton size="small" color="primary" onClick={share} aria-label="Udostępnij">
                {isApple ? <IosShareIcon fontSize="small" /> : <ShareIcon fontSize="small" />}
            </IconButton>
            <Snackbar open={message !== null} autoHideDuration={2000} onClose={() => setMessage(null)} message={message} />
        </>
    );
};
