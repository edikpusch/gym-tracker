"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isNativeRuntime } from "@/lib/platform";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallKind = "installed" | "prompt" | "ios" | "unavailable" | "native";

interface PwaContextValue {
  installKind: InstallKind;
  isOnline: boolean;
  offlineReady: boolean;
  updateAvailable: boolean;
  install: () => Promise<boolean>;
  applyUpdate: () => void;
}

const PwaContext = createContext<PwaContextValue | null>(null);

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || iosNavigator.standalone === true;
}

function isIosBrowser() {
  const iosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const modernIpad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iosDevice || modernIpad;
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [installKind, setInstallKind] = useState<InstallKind>("unavailable");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const reloadRequestedRef = useRef(false);

  useEffect(() => {
    const nativeRuntime = isNativeRuntime() || process.env.NEXT_PUBLIC_BUILD_TARGET === "capacitor";
    const installed = !nativeRuntime && isStandalone();

    void Promise.resolve().then(() => {
      setIsOnline(navigator.onLine);
      setInstallKind(nativeRuntime ? "native" : installed ? "installed" : isIosBrowser() ? "ios" : "unavailable");
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleInstalled = () => {
      setInstallPrompt(null);
      setInstallKind("installed");
    };
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstallKind("prompt");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    if (
      process.env.NODE_ENV === "production" &&
      !nativeRuntime &&
      "serviceWorker" in navigator
    ) {
      let registration: ServiceWorkerRegistration | null = null;

      const watchInstallingWorker = (worker: ServiceWorker) => {
        worker.addEventListener("statechange", () => {
          if (worker.state !== "installed") return;
          if (navigator.serviceWorker.controller) {
            waitingWorkerRef.current = registration?.waiting ?? worker;
            setUpdateAvailable(true);
          } else {
            setOfflineReady(true);
          }
        });
      };

      const handleControllerChange = () => {
        setOfflineReady(true);
        setUpdateAvailable(false);
        if (reloadRequestedRef.current) window.location.reload();
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") void registration?.update();
      };

      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registered) => {
          registration = registered;
          setOfflineReady(Boolean(navigator.serviceWorker.controller || registered.active));

          if (registered.waiting) {
            waitingWorkerRef.current = registered.waiting;
            setUpdateAvailable(true);
          }

          if (registered.installing) watchInstallingWorker(registered.installing);
          registered.addEventListener("updatefound", () => {
            if (registered.installing) watchInstallingWorker(registered.installing);
          });
        })
        .catch((error) => {
          console.error("Service worker registration failed:", error);
        });

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("appinstalled", handleInstalled);
        window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === "accepted") setInstallKind("installed");
    else setInstallKind("unavailable");
    return choice.outcome === "accepted";
  }, [installPrompt]);

  const applyUpdate = useCallback(() => {
    const worker = waitingWorkerRef.current;
    if (!worker) return;
    reloadRequestedRef.current = true;
    worker.postMessage({ type: "SKIP_WAITING" });
  }, []);

  const value = useMemo(
    () => ({ installKind, isOnline, offlineReady, updateAvailable, install, applyUpdate }),
    [applyUpdate, install, installKind, isOnline, offlineReady, updateAvailable]
  );

  return (
    <PwaContext.Provider value={value}>
      {children}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            zIndex: 300,
            top: "calc(7px + var(--safe-area-top))",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "7px 12px",
            borderRadius: 999,
            background: "var(--c-surface-3)",
            border: "1px solid var(--c-border-strong)",
            boxShadow: "0 8px 24px rgba(0,0,0,.35)",
            color: "var(--c-text-2)",
            fontSize: 11,
            fontWeight: 750,
            whiteSpace: "nowrap",
          }}
        >
          Offline · Training bleibt gespeichert
        </div>
      )}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const value = useContext(PwaContext);
  if (!value) throw new Error("usePwa must be used inside PwaProvider");
  return value;
}
