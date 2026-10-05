import { getCampaign } from "@/lib/campaign";
import { clearDemo, seedDemo } from "@/lib/demo";
import { body, json, requireAdmin, route } from "@/lib/http";
import { computeRewards, qualifyReferrals } from "@/lib/rewards";
import { demoActionSchema } from "@/lib/validation";

export const maxDuration = 60;

/** Load or remove simulated traffic. Real registrations are never touched. */
export const POST = route(async (req) => {
  requireAdmin(req);
  const { action } = await body(req, demoActionSchema);
  const campaign = await getCampaign();
  if (action === "clear") {
    await clearDemo(campaign.id);
    await qualifyReferrals(campaign);
    await computeRewards(campaign);
    return json({ ok: true, cleared: true });
  }
  const result = await seedDemo(campaign);
  return json({ ok: true, ...result }, 201);
});
