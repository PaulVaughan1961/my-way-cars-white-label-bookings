"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_BUSINESS_NAME,
  normaliseBusinessName,
} from "@/lib/businessBranding";

export function usePublicBusinessName(businessSlug = "") {
  const [businessName, setBusinessName] = useState(
    businessSlug ? "Your transport operator" : DEFAULT_BUSINESS_NAME
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const query = businessSlug
          ? `?business=${encodeURIComponent(businessSlug)}`
          : "";
        const response = await fetch(`/api/booking-requests${query}`, {
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
  }, [businessSlug]);

  return businessName;
}
