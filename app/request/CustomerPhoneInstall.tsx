"use client";

import { useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function CustomerPhoneInstall() {
  const query = useSearchParams();
  const business = query.get("business")?.trim();
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isApple, setIsApple] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installationRequested, setInstallationRequested] = useState(false);
  const instructionsId = useId();

  useEffect(() => {
    if (business !== "my-way-cars") return;
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const appleNavigator = navigator as Navigator & { standalone?: boolean };
    const updateInstalled = () => {
      setInstalled(displayMode.matches || appleNavigator.standalone === true);
    };
    updateInstalled();
    setIsApple(
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
    setReady(true);

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const appInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", appInstalled);
    displayMode.addEventListener("change", updateInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", appInstalled);
      displayMode.removeEventListener("change", updateInstalled);
    };
  }, [business]);

  async function addToPhone() {
    if (!installPrompt) {
      setShowInstructions(true);
      return;
    }
    const prompt = installPrompt;
    setInstallPrompt(null);
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstallationRequested(true);
      else setShowInstructions(true);
    } catch {
      setShowInstructions(true);
    } finally {
      setBusy(false);
    }
  }

  if (!ready || installed || business !== "my-way-cars") return null;

  return (
    <aside aria-label="Save My Way Cars to your phone" className="mx-auto max-w-lg px-4 pt-5">
      <div className="rounded-xl border border-purple-200 bg-white p-4">
        {installationRequested ? (
          <p role="status" className="text-base text-gray-700">
            Installation requested. Follow any remaining instructions on your phone.
          </p>
        ) : (
          <button
            type="button"
            onClick={addToPhone}
            disabled={busy}
            aria-expanded={showInstructions}
            aria-controls={instructionsId}
            className="w-full rounded-xl bg-[#6d2663] px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Opening install prompt…" : "Add My Way Cars to your phone"}
          </button>
        )}
        <div id={instructionsId} role="status" aria-live="polite">
          {showInstructions && (
            <p className="mt-3 text-base text-gray-700">
              {isApple
                ? "Open this page in Safari. Tap Share, then Add to Home Screen, then Add. Your My Way Cars icon will open this booking form."
                : "Open this page in your phone’s browser. Open the browser menu, choose Install app or Add to Home screen, then confirm. Your My Way Cars icon will open this booking form."}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
