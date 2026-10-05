import { getCampaign } from "@/lib/campaign";

function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Calendar invite with a 30-minute reminder: the cheapest show-up-rate lever there is. */
export async function GET() {
  const { cfg, id } = await getCampaign();
  const start = new Date(cfg.startsAt);
  const end = new Date(start.getTime() + 60 * 60_000);
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NxtWave//LaunchPad//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${id}@launchpad`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`NxtWave: ${cfg.workshopTitle}`)}`,
    `DESCRIPTION:${esc(`${cfg.workshopTagline}\nThe join link arrives on WhatsApp and email 1 hour before.`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Your AI workshop starts in 30 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="nxtwave-ai-workshop.ics"' },
  });
}
