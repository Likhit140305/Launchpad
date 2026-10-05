import type { NextRequest } from "next/server";
import { experimentReport } from "@/lib/analytics";
import { getCampaign, logEvent } from "@/lib/campaign";
import { db } from "@/lib/db";
import { body, HttpError, json, requireAdmin, route } from "@/lib/http";
import { promoteSchema } from "@/lib/validation";

/**
 * "Send 100% here". Refused unless the test has reached its pre-set sample on
 * every arm and the variant beat the control at p < 0.05. Promoting the control
 * is allowed once the test is ready (a challenger lost or tied: keep the control).
 */
export const POST = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  requireAdmin(req);
  const { id } = await ctx.params;
  const { variantId } = await body(req, promoteSchema);
  const campaign = await getCampaign();
  const report = (await experimentReport(campaign)).find((e) => e.id === id);
  if (!report) throw new HttpError(404, "Experiment not found.");
  if (report.status !== "running") throw new HttpError(409, `This experiment is already ${report.status}.`);
  const arm = report.arms.find((a) => a.id === variantId);
  if (!arm) throw new HttpError(400, "That variant is not part of this experiment.");
  const tests = report.challengers.map((c) => c.test);
  if (!tests.every((t) => t.ready)) {
    throw new HttpError(409, `Not enough data yet. Every arm needs ${report.minSamplePerArm} visitors before a winner can be picked.`);
  }
  if (!arm.isControl) {
    const t = report.challengers.find((c) => c.id === variantId)?.test;
    if (!t?.significant || t.winner !== "B") throw new HttpError(409, "This variant has not beaten the control with statistical significance.");
  }
  await db.experiment.update({ where: { id }, data: { status: "promoted", winnerVariantId: variantId, promotedAt: new Date() } });
  await logEvent(campaign.id, "experiment_promoted", { variantId, meta: { experimentId: id }, dedupeKey: `promote:${id}` });
  return json({ ok: true, experimentId: id, winnerVariantId: variantId });
});
