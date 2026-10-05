import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { activeExperiment, getCampaign, makeCode, type Campaign } from "./campaign";
import { defaultConfig } from "./config";
import { computeRewards, qualifyReferrals } from "./rewards";

// Synthetic campaign traffic, every row flagged isDemo so it can be removed in one click
// and so every page can say plainly that the numbers are simulated.

const FIRST = ["Aarav", "Sai", "Harsha", "Sneha", "Keerthi", "Rohit", "Ananya", "Vamsi", "Divya", "Karthik", "Pranav", "Meghana", "Nikhil", "Sravani", "Abhinav", "Lakshmi", "Tejas", "Bhavana", "Rahul", "Pooja", "Charan", "Akhila", "Varun", "Swathi", "Manoj", "Ishita", "Arjun", "Nandini", "Kiran", "Deepika"];
const LAST = ["Reddy", "Rao", "Sharma", "Varma", "Naidu", "Gupta", "Kumar", "Patel", "Iyer", "Chowdary", "Goud", "Nair", "Joshi", "Prasad", "Shetty"];
const COLLEGES: [string, string, number][] = [
  ["CBIT, Hyderabad", "cbit", 16],
  ["VNR VJIET", "vnr", 14],
  ["GRIET", "griet", 12],
  ["MVSR Engineering College", "mvsr", 9],
  ["Vasavi College of Engineering", "vasavi", 9],
  ["CVR College of Engineering", "cvr", 8],
  ["KMIT", "kmit", 8],
  ["Sreenidhi Institute (SNIST)", "snist", 8],
  ["MGIT", "mgit", 7],
  ["JNTUH College of Engineering", "jntuh", 9],
];
const BRANCHES = ["CSE", "CSE (AI & ML)", "IT", "ECE", "EEE", "CSE (Data Science)", "Mechanical"];

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_WORKSHOP_TITLE = "Batch 1 preview (demo data)";

export async function clearDemo(campaignId: string) {
  await db.$transaction([
    db.event.deleteMany({ where: { campaignId, isDemo: true } }),
    db.reward.deleteMany({ where: { isDemo: true, registration: { campaignId } } }),
    db.attendance.deleteMany({ where: { isDemo: true, registration: { campaignId } } }),
    db.experimentAssignment.deleteMany({ where: { isDemo: true, experiment: { campaignId } } }),
    db.registration.deleteMany({ where: { campaignId, isDemo: true } }),
    db.ambassador.deleteMany({ where: { campaignId, isDemo: true } }),
    db.workshop.deleteMany({ where: { campaignId, title: DEMO_WORKSHOP_TITLE } }),
  ]);
}

export async function seedDemo(existing: Campaign) {
  await clearDemo(existing.id);
  const r = rng(20261005);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const now = Date.now();
  const DAY = 86_400_000;

  // Re-anchor the campaign so the demo sits on day 5 of 7.
  const start = new Date(now - 4.55 * DAY);
  const base = defaultConfig(start);
  const cfg = { ...existing.cfg, campaignStart: base.campaignStart, campaignEnd: base.campaignEnd, startsAt: base.startsAt };
  await db.campaign.update({ where: { id: existing.id }, data: { config: cfg as unknown as Prisma.InputJsonValue } });
  await db.workshop.updateMany({ where: { campaignId: existing.id, NOT: { title: DEMO_WORKSHOP_TITLE } }, data: { startsAt: new Date(cfg.startsAt) } });
  const campaign = await getCampaign();
  const cid = campaign.id;
  const exp = await activeExperiment(cid);
  const varA = exp?.variants.find((v) => v.isControl) ?? exp?.variants[0];
  const varB = exp?.variants.find((v) => !v.isControl) ?? exp?.variants[1];

  const ambassadors = COLLEGES.slice(0, 6).map(([college, slug]) => ({
    id: randomUUID(),
    campaignId: cid,
    name: `${pick(FIRST)} ${pick(LAST)}`,
    college,
    tag: `amb_${slug}`,
    isDemo: true,
  }));
  await db.ambassador.createMany({ data: ambassadors });

  const channelPlan: [string, number][] = [
    ["wa_cbit", 9], ["wa_vnr", 8], ["wa_griet", 7], ["wa_mvsr", 5], ["wa_vasavi", 5],
    ["amb_cbit", 5], ["amb_vnr", 4], ["amb_griet", 4], ["amb_mvsr", 3], ["amb_vasavi", 3], ["amb_cvr", 3],
    ["club_gdsc_vnr", 6], ["club_ieee_cbit", 4], ["email_tpo", 8], ["linkedin", 6], ["ig_story", 4], ["direct", 6],
  ];
  const weighted = channelPlan.flatMap(([c, w]) => Array(w).fill(c) as string[]);
  const channelRate: Record<string, number> = { wa: 0.15, amb: 0.2, club: 0.17, email: 0.1, linkedin: 0.07, ig: 0.06, direct: 0.09 };
  const rateFor = (c: string) => channelRate[Object.keys(channelRate).find((k) => c.startsWith(k)) ?? "direct"];

  type Reg = Prisma.RegistrationCreateManyInput & { id: string; createdAt: Date };
  const events: Prisma.EventCreateManyInput[] = [];
  const assignments: Prisma.ExperimentAssignmentCreateManyInput[] = [];
  const regs: Reg[] = [];
  const usedPhones = new Set<string>();
  const dailyVisitors = [330, 390, 440, 470, 400];

  const newPerson = (createdAt: Date, channel: string, visitorId: string, variantId: string | null, collegeHint?: string): Reg => {
    const [college, slug] = collegeHint ? COLLEGES.find((c) => c[1] === collegeHint)! : pick(COLLEGES.flatMap((c) => Array(c[2]).fill(c) as typeof COLLEGES));
    const first = pick(FIRST);
    const last = pick(LAST);
    let phone = "";
    do phone = `${pick(["9", "8", "7", "6"])}${String(Math.floor(r() * 1e9)).padStart(9, "0")}`;
    while (usedPhones.has(phone));
    usedPhones.add(phone);
    const roll = r();
    const amb = ambassadors.find((a) => a.tag === channel);
    return {
      id: randomUUID(),
      campaignId: cid,
      name: `${first} ${last}`,
      email: `${first}.${last}.${phone.slice(-4)}@example.com`.toLowerCase(),
      phone,
      college,
      gradYear: roll < 0.84 ? campaign.cfg.targetGradYear : roll < 0.95 ? campaign.cfg.targetGradYear + 1 : campaign.cfg.targetGradYear - 1,
      branch: pick(BRANCHES),
      code: makeCode(first),
      channel,
      visitorId,
      variantId,
      ipHash: `demo-${slug}-${Math.floor(r() * 400)}`,
      ambassadorId: amb?.id ?? null,
      isDemo: true,
      createdAt,
    };
  };

  for (let day = 0; day < dailyVisitors.length; day++) {
    const dayFraction = day === 4 ? 0.55 : 1;
    const n = Math.round(dailyVisitors[day] * dayFraction);
    for (let i = 0; i < n; i++) {
      const at = new Date(start.getTime() + (day + dayFraction * ((i + r()) / n)) * DAY);
      const vid = `demo${randomUUID().replace(/-/g, "").slice(0, 20)}`;
      const channel = pick(weighted);
      const isB = r() < 0.5;
      const variant = isB ? varB : varA;
      events.push({ campaignId: cid, type: "page_view", visitorId: vid, channel, variantId: variant?.id, dedupeKey: `pv:${vid}`, isDemo: true, createdAt: at });
      if (variant && exp) {
        assignments.push({ experimentId: exp.id, variantId: variant.id, visitorId: vid, isDemo: true, createdAt: at });
        events.push({ campaignId: cid, type: "experiment_exposed", visitorId: vid, variantId: variant.id, dedupeKey: `exp:${exp.id}:${vid}`, isDemo: true, createdAt: at });
      }
      const conv = rateFor(channel) * (isB ? 1.42 : 0.9);
      if (r() < conv * 1.9) {
        events.push({ campaignId: cid, type: "registration_started", visitorId: vid, channel, dedupeKey: `rs:${vid}`, isDemo: true, createdAt: new Date(at.getTime() + 40_000) });
        if (r() < 0.4) regs.push(newPerson(new Date(at.getTime() + 95_000), channel, vid, variant?.id ?? null, channel.startsWith("amb_") ? channel.slice(4) : undefined));
      }
    }
  }

  // Referral wave: a few students do most of the sharing (power law), friends join from their links.
  const referrals: Prisma.ReferralCreateManyInput[] = [];
  const sharers = regs.filter(() => r() < 0.32);
  const heavy = sharers.slice(0, 10);
  for (const s of sharers) {
    const isHeavy = heavy.includes(s);
    const friends = isHeavy ? 3 + Math.floor(r() * 7) : r() < 0.35 ? 1 + Math.floor(r() * 2) : 0;
    const shareAt = new Date(s.createdAt.getTime() + 120_000);
    events.push({ campaignId: cid, type: "whatsapp_shared", visitorId: s.visitorId, registrationId: s.id, channel: "referral", dedupeKey: `ws:${s.id}`, isDemo: true, createdAt: shareAt });
    for (let f = 0; f < friends; f++) {
      const at = new Date(Math.max(s.createdAt.getTime() + 60_000, Math.min(now - 120_000, s.createdAt.getTime() + (0.1 + r() * 1.6) * DAY)));
      const vid = `demo${randomUUID().replace(/-/g, "").slice(0, 20)}`;
      const variant = r() < 0.5 ? varB : varA;
      events.push({ campaignId: cid, type: "page_view", visitorId: vid, channel: "referral", dedupeKey: `pv:${vid}`, isDemo: true, createdAt: at });
      events.push({ campaignId: cid, type: "referral_clicked", visitorId: vid, registrationId: s.id, channel: "referral", isDemo: true, createdAt: at });
      if (variant && exp) assignments.push({ experimentId: exp.id, variantId: variant.id, visitorId: vid, isDemo: true, createdAt: at });
      const sameCollege = COLLEGES.find((c) => c[0] === s.college)?.[1];
      const friend = newPerson(new Date(at.getTime() + 80_000), "referral", vid, variant?.id ?? null, r() < 0.8 ? sameCollege : undefined);
      friend.referredById = s.id;
      regs.push(friend);
      const flagged = r() < 0.04;
      referrals.push({ id: randomUUID(), referrerId: s.id, referredId: friend.id, status: flagged ? "flagged" : "pending", flagReason: flagged ? "Same network as the referrer" : null, createdAt: friend.createdAt });
    }
  }

  // Order matters: referrers must exist before referred rows that point at them.
  regs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (let i = 0; i < regs.length; i += 500) await db.registration.createMany({ data: regs.slice(i, i + 500) });
  for (const reg of regs) {
    events.push({ campaignId: cid, type: "registration_completed", visitorId: reg.visitorId, registrationId: reg.id, variantId: reg.variantId, channel: reg.channel, dedupeKey: `rc:${reg.id}`, isDemo: true, createdAt: reg.createdAt });
  }
  if (referrals.length) await db.referral.createMany({ data: referrals });
  for (let i = 0; i < assignments.length; i += 1000) await db.experimentAssignment.createMany({ data: assignments.slice(i, i + 1000), skipDuplicates: true });
  for (let i = 0; i < events.length; i += 1000) await db.event.createMany({ data: events.slice(i, i + 1000), skipDuplicates: true });

  // Batch 1 ran last night: attendance imported from the meeting report.
  const batch = await db.workshop.create({ data: { campaignId: cid, title: DEMO_WORKSHOP_TITLE, startsAt: new Date(now - 0.6 * DAY), durationMin: 60 } });
  const early = regs.filter((x) => x.createdAt.getTime() < now - 0.8 * DAY);
  const attendance = early
    .filter(() => r() < 0.46)
    .map((x) => ({ workshopId: batch.id, registrationId: x.id, minutes: r() < 0.82 ? 35 + Math.floor(r() * 26) : 5 + Math.floor(r() * 20), source: "import", isDemo: true }));
  await db.attendance.createMany({ data: attendance });
  await db.event.createMany({
    data: attendance.map((a) => ({ campaignId: cid, type: "workshop_attended", registrationId: a.registrationId, meta: { minutes: a.minutes }, dedupeKey: `wa:${a.registrationId}`, isDemo: true, createdAt: new Date(now - 0.55 * DAY) })),
    skipDuplicates: true,
  });

  await qualifyReferrals(campaign);
  await computeRewards(campaign);
  return { registrations: regs.length, referrals: referrals.length, visitors: assignments.length, attended: attendance.length };
}
