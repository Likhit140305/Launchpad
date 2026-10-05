import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { defaultConfig, parseConfig, type CampaignConfig } from "./config";

export const CAMPAIGN_SLUG = process.env.CAMPAIGN_SLUG ?? "ai-workshop";

export const DEFAULT_VARIANTS = [
  {
    key: "A",
    isControl: true,
    headline: "Build your first AI project in 60 minutes.",
    subhead: "Free and live. You leave with a working AI app on a public link.",
    cta: "Save my free seat",
  },
  {
    key: "B",
    isControl: false,
    headline: "Walk into placements with a live AI project on your resume.",
    subhead: "One free hour with NxtWave. One working AI app, deployed and yours to show recruiters.",
    cta: "Get my AI project",
  },
];

/** Returns the campaign, creating it (with its first experiment and workshop) on first use. */
export async function getCampaign() {
  const existing = await db.campaign.findUnique({ where: { slug: CAMPAIGN_SLUG } });
  if (existing) return { ...existing, cfg: parseConfig(existing.config) };
  const config = defaultConfig();
  try {
    const created = await db.campaign.create({
      data: {
        slug: CAMPAIGN_SLUG,
        name: "AI Workshop: 500 final-year registrations",
        config: config as unknown as Prisma.InputJsonValue,
        experiments: {
          create: {
            key: "headline-v1",
            name: "Headline: skill outcome vs placement outcome",
            hypothesis: "Final-year students respond more to a placement outcome than to a skill outcome.",
            minSamplePerArm: 300,
            variants: { create: DEFAULT_VARIANTS.map((v) => ({ ...v, weight: 50 })) },
          },
        },
        workshops: { create: { title: config.workshopTitle, startsAt: new Date(config.startsAt), durationMin: 60 } },
      },
    });
    return { ...created, cfg: config };
  } catch (err) {
    // Two cold starts raced to create it: the other one won, so read theirs.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const row = await db.campaign.findUniqueOrThrow({ where: { slug: CAMPAIGN_SLUG } });
      return { ...row, cfg: parseConfig(row.config) };
    }
    throw err;
  }
}

export type Campaign = Awaited<ReturnType<typeof getCampaign>>;

export async function activeExperiment(campaignId: string) {
  return db.experiment.findFirst({
    where: { campaignId, status: { in: ["running", "promoted"] } },
    orderBy: { createdAt: "desc" },
    include: { variants: { orderBy: { key: "asc" } } },
  });
}

/**
 * Sticky assignment: a visitor keeps their variant forever. After promotion,
 * every new visitor gets the winner; earlier assignments are left untouched so
 * the experiment's history stays intact.
 */
export async function assignVariant(campaignId: string, visitorId: string) {
  const exp = await activeExperiment(campaignId);
  if (!exp || exp.variants.length === 0) return null;
  if (exp.status === "promoted" && exp.winnerVariantId) {
    return exp.variants.find((v) => v.id === exp.winnerVariantId) ?? exp.variants[0];
  }
  const prior = await db.experimentAssignment.findUnique({
    where: { experimentId_visitorId: { experimentId: exp.id, visitorId } },
    include: { variant: true },
  });
  if (prior) return prior.variant;
  const total = exp.variants.reduce((s, v) => s + Math.max(0, v.weight), 0) || exp.variants.length;
  let roll = randomInt(total);
  let pick = exp.variants[0];
  for (const v of exp.variants) {
    roll -= Math.max(0, v.weight) || 1;
    if (roll < 0) {
      pick = v;
      break;
    }
  }
  try {
    await db.experimentAssignment.create({ data: { experimentId: exp.id, variantId: pick.id, visitorId } });
    await logEvent(campaignId, "experiment_exposed", { visitorId, variantId: pick.id, dedupeKey: `exp:${exp.id}:${visitorId}` });
    return pick;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const again = await db.experimentAssignment.findUniqueOrThrow({
        where: { experimentId_visitorId: { experimentId: exp.id, visitorId } },
        include: { variant: true },
      });
      return again.variant;
    }
    throw err;
  }
}

export async function logEvent(
  campaignId: string,
  type: string,
  data: { visitorId?: string | null; registrationId?: string | null; variantId?: string | null; channel?: string | null; meta?: Prisma.InputJsonValue; dedupeKey?: string; isDemo?: boolean } = {},
) {
  try {
    await db.event.create({ data: { campaignId, type, ...data } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false; // deduplicated
    throw err;
  }
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L: codes get read aloud

export function makeCode(name: string): string {
  const prefix = (name.normalize("NFKD").replace(/[^A-Za-z]/g, "").toUpperCase() + "XXX").slice(0, 3);
  let tail = "";
  for (let i = 0; i < 4; i++) tail += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${prefix}${tail}`;
}

/** Channel tags come from utm_source; normalise so "WA_CBIT " and "wa_cbit" group together. */
export function normaliseChannel(raw?: string | null): string {
  const c = (raw ?? "").toLowerCase().trim().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return c || "direct";
}

export function channelFamily(channel: string): string {
  if (channel === "referral") return "Referral";
  if (channel.startsWith("wa")) return "WhatsApp groups";
  if (channel.startsWith("amb")) return "Campus ambassadors";
  if (channel.startsWith("club")) return "Tech clubs";
  if (channel.startsWith("email") || channel.startsWith("tpo")) return "Email / TPO";
  if (channel.startsWith("li") || channel.startsWith("linkedin")) return "LinkedIn";
  if (channel.startsWith("ig") || channel.startsWith("insta")) return "Instagram";
  if (channel === "direct") return "Direct";
  return "Other";
}

export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "Student";
  const last = parts.length > 1 ? ` ${parts[parts.length - 1][0]?.toUpperCase()}.` : "";
  return `${first}${last}`;
}

export function publicConfig(cfg: CampaignConfig) {
  const { budgetInr: _b, ...rest } = cfg;
  void _b;
  return rest;
}
