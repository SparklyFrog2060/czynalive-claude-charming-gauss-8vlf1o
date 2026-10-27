import type { CSSProperties } from "react";

// Own 92×30 brand plate (same footprint as the original logo image).
export const BrandLogo = ({ style }: { style?: CSSProperties }) => (
    <svg width="92" height="30" viewBox="0 0 92 30" role="img" aria-label="Czynalive Logo" style={style}>
        <rect x="1" y="1" width="90" height="28" rx="8" fill="var(--default-bg)" stroke="var(--primary)" strokeWidth="1.5" />
        <g transform="translate(6 6) scale(0.28)">
            <rect width="64" height="64" rx="14" fill="#29a847" />
            <path
                d="M18 14h28a6 6 0 0 1 6 6v22a4 4 0 0 1-4 4h-2v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-4H24v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-4h-2a4 4 0 0 1-4-4V20a6 6 0 0 1 6-6zm0 8v10h28V22zm2 16a3 3 0 1 0 0 .1zm24 0a3 3 0 1 0 0 .1z"
                fill="#fff"
            />
        </g>
        <text x="27" y="20" fontFamily="Roboto, Arial, sans-serif" fontSize="13" fontWeight="700" fontStyle="italic" fill="var(--primary)">
            czynalive
        </text>
    </svg>
);

// Bottom-left brand plate (same slot and size as the czynaczas logo control).
export const MapLogo = ({ bottom }: { bottom: number }) => (
    <div className="mapgl-bottom-left czynaczas-logo-control">
        <div className="mapgl-control mapgl-bar mapgl-controls" style={{ display: "block", bottom, border: 0 }}>
            <BrandLogo style={{ opacity: 0.7, display: "block" }} />
        </div>
    </div>
);

// Dimmed full-screen spinner shown until the first live vehicle update arrives.
export const MapLoadingOverlay = () => (
    <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0, 0, 0, 0.5)", zIndex: 400 }}>
        <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
            <div className="spinner" />
        </div>
    </div>
);
