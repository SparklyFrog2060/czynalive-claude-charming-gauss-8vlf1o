import { useCallback, useSyncExternalStore } from "react";

type Listener = () => void;

export const createPersistedStore = <T extends object>(key: string, defaults: T) => {
    const listeners = new Set<Listener>();
    let state: T = defaults;
    try {
        const raw = localStorage.getItem(key);
        if (raw) state = { ...defaults, ...JSON.parse(raw) };
    } catch {}

    const get = () => state;
    const set = (patch: Partial<T> | ((prev: T) => Partial<T>)) => {
        const next = typeof patch === "function" ? patch(state) : patch;
        state = { ...state, ...next };
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch {}
        listeners.forEach((listener) => listener());
    };
    const subscribe = (listener: Listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    const useStore = (): [T, typeof set] => {
        const value = useSyncExternalStore(subscribe, get, get);
        return [value, useCallback(set, [])];
    };

    return { get, set, subscribe, useStore, key };
};
