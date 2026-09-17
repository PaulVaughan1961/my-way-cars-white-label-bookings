"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_BUSINESS_NAME,
  normaliseBusinessName,
} from "@/lib/businessBranding";

export function usePublicBusinessName() {
  const [businessName, setBusinessName] = useState(DEFAULT_BUSINESS_NAME);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/booking-requests", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const result = (await response.json()) as { displayName?: unknown };
        if (active) setBusinessName(normaliseBusinessName(result.displayName));
      } catch {
        // Keep the safe production fallback when branding cannot be loaded.
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return businessName;
}
