export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "https://api.zbiorkom.live/api6";

export class ApiError extends Error {
    constructor(
        public status: number,
        public code: string,
    ) {
        super(code);
    }
}

export const apiUrl = (path: string, query?: Record<string, string | number | boolean | undefined | null>) => {
    const url = new URL(API_BASE + path);
    if (query) {
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
        }
    }
    return url.toString();
};

export const apiGet = async <T>(
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
    signal?: AbortSignal,
): Promise<T> => {
    const response = await fetch(apiUrl(path, query), { signal });
    if (!response.ok) {
        let code = `HTTP_${response.status}`;
        try {
            const body = await response.json();
            if (body?.error) code = body.error;
        } catch {}
        throw new ApiError(response.status, code);
    }
    return response.json() as Promise<T>;
};

export const cityGet = <T>(
    city: string,
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
    signal?: AbortSignal,
) => apiGet<T>(`/${city}${path}`, query, signal);

export type StreamHandle = { close: () => void };

// Server-Sent Events stream; `onMessage` receives parsed JSON of every `data:` frame.
export const openStream = <T>(
    path: string,
    query: Record<string, string | number | boolean | undefined | null> | undefined,
    onMessage: (data: T, event: string) => void,
    onError?: (error: Event) => void,
): StreamHandle => {
    const source = new EventSource(apiUrl(path, query));
    const handler = (event: MessageEvent) => {
        try {
            onMessage(JSON.parse(event.data), event.type);
        } catch {}
    };
    source.onmessage = handler;
    const known = ["update", "init", "full", "diff", "positions", "remove"];
    for (const name of known) source.addEventListener(name, handler as EventListener);
    source.onerror = (error) => onError?.(error);
    return { close: () => source.close() };
};
