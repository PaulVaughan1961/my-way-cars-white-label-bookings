"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string
): Promise<T> {
  let timer: number | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(
          () => reject(new Error(timeoutMessage)),
          ms
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

async function accessToken() {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token || "";
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10000
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

async function ensureActiveServiceWorker() {
  let registration = await navigator.serviceWorker.getRegistration();

  if (!registration) {
    registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
  }

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current =
      (await navigator.serviceWorker.getRegistration()) || registration;

    if (current.active) return current;

    if (attempt === 5) {
      try {
        await current.update();
      } catch {
        // Keep waiting; the final timeout gives the useful error.
      }
    }

    await sleep(250);
  }

  throw new Error("SERVICE_WORKER_TIMEOUT");
}

export default function OperatorPushNotifications() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const publicKeyRef = useRef("");

  const [supported, setSupported] = useState(true);
  const [prepared, setPrepared] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      const available =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      setSupported(available);

      if (!available) {
        if (!cancelled) {
          setMessage("Push notifications are not supported on this device.");
        }
        return;
      }

      try {
        const token = await accessToken();
        if (!token) {
          throw new Error("Please sign in again before enabling alerts.");
        }

        const [registration, keyResponse] = await Promise.all([
          withTimeout(
            ensureActiveServiceWorker(),
            12000,
            "SERVICE_WORKER_TIMEOUT"
          ),
          fetchWithTimeout(
            "/api/operator-push",
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              cache: "no-store",
            },
            10000
          ),
        ]);

        const keyResult = (await keyResponse.json()) as {
          publicKey?: string;
          error?: string;
        };

        if (!keyResponse.ok || !keyResult.publicKey) {
          throw new Error(
            keyResult.error || "Push notifications are not configured."
          );
        }

        const subscription = await withTimeout(
          registration.pushManager.getSubscription(),
          5000,
          "SUBSCRIPTION_CHECK_TIMEOUT"
        );

        if (cancelled) return;

        registrationRef.current = registration;
        publicKeyRef.current = keyResult.publicKey;
        setEnabled(Boolean(subscription));
        setPrepared(true);

        if (Notification.permission === "denied") {
          setMessage(
            "Notifications are blocked in this browser. Use the bell/site permissions in the address bar to allow notifications."
          );
        }
      } catch (error) {
        if (cancelled) return;

        const text =
          error instanceof Error ? error.message : "Could not prepare alerts.";

        if (text === "SERVICE_WORKER_TIMEOUT") {
          setMessage(
            "The notification service did not become ready. Refresh the page once; if this remains, we will inspect the service worker."
          );
        } else if (text === "SUBSCRIPTION_CHECK_TIMEOUT") {
          setMessage(
            "The browser did not finish checking notification status. Refresh the page and try again."
          );
        } else if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          setMessage(
            "The notification setup server did not respond in time. Try again shortly."
          );
        } else {
          setMessage(text);
        }
      }
    }

    void prepare();

    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setMessage("");

    try {
      if (!supported) {
        throw new Error("Push notifications are not supported on this device.");
      }

      const registration = registrationRef.current;
      const publicKey = publicKeyRef.current;

      if (!prepared || !registration || !publicKey) {
        throw new Error(
          "Notification setup is still preparing. Wait a moment and try again."
        );
      }

      if (Notification.permission === "denied") {
        throw new Error("NOTIFICATIONS_BLOCKED");
      }

      let permission: NotificationPermission = Notification.permission;

      if (permission === "default") {
        setMessage(
          "Please allow notifications. In Edge, the request may appear only as a bell icon in the address bar."
        );

        permission = await withTimeout(
          Notification.requestPermission(),
          15000,
          "PERMISSION_WAITING"
        );
      }

      if (permission !== "granted") {
        throw new Error("NOTIFICATIONS_NOT_ALLOWED");
      }

      let subscription = await withTimeout(
        registration.pushManager.getSubscription(),
        5000,
        "SUBSCRIPTION_CHECK_TIMEOUT"
      );

      if (!subscription) {
        setMessage("Creating the push subscription...");

        subscription = await withTimeout(
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
              publicKey
            ) as BufferSource,
          }),
          15000,
          "SUBSCRIBE_TIMEOUT"
        );
      }

      const token = await accessToken();
      if (!token) {
        throw new Error("Please sign in again before enabling alerts.");
      }

      setMessage("Saving this device...");

      const saveResponse = await fetchWithTimeout(
        "/api/operator-push",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(subscription.toJSON()),
        },
        10000
      );

      const saveResult = (await saveResponse.json()) as {
        error?: string;
      };

      if (!saveResponse.ok) {
        throw new Error(
          saveResult.error || "Could not enable booking alerts."
        );
      }

      setEnabled(true);
      setMessage("Booking alerts enabled on this device.");

      try {
        await registration.showNotification("My Way Cars booking alerts", {
          body: "Booking alerts are enabled on this device.",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: "booking-alerts-enabled",
        });
      } catch {
        // The server subscription is still valid even if the confirmation
        // notification is suppressed by the operating system.
      }
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Could not enable booking alerts.";

      if (text === "PERMISSION_WAITING") {
        setMessage(
          "Edge is waiting for your choice. Click the bell icon in the address bar, choose Allow, then click Enable booking alerts again."
        );
      } else if (text === "NOTIFICATIONS_BLOCKED") {
        setMessage(
          "Notifications are blocked. Click the bell/site permissions in the address bar, allow notifications, then try again."
        );
      } else if (text === "NOTIFICATIONS_NOT_ALLOWED") {
        setMessage(
          "Notification permission was not granted. Allow notifications for this site and try again."
        );
      } else if (text === "SUBSCRIPTION_CHECK_TIMEOUT") {
        setMessage(
          "The browser did not finish checking the push subscription. Refresh the page and try again."
        );
      } else if (text === "SUBSCRIBE_TIMEOUT") {
        setMessage(
          "The browser did not finish creating the push subscription. Check notification permission and try again."
        );
      } else if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setMessage(
          "The notification server did not respond in time. Try again shortly."
        );
      } else {
        setMessage(text);
      }
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");

    try {
      const registration = registrationRef.current;
      const subscription =
        await registration?.pushManager.getSubscription();

      if (subscription) {
        const token = await accessToken();

        if (token) {
          await fetchWithTimeout(
            "/api/operator-push",
            {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                endpoint: subscription.endpoint,
              }),
            },
            10000
          );
        }

        await subscription.unsubscribe();
      }

      setEnabled(false);
      setMessage("Booking alerts disabled on this device.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not disable booking alerts."
      );
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy || !prepared}
        onClick={enabled ? disable : enable}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-50"
      >
        {busy
          ? "Working..."
          : !prepared
            ? "Preparing alerts..."
            : enabled
              ? "Booking alerts: ON"
              : "Enable booking alerts"}
      </button>

      {message ? (
        <span className="max-w-sm text-xs text-slate-600">
          {message}
        </span>
      ) : null}
    </div>
  );
}