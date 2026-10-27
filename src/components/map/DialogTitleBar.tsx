import CloseIcon from "@mui/icons-material/Close";
import { Box, IconButton, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

// Dialog header of the original: subtitle1 title on the left, extra icons + close on the right.
export const DialogTitleBar = ({ title, onClose, children }: { title?: ReactNode; onClose: () => void; children?: ReactNode }) => {
    const { t } = useTranslation();
    return (
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {title && (
                <Typography variant="subtitle1" sx={{ py: 1, px: 2 }}>
                    {title}
                </Typography>
            )}
            <Box sx={{ ml: "auto", display: "flex" }}>
                {children}
                <IconButton onClick={onClose} size="large" aria-label={t("global.close")}>
                    <CloseIcon />
                </IconButton>
            </Box>
        </Box>
    );
};
