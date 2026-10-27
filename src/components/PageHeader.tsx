import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useEffect, type ReactNode } from "react";
import { contentHeight, useHeaderText } from "@/lib/shell";

type Props = {
    title?: ReactNode;
    documentTitle?: string;
    subtitle?: string | null;
    // Legacy props (the original has no per-page bar): the shared top bar handles back navigation itself.
    back?: string | true;
    actions?: ReactNode;
};

// Renders nothing: sets the browser tab title and the optional second line under the city name in the shared top bar.
export const PageHeader = ({ title, documentTitle, subtitle }: Props) => {
    useHeaderText(subtitle);
    useEffect(() => {
        const text = documentTitle ?? (typeof title === "string" ? title : undefined);
        if (text) document.title = /czyna/i.test(text) ? text : `${text} - Czynalive`;
    }, [documentTitle, title]);
    return null;
};

const TemplateRoot = styled("div", { shouldForwardProp: (prop) => prop !== "padding" })<{ padding?: boolean }>(({ padding }) => ({
    height: padding ? "inherit" : contentHeight(),
    padding: padding ? "10px 16px" : 0,
}));

// Original page template: optional h6 title, 10px 16px padding (or a full-height box between the bars without padding).
export const PageTemplate = ({ title, padding, children }: { title?: ReactNode; padding?: boolean; children?: ReactNode }) => (
    <TemplateRoot padding={padding}>
        {title && <Typography variant="h6">{title}</Typography>}
        {children}
    </TemplateRoot>
);
