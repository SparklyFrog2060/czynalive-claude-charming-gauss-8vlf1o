// Native share sheet when available, clipboard otherwise. Resolves "copied" when the link went to the clipboard.
export const shareLink = async (title: string, text: string, url: string): Promise<"shared" | "copied" | "failed"> => {
    if (navigator.share) {
        try {
            await navigator.share({ title, text, url });
            return "shared";
        } catch (error) {
            if ((error as Error)?.name === "AbortError") return "shared";
        }
    }
    try {
        await navigator.clipboard.writeText(`${text}${url}`);
        return "copied";
    } catch {
        return "failed";
    }
};
