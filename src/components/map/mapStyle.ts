import type { StyleSpecification } from "maplibre-gl";

export type TileLayer = "streets" | "osm" | "satellite";

const OPENFREEMAP_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const OPENFREEMAP_DARK = "https://tiles.openfreemap.org/styles/dark";

const DARK_RASTER = {
    "raster-brightness-min": 0.95,
    "raster-brightness-max": 0,
    "raster-hue-rotate": 180,
    "raster-contrast": -0.1,
    "raster-saturation": -0.5,
};

const osmStyle = (dark: boolean): StyleSpecification => ({
    version: 8,
    sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19 } },
    layers: [{ id: "osm-raster", type: "raster", source: "osm", paint: dark ? DARK_RASTER : {} }],
});

const satelliteStyle = (): StyleSpecification => ({
    version: 8,
    sources: {
        "esri-imagery": {
            type: "raster",
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
            tileSize: 256,
            maxzoom: 18,
        },
        "esri-transportation": {
            type: "raster",
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"],
            tileSize: 256,
            maxzoom: 18,
        },
    },
    layers: [
        { id: "esri-imagery", type: "raster", source: "esri-imagery" },
        { id: "esri-transportation", type: "raster", source: "esri-transportation" },
    ],
});

export const mapStyleFor = (layer: TileLayer, dark: boolean): StyleSpecification | string => {
    if (layer === "satellite") return satelliteStyle();
    if (layer === "osm") return osmStyle(dark);
    return dark ? OPENFREEMAP_DARK : OPENFREEMAP_LIGHT;
};

export const attributionFor = (layer: TileLayer) =>
    `<div data-nosnippet style="font-size: 10px; display: block; margin-bottom: 0 !important">${attributionText(layer)}</div>`;

const attributionText = (layer: TileLayer) =>
    layer === "satellite"
        ? "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
        : `© autorzy <a href="https://www.openstreetmap.org/copyright" class="link-unstyled" target="_blank" rel="nofollow noopener noreferrer">OpenStreetMap</a>${
              layer === "streets" ? ' | <a href="https://openfreemap.org" class="link-unstyled" target="_blank" rel="nofollow noopener noreferrer">OpenFreeMap</a>' : ""
          }`;

export const normalizeTileLayer = (value: string | undefined): TileLayer => (value === "satellite" || value === "streets" ? value : "osm");
