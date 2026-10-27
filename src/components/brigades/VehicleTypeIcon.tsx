import { Box, SvgIcon, type SvgIconProps } from "@mui/material";
import { typeIconPath } from "@/components/map/icons";
import { vehicleType } from "@/lib/transit";

// Glyph of the original /sprites.svg (bus-icon, tram-icon, …).
export const VehicleGlyph = ({ vehicle, ...props }: { vehicle: number } & Omit<SvgIconProps, "type">) => (
    <SvgIcon viewBox="0 0 24 24" {...props}>
        <path d={typeIconPath(vehicle)} />
    </SvgIcon>
);

// Original VehicleTypeChip: square in the vehicle type colour (radius 6) with a white glyph of 62.5 % of its size.
export const VehicleTypeIcon = ({ type, size = 32 }: { type: number; size?: number }) => {
    const glyph = Math.round(size * 0.625);
    return (
        <Box sx={{ display: "inline-flex", alignItems: "center", height: size, borderRadius: "6px", overflow: "hidden", flexShrink: 0 }}>
            <Box
                sx={{
                    height: "100%",
                    minWidth: size,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: vehicleType(type).cssVar,
                    color: "var(--white)",
                    "& svg": { width: `${glyph}px !important`, height: `${glyph}px !important` },
                }}
            >
                <VehicleGlyph vehicle={type} className="fill-white" />
            </Box>
        </Box>
    );
};
