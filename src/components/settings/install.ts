import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferred = event as InstallPromptEvent;
        listeners.forEach((listener) => listener());
    });
    window.addEventListener("appinstalled", () => {
        deferred = null;
        listeners.forEach((listener) => listener());
    });
}

export const isStandalone = () =>
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

export const useInstallPrompt = () => {
    const [, setTick] = useState(0);
    useEffect(() => {
        const listener = () => setTick((value) => value + 1);
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    const install = async () => {
        if (!deferred) return false;
        await deferred.prompt();
        const choice = await deferred.userChoice;
        deferred = null;
        listeners.forEach((listener) => listener());
        return choice.outcome === "accepted";
    };

    return { canPrompt: !!deferred, installed: isStandalone(), install };
};
