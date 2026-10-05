"use client";

// Browser helpers shared by the landing page and the tracker.

export function visitorId(): string {
  const make = () => (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  try {
    const existing = localStorage.getItem("lp_vid");
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
    const id = make();
    localStorage.setItem("lp_vid", id);
    return id;
  } catch {
    // Private mode / blocked storage: a per-tab id still gives a consistent session.
    const w = window as unknown as { __lpVid?: string };
    w.__lpVid ??= make();
    return w.__lpVid;
  }
}

export function track(type: string, extra: Record<string, unknown> = {}) {
  try {
    const payload = JSON.stringify({ type, visitorId: visitorId(), ...extra });
    fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
  } catch {
    /* analytics never breaks the page */
  }
}

export function firstTouch(): { ref?: string; channel?: string } {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref")?.toUpperCase() ?? undefined;
  const utm = params.get("utm_source") ?? undefined;
  try {
    const saved = JSON.parse(localStorage.getItem("lp_touch") ?? "null") as { ref?: string; channel?: string } | null;
    if (saved && (saved.ref || saved.channel)) return { ref: saved.ref ?? ref, channel: saved.channel ?? utm };
    if (ref || utm) localStorage.setItem("lp_touch", JSON.stringify({ ref, channel: utm }));
  } catch {
    /* storage blocked */
  }
  return { ref, channel: utm };
}

export function istLabel(iso: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...opts });
}
