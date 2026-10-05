import { experimentReport } from "@/lib/analytics";
import { getCampaign } from "@/lib/campaign";
import { db } from "@/lib/db";
import { body, json, requireAdmin, route } from "@/lib/http";
import { experimentCreateSchema } from "@/lib/validation";

export const GET = route(async (req) => {
  requireAdmin(req);
  return json({ experiments: await experimentReport(await getCampaign()) });
});

/** Start a new test. Only one runs at a time, so the previous one is stopped (its history is kept). */
export const POST = route(async (req) => {
  requireAdmin(req);
  const input = await body(req, experimentCreateSchema);
  const campaign = await getCampaign();
  const count = await db.experiment.count({ where: { campaignId: campaign.id } });
  const [, exp] = await db.$transaction([
    db.experiment.updateMany({ where: { campaignId: campaign.id, status: { in: ["running", "promoted"] } }, data: { status: "stopped" } }),
    db.experiment.create({
      data: {
        campaignId: campaign.id,
        key: `exp-${count + 1}-${Date.now().toString(36)}`,
        name: input.name,
        hypothesis: input.hypothesis || null,
        minSamplePerArm: input.minSamplePerArm,
        variants: {
          create: input.variants.map((v, i) => ({ ...v, key: String.fromCharCode(65 + i), isControl: i === 0 })),
        },
      },
      include: { variants: true },
    }),
  ]);
  return json({ ok: true, experiment: exp }, 201);
});
