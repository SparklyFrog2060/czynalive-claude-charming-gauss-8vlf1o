const KEYFRAMES = `@keyframes course-progress-shimmer { 0% { background-position: 0% center; } 100% { background-position: 100% center; } }`;

// Thin shimmering progress line at the top of the vehicle sheet.
export const TripProgress = ({ color, fraction }: { color: string; fraction: number }) => {
    const gradient = `linear-gradient(to right, color-mix(in srgb, ${color} 60%, #000), color-mix(in srgb, ${color} 85%, #fff), color-mix(in srgb, ${color} 60%, #000))`;
    return (
        <>
            <style>{KEYFRAMES}</style>
            <div style={{ width: "100%", height: 2, position: "relative", overflow: "visible" }}>
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: gradient,
                        backgroundSize: "200% 100%",
                        animation: "course-progress-shimmer 4s ease-in-out infinite alternate",
                        transformOrigin: "left",
                        transform: `scaleX(${fraction})`,
                        transition: "transform 700ms ease",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: `${fraction * 100}%`,
                        transform: "translate(-50%, -50%)",
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        backgroundColor: `color-mix(in srgb, ${color} 55%, #fff)`,
                        boxShadow: `0 0 8px 3px ${color}`,
                        opacity: fraction > 0 ? 1 : 0,
                        transition: "left 700ms ease",
                    }}
                />
            </div>
        </>
    );
};
