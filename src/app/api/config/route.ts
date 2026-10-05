import { assignVariant, getCampaign, publicConfig } from "@/lib/campaign";
import { db } from "@/lib/db";
import { json, rateLimit, route, visitorIdSchema } from "@/lib/http";
import { calendarLinks, originOf } from "@/lib/kit";

/** Public landing config plus this visitor's sticky A/B variant. */
export const GET = route(async (req) => {
  await rateLimit(req, "config", 120, 60);
  const campaign = await getCampaign();
  const vid = visitorIdSchema.safeParse(req.nextUrl.searchParams.get("vid"));
  const [variant, total, demo] = await Promise.all([
    vid.success ? assignVariant(campaign.id, vid.data) : Promise.resolve(null),
    db.registration.count({ where: { campaignId: campaign.id } }),
    db.registration.count({ where: { campaignId: campaign.id, isDemo: true } }),
  ]);
  return json({
    config: publicConfig(campaign.cfg),
    variant: variant && { id: variant.id, key: variant.key, headline: variant.headline, subhead: variant.subhead, cta: variant.cta },
    registrations: total >= campaign.cfg.showCounterAfter ? total : null,
    demo: demo > 0,
    calendar: calendarLinks(originOf(req), campaign.cfg),
  });
});
