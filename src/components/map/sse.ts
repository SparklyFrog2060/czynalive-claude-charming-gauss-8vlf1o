import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/api/client";

type Query = Record<string, string | number | boolean | undefined | null>;

export type SseHandlers<I, M> = {
    onInitial?: (data: I) => void;
    onMessage?: (data: M) => void;
    onFatal?: (code: string) => void;
    onError?: () => void;
};

// Zbiorkom SSE: `initial` (context), `message` (live update), `errorCode` (fatal, server closes).
export const openSse = <I, M>(path: string, query: Query | undefined, handlers: SseHandlers<I, M>) => {
    const source = new EventSource(apiUrl(path, query));
    source.addEventListener("initial", (event) => {
        try {
            handlers.onInitial?.(JSON.parse((event as MessageEvent).data));
        } catch {}
    });
    source.addEventListener("message", (event) => {
        try {
            handlers.onMessage?.(JSON.parse((event as MessageEvent).data));
        } catch {}
    });
    source.addEventListener("errorCode", (event) => {
        source.close();
        handlers.onFatal?.(String((event as MessageEvent).data ?? "").replace(/"/g, ""));
    });
    source.onerror = () => handlers.onError?.();
    return { close: () => source.close() };
};

export type SseState<I, M> = { initial: I | undefined; message: M | undefined; fatal: string | undefined; connectionError: boolean };

export const useSse = <I, M>(path: string | null, query?: Query): SseState<I, M> => {
    const [state, setState] = useState<SseState<I, M>>({ initial: undefined, message: undefined, fatal: undefined, connectionError: false });
    const queryKey = JSON.stringify(query ?? {});
    const queryRef = useRef(query);
    queryRef.current = query;

    useEffect(() => {
        setState({ initial: undefined, message: undefined, fatal: undefined, connectionError: false });
        if (!path) return;
        const handle = openSse<I, M>(path, queryRef.current, {
            onInitial: (initial) => setState((prev) => ({ ...prev, initial, connectionError: false })),
            onMessage: (message) => setState((prev) => ({ ...prev, message, connectionError: false })),
            onFatal: (fatal) => setState((prev) => ({ ...prev, fatal })),
            onError: () => setState((prev) => ({ ...prev, connectionError: true })),
        });
        return () => handle.close();
    }, [path, queryKey]);

    return state;
};
