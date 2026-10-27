import { useEffect, useRef, useState } from "react";
import { apiGet, apiUrl } from "@/api/client";
import type { StopDepartureTuple, StopTupleDetailed } from "@/api/types";
import { isWstStopId, loadWstStopDepartures } from "@/api/wst";

type Options = { limit?: number; before?: number; routes?: string[]; destinations?: string[]; enabled?: boolean };

export type StopDeparturesState = {
    stop: StopTupleDetailed | undefined;
    departures: StopDepartureTuple[] | undefined;
    error: string | undefined;
    live: boolean;
    updatedAt: number | undefined;
};

const POLL_MS = 20000;
const WST_POLL_MS = 15000;

// Live stop board: SSE `stops/:id/stream`, falling back to polling `/stops/:id`.
export const useStopDepartures = (city: string, stopId: string, options: Options = {}): StopDeparturesState => {
    const { limit = 20, before, enabled = true } = options;
    const routes = options.routes?.join(",") || undefined;
    const destinations = options.destinations?.join(",") || undefined;
    const [state, setState] = useState<StopDeparturesState>({ stop: undefined, departures: undefined, error: undefined, live: false, updatedAt: undefined });
    const keyRef = useRef("");

    useEffect(() => {
        if (!enabled || !city || !stopId) return;
        const key = `${city}/${stopId}`;
        if (keyRef.current !== key) {
            keyRef.current = key;
            setState({ stop: undefined, departures: undefined, error: undefined, live: false, updatedAt: undefined });
        }

        if (isWstStopId(stopId)) {
            let closed = false;
            let pollTimer: ReturnType<typeof setTimeout> | undefined;
            let controller: AbortController | undefined;

            const poll = () => {
                controller = new AbortController();
                loadWstStopDepartures(stopId, { limit }, controller.signal)
                    .then((response) => {
                        if (closed) return;
                        setState({ stop: response.stop, departures: response.departures, error: undefined, live: true, updatedAt: Date.now() });
                    })
                    .catch((err: Error) => {
                        if (closed || controller?.signal.aborted) return;
                        setState((prev) => ({ ...prev, error: err.message }));
                    })
                    .finally(() => {
                        if (!closed) pollTimer = setTimeout(poll, WST_POLL_MS);
                    });
            };
            poll();
            return () => {
                closed = true;
                clearTimeout(pollTimer);
                controller?.abort();
            };
        }

        const query = { limit, before, routes, destinations };
        let closed = false;
        let source: EventSource | undefined;
        let pollTimer: ReturnType<typeof setTimeout> | undefined;
        let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
        let polling = false;
        let controller: AbortController | undefined;
        let received = false;

        const poll = () => {
            controller = new AbortController();
            apiGet<{ stop: StopTupleDetailed; departures: StopDepartureTuple[] }>(`/${city}/stops/${encodeURIComponent(stopId)}`, query, controller.signal)
                .then((response) => {
                    if (closed) return;
                    setState({ stop: response.stop, departures: response.departures, error: undefined, live: false, updatedAt: Date.now() });
                })
                .catch((err: Error) => {
                    if (closed || controller?.signal.aborted) return;
                    setState((prev) => ({ ...prev, error: err.message }));
                })
                .finally(() => {
                    if (!closed) pollTimer = setTimeout(poll, POLL_MS);
                });
        };

        const startPolling = () => {
            source?.close();
            source = undefined;
            clearTimeout(fallbackTimer);
            if (closed || polling) return;
            polling = true;
            poll();
        };

        if (typeof EventSource === "undefined") {
            startPolling();
        } else {
            source = new EventSource(apiUrl(`/${city}/stops/${encodeURIComponent(stopId)}/stream`, query));
            source.addEventListener("initial", (event) => {
                try {
                    const stop = JSON.parse((event as MessageEvent).data) as StopTupleDetailed;
                    setState((prev) => ({ ...prev, stop }));
                } catch {}
            });
            source.addEventListener("message", (event) => {
                try {
                    const departures = JSON.parse((event as MessageEvent).data) as StopDepartureTuple[];
                    received = true;
                    setState((prev) => ({ ...prev, departures, error: undefined, live: true, updatedAt: Date.now() }));
                } catch {}
            });
            source.addEventListener("errorCode", (event) => {
                const code = String((event as MessageEvent).data ?? "").replace(/"/g, "");
                source?.close();
                source = undefined;
                setState((prev) => ({ ...prev, error: code || "ERROR" }));
            });
            source.onerror = () => {
                if (!received) startPolling();
            };
            // Some proxies buffer SSE; fall back if nothing arrives.
            fallbackTimer = setTimeout(() => {
                if (!received) startPolling();
            }, 8000);
        }

        return () => {
            closed = true;
            source?.close();
            clearTimeout(pollTimer);
            clearTimeout(fallbackTimer);
            controller?.abort();
        };
    }, [city, stopId, limit, before, routes, destinations, enabled]);

    return state;
};
