import { useEffect, useRef, useState } from "react";

export type ApiState<T> = { data: T | undefined; error: Error | undefined; loading: boolean; reload: () => void };

// Fetch with abort on deps change; `refreshMs` polls in the background.
export const useApi = <T>(
    fetcher: ((signal: AbortSignal) => Promise<T>) | null,
    deps: unknown[],
    refreshMs?: number,
): ApiState<T> => {
    const [data, setData] = useState<T>();
    const [error, setError] = useState<Error>();
    const [loading, setLoading] = useState(!!fetcher);
    const [tick, setTick] = useState(0);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    useEffect(() => {
        setData(undefined);
        setError(undefined);
    }, deps);

    useEffect(() => {
        if (!fetcherRef.current) {
            setLoading(false);
            return;
        }
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const run = () => {
            setLoading(true);
            fetcherRef.current!(controller.signal)
                .then((result) => {
                    setData(result);
                    setError(undefined);
                })
                .catch((err) => {
                    if (controller.signal.aborted) return;
                    setError(err);
                })
                .finally(() => {
                    if (controller.signal.aborted) return;
                    setLoading(false);
                    if (refreshMs) timer = setTimeout(run, refreshMs);
                });
        };
        run();
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [...deps, tick, refreshMs]);

    return { data, error, loading, reload: () => setTick((value) => value + 1) };
};
