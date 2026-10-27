import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import { IconButton } from "@mui/material";
import { forwardRef } from "react";

// Original "ShowMoreButton": small icon button with a faded ▼ / ▲ that toggles an expandable block.
export const ShowMoreButton = forwardRef<HTMLButtonElement, { expanded: boolean; onClick: () => void }>(({ expanded, onClick }, ref) => (
    <IconButton
        ref={ref}
        size="small"
        onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClick();
        }}
    >
        {expanded ? <ArrowDropUpIcon sx={{ opacity: 0.3 }} /> : <ArrowDropDownIcon sx={{ opacity: 0.3 }} />}
    </IconButton>
));
ShowMoreButton.displayName = "ShowMoreButton";
