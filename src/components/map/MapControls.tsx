import FilterAltIcon from "@mui/icons-material/FilterAlt";
import LayersIcon from "@mui/icons-material/Layers";
import StarIcon from "@mui/icons-material/Star";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useTranslation } from "react-i18next";

type Props = {
    map: MapLibreMap;
    showBar: boolean;
    filterActive: boolean;
    favouritesActive: boolean;
    located: boolean;
    locating: boolean;
    onFilter: () => void;
    onLayers: () => void;
    onFavourites: () => void;
    onLocate: () => void;
};

const LOCATE_IDLE =
    '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 3a7 7 0 0 0-7 7c0 5.2 7 11 7 11s7-5.8 7-11a7 7 0 0 0-7-7Zm0 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"></path><path d="M4 3 20 19" stroke="currentColor" stroke-width="2" fill="none"></path></svg>';
const LOCATE_LOADING =
    '<svg width="16" height="16" viewBox="-8 -8 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="currentColor"><circle opacity=".7" cx="0" cy="-6" r=".9" transform="rotate(90)" /><circle opacity=".9" cx="0" cy="-6" r="1.3" transform="rotate(45)" /><circle opacity="1" cx="0" cy="-6" r="1.5" /><circle opacity=".95" cx="0" cy="-6" r="1.42" transform="rotate(-45)" /><circle opacity=".85" cx="0" cy="-6" r="1.26" transform="rotate(-90)" /><circle opacity=".7" cx="0" cy="-6" r="1.02" transform="rotate(-135)" /><circle opacity=".5" cx="0" cy="-6" r=".7" transform="rotate(-180)" /><circle opacity=".25" cx="0" cy="-6" r=".3" transform="rotate(-225)" /><animateTransform attributeName="transform" type="rotate" values="0;0;45;45;90;90;135;135;180;180;225;225;270;270;315;315;360" keyTimes="0;.125;.125;.25;.25;.375;.375;.5;.5;.675;.675;.75;.75;.875;.875;1;1" dur="1.3s" repeatCount="indefinite" /></g></svg>';
const LOCATE_LOCATED =
    '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M 13.329384,2.6706085 C 13.133096,2.4743297 12.77601,2.4382611 12.303066,2.6103882 L 6.6307133,4.6742285 1.1816923,6.6577732 C 1.0668479,6.6995703 0.95157337,6.752486 0.83540381,6.8133451 0.27343954,7.1201064 0.41842508,7.4470449 1.2644998,7.5962244 l 6.0688263,1.0701854 1.0714872,6.0698222 c 0.1491847,0.84604 0.4751513,0.990031 0.7816575,0.427825 0.060857,-0.116165 0.1137803,-0.231436 0.1555779,-0.346273 L 11.324426,9.3702482 13.389608,3.6968841 C 13.56174,3.2239596 13.52567,2.8668883 13.329392,2.6706094 Z" /></svg>';

const STOP_EVENTS = {
    onPointerDown: (event: React.SyntheticEvent) => event.stopPropagation(),
    onWheel: (event: React.SyntheticEvent) => event.stopPropagation(),
    onDoubleClick: (event: React.SyntheticEvent) => event.stopPropagation(),
};

// Two bottom-right corners as in czynaczas: GPS + zoom, and the filter / layers / favourites bar above them.
export const MapControls = ({ map, showBar, filterActive, favouritesActive, located, locating, onFilter, onLayers, onFavourites, onLocate }: Props) => {
    const { t } = useTranslation();
    const locateState = locating ? "loading" : located ? "located" : "idle";
    return (
        <>
            <div className="mapgl-bottom-right" {...STOP_EVENTS}>
                <div className="mapgl-bar mapgl-control">
                    <button
                        type="button"
                        className={`mapgl-locate-button${located ? " is-located" : ""}`}
                        title={t("map.findMyLocation")}
                        aria-label={t("map.findMyLocation")}
                        aria-pressed={false}
                        aria-busy={locating}
                        onClick={onLocate}
                        dangerouslySetInnerHTML={{
                            __html: locateState === "idle" ? LOCATE_IDLE : locateState === "loading" ? LOCATE_LOADING : LOCATE_LOCATED,
                        }}
                    />
                </div>
                <div className="mapgl-control-zoom mapgl-bar mapgl-control">
                    <button
                        type="button"
                        className="mapgl-control-zoom-in"
                        title={t("global.zoomIn")}
                        aria-label={t("global.zoomIn")}
                        onClick={() => map.zoomIn()}
                    >
                        <span aria-hidden="true">+</span>
                    </button>
                    <button
                        type="button"
                        className="mapgl-control-zoom-out"
                        title={t("global.zoomOut")}
                        aria-label={t("global.zoomOut")}
                        onClick={() => map.zoomOut()}
                    >
                        <span aria-hidden="true">−</span>
                    </button>
                </div>
            </div>
            {showBar && (
                <div className="mapgl-bottom-right" {...STOP_EVENTS}>
                    <div className="mapgl-control mapgl-bar mapgl-controls" style={{ display: "block" }}>
                        <button
                            type="button"
                            title={t("map.filterDialogHeader")}
                            className={`mapgl-filter-button ${filterActive ? "bg-primary text-white btn-filter-animate" : ""}`}
                            style={{ borderBottom: "1px solid var(--default-text)" }}
                            onClick={onFilter}
                        >
                            <FilterAltIcon fontSize="small" />
                        </button>
                        <button
                            type="button"
                            title={t("map.layersHeader")}
                            className="mapgl-filter-button"
                            style={{ borderBottom: "1px solid var(--default-text)" }}
                            onClick={onLayers}
                        >
                            <LayersIcon fontSize="small" />
                        </button>
                        <button
                            type="button"
                            className={`mapgl-filter-button ${favouritesActive ? "bg-primary text-white btn-filter-animate" : ""}`}
                            title={t("map.favouritesModeShowHide")}
                            onClick={onFavourites}
                        >
                            <StarIcon fontSize="small" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
