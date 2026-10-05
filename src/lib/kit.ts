import type { NextRequest } from "next/server";
import type { CampaignConfig } from "./config";

export function originOf(req: NextRequest): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

function gcalStamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function calendarLinks(origin: string, cfg: CampaignConfig) {
  const end = new Date(new Date(cfg.startsAt).getTime() + 60 * 60_000).toISOString();
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `NxtWave: ${cfg.workshopTitle}`,
    dates: `${gcalStamp(cfg.startsAt)}/${gcalStamp(end)}`,
    details: `${cfg.workshopTagline}\n\nJoin link arrives on WhatsApp and email 1 hour before.`,
  });
  return { google: `https://calendar.google.com/calendar/render?${params}`, ics: `${origin}/workshop.ics` };
}

export function referralKit(origin: string, cfg: CampaignConfig, code: string) {
  const shareUrl = `${origin}/r/${code}`;
  const text = `${cfg.whatsappShareText} ${shareUrl}`;
  return {
    code,
    shareUrl,
    trackerUrl: `${origin}/me/${code}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(cfg.whatsappShareText)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    ...calendarLinks(origin, cfg),
  };
}
