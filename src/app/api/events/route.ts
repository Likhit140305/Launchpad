import { Prisma } from "@prisma/client";
import { getCampaign, logEvent, normaliseChannel } from "@/lib/campaign";
import { db } from "@/lib/db";
import { body, json, rateLimit, route } from "@/lib/http";
import { publicEventSchema } from "@/lib/validation";

// Visitor-side beacons. Server-side events (registration_completed, workshop_attended,
// conversion_completed, reward_issued...) are written by the routes that cause them, never here.
const ONCE_PER_VISITOR = new Set(["page_view", "registration_started", "calendar_added"]);

export const POST = route(async (req) => {
  await rateLimit(req, "events", 120, 60);
  const e = await body(req, publicEventSchema, 4_000);
  const campaign = await getCampaign();
  const reg = e.code ? await db.registration.findFirst({ where: { campaignId: campaign.id, code: e.code }, select: { id: true } }) : null;
  const dedupeKey = ONCE_PER_VISITOR.has(e.type)
    ? `${e.type}:${e.visitorId}`
    : `${e.type}:${reg?.id ?? e.visitorId}:${String(e.meta?.target ?? "")}`;
  const recorded = await logEvent(campaign.id, e.type, {
    visitorId: e.visitorId,
    registrationId: reg?.id ?? null,
    channel: e.channel ? normaliseChannel(e.channel) : null,
    meta: (e.meta ?? undefined) as Prisma.InputJsonValue | undefined,
    dedupeKey,
  });
  return json({ ok: true, recorded }, recorded ? 201 : 200);
});
