import { Prisma } from "@prisma/client";
import { getCampaign } from "@/lib/campaign";
import { db } from "@/lib/db";
import { body, HttpError, json, requireAdmin, route } from "@/lib/http";
import { originOf } from "@/lib/kit";
import { ambassadorSchema } from "@/lib/validation";

/** Campus ambassadors get a tagged link; every sign-up through it is credited to them. */
export const POST = route(async (req) => {
  requireAdmin(req);
  const input = await body(req, ambassadorSchema);
  const campaign = await getCampaign();
  const slug = input.college.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14) || "campus";
  const base = `amb_${slug}`;
  for (let i = 0; i < 20; i++) {
    const tag = i === 0 ? base : `${base}${i + 1}`;
    try {
      const amb = await db.ambassador.create({ data: { campaignId: campaign.id, name: input.name, college: input.college, phone: input.phone || null, tag } });
      return json({ ok: true, ambassador: amb, link: `${originOf(req)}/?utm_source=${tag}` }, 201);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new HttpError(409, "Too many ambassadors share that college name. Use a more specific name.");
});
