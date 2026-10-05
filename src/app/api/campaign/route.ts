import { Prisma } from "@prisma/client";
import { getCampaign } from "@/lib/campaign";
import { campaignConfigSchema } from "@/lib/config";
import { db } from "@/lib/db";
import { body, json, requireAdmin, route } from "@/lib/http";

export const GET = route(async (req) => {
  requireAdmin(req);
  const campaign = await getCampaign();
  return json({ config: campaign.cfg });
});

/** Live config editor. Validated in full; an invalid config is rejected, never half-saved. */
export const PUT = route(async (req) => {
  requireAdmin(req);
  const cfg = await body(req, campaignConfigSchema, 40_000);
  const campaign = await getCampaign();
  await db.$transaction([
    db.campaign.update({ where: { id: campaign.id }, data: { config: cfg as unknown as Prisma.InputJsonValue } }),
    db.workshop.updateMany({
      where: { campaignId: campaign.id, title: { not: "Batch 1 preview (demo data)" } },
      data: { startsAt: new Date(cfg.startsAt), title: cfg.workshopTitle },
    }),
  ]);
  return json({ ok: true, config: cfg });
});
