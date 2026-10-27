import type { Map as MapLibreMap } from "maplibre-gl";
import { ICON_PATHS, cssVar } from "./icons";

const pixelRatio = () => Math.min(Math.ceil(window.devicePixelRatio || 1), 3);
const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";
const FONT = `700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;

let measureContext: CanvasRenderingContext2D | null = null;
const measure = () => (measureContext ??= document.createElement("canvas").getContext("2d"));

const drawImage = (map: MapLibreMap, id: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    if (map.hasImage(id)) return;
    const ratio = pixelRatio();
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    draw(ctx);
    map.addImage(id, ctx.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: ratio });
};

// Colors may be CSS vars ("--bus") or literal ("#bd0c00").
const resolveColor = (color: string) => (color.startsWith("--") ? cssVar(color) : color);
const contrastStroke = () => (isDark() ? cssVar("--default-text", "#ccc") : "#ffffff");

// Image ids carry everything needed to redraw them (used by `styleimagemissing`).
export const themeKey = () => (isDark() ? "d" : "l");
export const vehicleRoundId = (color: string) => `veh-round|${color}|${themeKey()}`;
export const vehicleTearId = (color: string) => `veh-tear|${color}|${themeKey()}`;
export const vehicleNumberId = (label: string) => `veh-num|${label}|${themeKey()}`;
export const stopIconId = (colors: string[]) => `stop|${colors.join(",")}|${themeKey()}`;
export const stopArrowId = (color: string) => `stop-arrow|${color}|${themeKey()}`;
export const tripStopId = (color: string) => `trip-stop|${color}|${themeKey()}`;

const SIZE = 30;
const STOP = 26;
const ARROW = 48;

export const generateImage = (map: MapLibreMap, id: string) => {
    const [kind, param] = id.split("|");
    switch (kind) {
        case "veh-round":
            return drawImage(map, id, SIZE, SIZE, (ctx) => {
                ctx.beginPath();
                ctx.arc(SIZE / 2, SIZE / 2, 10, 0, Math.PI * 2);
                ctx.fillStyle = resolveColor(param);
                ctx.fill();
            });
        case "veh-tear":
            return drawImage(map, id, SIZE, SIZE, (ctx) => {
                ctx.translate(SIZE / 2, SIZE / 2);
                ctx.rotate(Math.PI / 4);
                ctx.beginPath();
                ctx.moveTo(-10, -10);
                ctx.lineTo(0, -10);
                ctx.arcTo(10, -10, 10, 0, 10);
                ctx.arcTo(10, 10, 0, 10, 10);
                ctx.arcTo(-10, 10, -10, 0, 10);
                ctx.closePath();
                ctx.fillStyle = resolveColor(param);
                ctx.fill();
            });
        case "veh-num": {
            const context = measure();
            if (!context) return;
            context.font = FONT;
            const width = Math.max(Math.ceil(context.measureText(param).width) + 2, 8);
            return drawImage(map, id, width, 14, (ctx) => {
                ctx.font = FONT;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = isDark() ? cssVar("--default-text", "#ddd") : "#ffffff";
                ctx.fillText(param, width / 2, 7.5);
            });
        }
        case "stop":
            return drawImage(map, id, STOP, STOP, (ctx) => {
                const colors = param.split(",").map(resolveColor);
                const center = STOP / 2;
                const radius = 12;
                ctx.save();
                ctx.beginPath();
                ctx.arc(center, center, radius, 0, Math.PI * 2);
                ctx.clip();
                if (colors.length > 1) {
                    const reach = radius * Math.SQRT2;
                    const gradient = ctx.createLinearGradient(center + Math.SQRT1_2 * reach, center + Math.SQRT1_2 * reach, center - Math.SQRT1_2 * reach, center - Math.SQRT1_2 * reach);
                    gradient.addColorStop(0, colors[0]);
                    gradient.addColorStop(0.49, colors[0]);
                    gradient.addColorStop(0.49, "#ffffff");
                    gradient.addColorStop(0.51, "#ffffff");
                    gradient.addColorStop(0.51, colors[1]);
                    gradient.addColorStop(1, colors[1]);
                    ctx.fillStyle = gradient;
                } else ctx.fillStyle = colors[0];
                ctx.fillRect(0, 0, STOP, STOP);
                ctx.restore();
                ctx.beginPath();
                ctx.arc(center, center, radius - 0.5, 0, Math.PI * 2);
                ctx.lineWidth = 1;
                ctx.strokeStyle = contrastStroke();
                ctx.stroke();
                const icon = 15;
                ctx.save();
                ctx.translate(center - icon / 2, center - icon / 2);
                ctx.scale(icon / 24, icon / 24);
                ctx.fillStyle = contrastStroke();
                ctx.fill(new Path2D(ICON_PATHS.stopBoard));
                ctx.restore();
            });
        case "stop-arrow":
            return drawImage(map, id, ARROW, ARROW, (ctx) => {
                const scale = 34 / 24;
                ctx.translate(ARROW / 2 - 17, ARROW / 2 - 16 - 17);
                ctx.scale(scale, scale);
                const path = new Path2D(ICON_PATHS.stopArrow);
                ctx.fillStyle = resolveColor(param);
                ctx.fill(path);
                ctx.lineWidth = 1;
                ctx.strokeStyle = contrastStroke();
                ctx.stroke(path);
            });
        case "trip-stop":
            return drawImage(map, id, 16, 16, (ctx) => {
                ctx.beginPath();
                ctx.arc(8, 8, 5.5, 0, Math.PI * 2);
                ctx.fillStyle = isDark() ? "#222" : "#ffffff";
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = resolveColor(param);
                ctx.stroke();
            });
    }
};

export const installImageGenerator = (map: MapLibreMap) => {
    map.on("styleimagemissing", (event) => generateImage(map, event.id));
};

// Animated dash of the selected trip's line (the pattern flows along the line, 3 s per period).
const DASH_UNIT = 12.5;
const DASH_GAP = 0.9;
const DASH_PERIOD_MS = 3000;
const DASH_HEIGHT = 8;
const DASH_WIDTH = Math.round(DASH_HEIGHT * (DASH_UNIT + DASH_GAP));
const DASH_ON = (DASH_WIDTH * DASH_UNIT) / (DASH_UNIT + DASH_GAP);

const parseColor = (value: string): [number, number, number] => {
    const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
        const full = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
        return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
    }
    const rgb = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    const hsl = value.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
    if (hsl) {
        const hue = Number(hsl[1]);
        const saturation = Number(hsl[2]) / 100;
        const lightness = Number(hsl[3]) / 100;
        const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
        const sector = (((hue % 360) + 360) % 360) / 60;
        const second = chroma * (1 - Math.abs((sector % 2) - 1));
        const [r, g, b] =
            sector < 1 ? [chroma, second, 0] : sector < 2 ? [second, chroma, 0] : sector < 3 ? [0, chroma, second] : sector < 4 ? [0, second, chroma] : sector < 5 ? [second, 0, chroma] : [chroma, 0, second];
        const m = lightness - chroma / 2;
        return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
    }
    return [136, 136, 136];
};

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

const paintDash = (data: Uint8Array, shift: number, [r, g, b]: [number, number, number]) => {
    const rowBytes = DASH_WIDTH * 4;
    for (let x = 0; x < DASH_WIDTH; x++) {
        const cover =
            overlap(x, x + 1, shift - DASH_WIDTH, shift - DASH_WIDTH + DASH_ON) + overlap(x, x + 1, shift, shift + DASH_ON) + overlap(x, x + 1, shift + DASH_WIDTH, shift + DASH_WIDTH + DASH_ON);
        const offset = x * 4;
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
        data[offset + 3] = Math.round(Math.min(cover, 1) * 255);
    }
    for (let y = 1; y < DASH_HEIGHT; y++) data.copyWithin(y * rowBytes, 0, rowBytes);
};

export const tripDashId = (map: MapLibreMap, typeName: string) => {
    const id = `trip-dash-${typeName}|${themeKey()}`;
    if (map.hasImage(id)) return id;
    const color = parseColor(cssVar(`--${typeName}`, "#888888"));
    const data = new Uint8Array(DASH_WIDTH * DASH_HEIGHT * 4);
    paintDash(data, 0, color);
    let owner: MapLibreMap | null = null;
    let last = -1;
    map.addImage(id, {
        width: DASH_WIDTH,
        height: DASH_HEIGHT,
        data,
        onAdd: (added: MapLibreMap) => {
            owner = added;
        },
        render: () => {
            const shift = ((performance.now() % DASH_PERIOD_MS) / DASH_PERIOD_MS) * DASH_WIDTH;
            owner?.triggerRepaint();
            if (Math.abs(shift - last) < 0.01) return false;
            last = shift;
            paintDash(data, shift, color);
            return true;
        },
    } as never);
    return id;
};

// City name pill shown instead of vehicles when zoomed far out.
const CITY_FONT = `700 20px "Helvetica Neue", Arial, Helvetica, sans-serif`;
const CITY_PAD = 6;
const CITY_BORDER = 2;
const CITY_HEIGHT = 30;
const CITY_MAX = 200;

export const cityPillId = (map: MapLibreMap, city: string, name: string) => {
    const id = `city|${city}|${themeKey()}`;
    if (map.hasImage(id)) return id;
    const context = measure();
    if (!context) return id;
    context.font = CITY_FONT;
    const width = Math.min(Math.ceil(context.measureText(name).width), CITY_MAX) + CITY_PAD * 2 + CITY_BORDER * 2;
    const height = CITY_HEIGHT + CITY_BORDER * 2;
    drawImage(map, id, width, height, (ctx) => {
        const dark = isDark();
        const background = dark ? cssVar("--primary") : cssVar("--default-bg");
        const foreground = dark ? cssVar("--default-text") : cssVar("--primary");
        const x = CITY_BORDER / 2;
        const w = width - CITY_BORDER;
        const h = height - CITY_BORDER;
        const r = 16;
        ctx.beginPath();
        ctx.moveTo(x + r, x);
        ctx.lineTo(x + w - r, x);
        ctx.arcTo(x + w, x, x + w, x + r, r);
        ctx.lineTo(x + w, x + h - r);
        ctx.arcTo(x + w, x + h, x + w - r, x + h, r);
        ctx.lineTo(x + r, x + h);
        ctx.arcTo(x, x + h, x, x + h - r, r);
        ctx.lineTo(x, x + r);
        ctx.arcTo(x, x, x + r, x, r);
        ctx.closePath();
        ctx.fillStyle = background;
        ctx.fill();
        ctx.lineWidth = CITY_BORDER;
        ctx.strokeStyle = foreground;
        ctx.stroke();
        ctx.font = CITY_FONT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = foreground;
        ctx.fillText(name, width / 2, height / 2 + 1, CITY_MAX);
    });
    return id;
};
