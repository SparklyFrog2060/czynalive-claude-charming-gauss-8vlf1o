import type { TFunction } from "i18next";
import { delayClassOf } from "@/components/departures/parts";
import { escapeHtml } from "./icons";

const NAME_STYLE = "font-weight: bold; word-break: break-word; color: var(--default-text); background-color: var(--default-bg); padding: 2px 8px; border-radius: 8px;";
const BIG = '<span style="font-weight: bold; font-size: 1.25rem;">';

export type PopupTimes = { depTime: string; delayedDepTime: string; diffDelayed: number; minRemaining: number };

// Plain stop name bubble.
export const stopNamePopup = (name: string) => `
  <div style="display:flex; align-items: center; flex-direction: column;">
    <div style="${NAME_STYLE}">${escapeHtml(name)}</div>
  </div>`;

// Stop name with one scheduled time chip (`?kurs=` view).
export const stopTimePopup = (name: string, time: string) => `
  <div style="display:flex; align-items: center; flex-direction: column; gap: 4px;">
    <div style="${NAME_STYLE}">${escapeHtml(name)}</div>
    <div class="MuiChip-root geojson-chip MuiChip-outlined MuiChip-sizeSmall">
      <span class="MuiChip-label MuiChip-labelSmall">${time}</span>
    </div>
  </div>`;

// Upcoming stop of a live vehicle: minutes left plus planned / live time chips.
export const stopEtaPopup = (name: string, times: PopupTimes, t: TFunction) => {
    const delay = times.diffDelayed > 0 ? Math.floor(times.diffDelayed) : -Math.floor(Math.abs(times.diffDelayed));
    const hours = Math.floor(times.minRemaining / 60);
    const minutes = times.minRemaining % 60;
    const changed = Math.abs(times.diffDelayed) >= 1;
    const remaining =
        times.minRemaining >= 60
            ? `<span>${t("stopDetails.inXMins")} ${BIG}${hours}</span> h</span>${minutes !== 0 ? `<span>${BIG}${minutes}</span> min</span>` : ""}`
            : times.minRemaining < 0
              ? '<span class="departing-animation" style="font-size:1.5rem; font-weight:normal"><span class="departing-arrow">&rsaquo;</span><span class="departing-arrow">&rsaquo;</span><span class="departing-arrow">&rsaquo;</span></span>'
              : times.minRemaining === 0
                ? `${BIG}&lt;1</span> min`
                : `<span>${t("stopDetails.inXMins")} ${BIG}${times.minRemaining}</span> min</span>`;
    return `
  <div style="display:flex; align-items: center; flex-direction: column;">
    <div style="${NAME_STYLE}">${escapeHtml(name)}</div>
    <div style="background-color: var(--default-bg); padding: 2px 8px; border-radius: 8px; margin-top: 2px;">${remaining}</div>
    <div class="MuiBox-root">
      <div class="MuiChip-root geojson-chip MuiChip-outlined MuiChip-sizeSmall">
        <span class="MuiChip-label MuiChip-labelSmall">${changed ? `<s>${times.depTime}</s>` : times.depTime}</span>
      </div>
      ${
          changed
              ? `<div class="MuiChip-root geojson-chip text-white bg-${delayClassOf(delay)} MuiChip-sizeSmall"><span class="MuiChip-label MuiChip-labelSmall">${times.delayedDepTime}</span></div>`
              : ""
      }
    </div>
  </div>`;
};
