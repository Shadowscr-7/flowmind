"use client";

/**
 * PageTracker
 * Fires a lightweight hit to /api/track on every navigation.
 * - Generates a session_id (persisted in sessionStorage for the tab lifetime)
 * - Reads UTM params from the URL on first landing (stored in sessionStorage so
 *   they survive soft navigations)
 * - Measures time-on-page and sends it when the user leaves
 */
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function getOrCreateSessionId(): string {
  try {
    const key = "fm_sid";
    let sid = sessionStorage.getItem(key);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(key, sid);
    }
    return sid;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

function getStoredUtm(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem("fm_utm");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function storeUtm(params: URLSearchParams) {
  try {
    const utm: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
      const val = params.get(key);
      if (val) utm[key] = val;
    }
    if (Object.keys(utm).length > 0) {
      // Only store on first landing (don't overwrite with later empty values)
      if (!sessionStorage.getItem("fm_utm")) {
        sessionStorage.setItem("fm_utm", JSON.stringify(utm));
      }
    }
  } catch {
    // sessionStorage unavailable (private mode edge case) — ignore
  }
}

async function sendHit(payload: object) {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // keepalive so the request survives page unload
      keepalive: true,
    });
  } catch {
    // Never throw — analytics must never break the UI
  }
}

export default function PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const enteredAtRef = useRef<number>(Date.now());

  useEffect(() => {
    // Capture UTM from URL on first load
    storeUtm(searchParams);

    const session_id = getOrCreateSessionId();
    const utm = getStoredUtm();
    const referrer = document.referrer || undefined;
    enteredAtRef.current = Date.now();

    // Record the page view
    sendHit({
      session_id,
      page: pathname,
      referrer,
      ...utm,
    });

    // Record time-on-page when user leaves or navigates away
    return () => {
      const duration_seconds = Math.round((Date.now() - enteredAtRef.current) / 1000);
      if (duration_seconds > 0) {
        sendHit({
          session_id,
          page: pathname,
          duration_seconds,
          ...utm,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
