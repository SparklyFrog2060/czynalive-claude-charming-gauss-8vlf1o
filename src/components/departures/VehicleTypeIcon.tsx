import { SvgIcon, type SvgIconProps } from "@mui/material";
import type { CSSProperties, ReactNode } from "react";
import { RouteType } from "@/api/types";

export const vehicleTypeName = (type: number): string => {
    switch (type) {
        case RouteType.Tram:
            return "tram";
        case RouteType.Subway:
            return "subway";
        case RouteType.Rail:
        case RouteType.Funicular:
        case RouteType.Monorail:
            return "train";
        case RouteType.Ferry:
            return "ferry";
        case RouteType.Trolleybus:
            return "trolleybus";
        default:
            return "bus";
    }
};

// Glyphs of the original's /sprites.svg (tram-icon, subway-icon, …).
const GLYPHS: Record<string, ReactNode> = {
    bus: (
        <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
    ),
    tram: (
        <path d="M19 16.94V8.5c0-2.79-2.61-3.4-6.01-3.49l.76-1.51H17V2H7v1.5h4.75l-.76 1.52C7.86 5.11 5 5.73 5 8.5v8.44c0 1.45 1.19 2.66 2.59 2.97L6 21.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 20h-.08c1.69 0 2.58-1.37 2.58-3.06zm-7 1.56c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5-4.5H7V9h10v5z" />
    ),
    subway: (
        <>
            <circle cx="15.5" cy="16" r="1" />
            <circle cx="8.5" cy="16" r="1" />
            <path d="M7.01 9h10v5h-10zM17.8 2.8C16 2.09 13.86 2 12 2c-1.86 0-4 .09-5.8.8C3.53 3.84 2 6.05 2 8.86V22h20V8.86c0-2.81-1.53-5.02-4.2-6.06zm.2 13.08c0 1.45-1.18 2.62-2.63 2.62l1.13 1.12V20H15l-1.5-1.5h-2.83L9.17 20H7.5v-.38l1.12-1.12C7.18 18.5 6 17.32 6 15.88V9c0-2.63 3-3 6-3 3.32 0 6 .38 6 3v6.88z" />
        </>
    ),
    train: (
        <path d="M4 15.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V5c0-3.5-3.58-4-8-4s-8 .5-8 4v10.5zm8 1.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7H6V5h12v5z" />
    ),
    ferry: (
        <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z" />
    ),
    trolleybus: (
        <path d="M13.853,4.257l1.722-3.302c0.159-0.307,0.041-0.687-0.267-0.847C15-0.051,14.62,0.067,14.46,0.375 l-2.003,3.847C12.306,4.22,12.153,4.22,12,4.22c-0.194,0-0.386,0-0.575,0.002l1.703-3.267c0.159-0.307,0.04-0.687-0.267-0.847 c-0.307-0.159-0.687-0.041-0.846,0.267L9.988,4.263C6.354,4.447,3.66,5.289,3.66,8.389v10.424c0,0.916,0.407,1.74,1.042,2.313v1.855 c0,0.573,0.47,1.043,1.043,1.043h1.042c0.574,0,1.042-0.47,1.042-1.043V21.94h8.339v1.042c0,0.573,0.47,1.043,1.044,1.043h1.041 c0.574,0,1.042-0.47,1.042-1.043v-1.855c0.637-0.573,1.045-1.397,1.045-2.313V8.389C20.34,5.245,17.567,4.423,13.853,4.257z M7.309,19.856c-0.864,0-1.563-0.699-1.563-1.564c0-0.864,0.699-1.563,1.563-1.563c0.865,0,1.563,0.698,1.563,1.563 C8.872,19.157,8.174,19.856,7.309,19.856z M16.69,19.856c-0.865,0-1.564-0.699-1.564-1.564c0-0.864,0.699-1.563,1.564-1.563 s1.563,0.698,1.563,1.563C18.253,19.157,17.556,19.856,16.69,19.856z M18.253,13.601H5.745V8.389h12.508V13.601" />
    ),
};

// MUI-sized icon (fill = currentColor), for places that pass sx/color like any SvgIcon.
export const VehicleTypeIcon = ({ routeType: type, ...props }: { routeType: number } & Omit<SvgIconProps, "type">) => (
    <SvgIcon viewBox="0 0 24 24" {...props}>
        {GLYPHS[vehicleTypeName(type)]}
    </SvgIcon>
);

// The original's raw sprite icon: <svg class="MuiSvgIcon-root fill-…" style="width/height">.
export const TypeSvg = ({ type, className, style }: { type: number; className?: string; style?: CSSProperties }) => (
    <svg className={`MuiSvgIcon-root ${className ?? ""}`} style={style} viewBox="0 0 24 24" aria-hidden="true">
        {GLYPHS[vehicleTypeName(type)]}
    </svg>
);

const BIG = { width: "1.8em", height: "1.8em" };

// gh[type].icon / whiteIcon / darkModeWhiteIcon / chipIcon / verticalLineIcon of the original.
export const typeIcons = (type: number) => {
    const name = vehicleTypeName(type);
    return {
        icon: <TypeSvg type={type} className={`fill-${name}`} style={name === "subway" ? { ...BIG, marginRight: 5 } : BIG} />,
        whiteIcon: <TypeSvg type={type} className="fill-white" style={BIG} />,
        darkModeWhiteIcon: <TypeSvg type={type} className="fill-default-text" style={BIG} />,
        chipIcon: <TypeSvg type={type} className="fill-white" style={{ width: "1em", height: "1em" }} />,
        verticalLineIcon: <TypeSvg type={type} className={`fill-${name}`} style={{ fontSize: "0.875rem", width: "1em", height: "1em" }} />,
    };
};
