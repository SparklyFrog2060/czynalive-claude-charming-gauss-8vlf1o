import { useEffect, useSyncExternalStore } from "react";

type ShellState = { customText: string | null; showSearch: boolean; viewsHistory: string[] };

let state: ShellState = { customText: null, showSearch: false, viewsHistory: [] };
const listeners = new Set<() => void>();

export const shellStore = {
    get: () => state,
    set: (patch: Partial<ShellState>) => {
        state = { ...state, ...patch };
        listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
};

export const useShell = <T,>(selector: (shell: ShellState) => T): T => useSyncExternalStore(shellStore.subscribe, () => selector(shellStore.get()));

export const setHeaderText = (customText: string | null) => shellStore.set({ customText });
export const setShowSearch = (showSearch: boolean) => shellStore.set({ showSearch });

// Second line under the city name in the top bar (original: stop / line / brigade name); cleared on unmount.
export const useHeaderText = (text: string | null | undefined) => {
    useEffect(() => {
        setHeaderText(text || null);
        return () => setHeaderText(null);
    }, [text]);
};

export const useDocumentTitle = (title: string | null | undefined) => {
    useEffect(() => {
        if (title) document.title = title;
    }, [title]);
};

export const APP_BAR_HEIGHT = 48;
export const BOTTOM_NAV_HEIGHT = 65;

// Height of the area between the top bar and the bottom menu (original TTe helper).
export const contentHeight = (minus = 0) =>
    `calc(100dvh - ${APP_BAR_HEIGHT}px - var(--sat) - var(--bottom-chrome, calc(${BOTTOM_NAV_HEIGHT}px + var(--sab)))${minus ? ` - ${minus}px` : ""})`;
