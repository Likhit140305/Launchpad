import type { NextRequest } from "next/server";
import { getCampaign, logEvent } from "@/lib/campaign";
import { db } from "@/lib/db";
import { originOf } from "@/lib/kit";

/** Short share link: /r/SNE4KQ -> landing page with the referral attached. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params;
  const code = raw.toUpperCase();
  const origin = originOf(req);
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return Response.redirect(`${origin}/`, 302);
  try {
    const campaign = await getCampaign();
    const reg = await db.registration.findFirst({ where: { campaignId: campaign.id, code }, select: { id: true } });
    if (reg) await logEvent(campaign.id, "referral_clicked", { registrationId: reg.id, channel: "referral" });
  } catch (err) {
    console.error("[launchpad] referral click log failed", err); // never block the redirect on analytics
  }
  return Response.redirect(`${origin}/?ref=${code}&utm_source=referral`, 302);
}
