// Removes the rows scripts/smoke.mjs creates (emails @smoke.test, "Smoke" ambassadors, smoke visitor ids).
// Usage: node --env-file=.env.local scripts/cleanup-smoke.mjs
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const regs = await db.registration.deleteMany({ where: { email: { endsWith: "@smoke.test" } } });
const ambs = await db.ambassador.deleteMany({ where: { name: "Smoke Amb" } });
const evs = await db.event.deleteMany({ where: { OR: [{ visitorId: { startsWith: "smoke" } }, { channel: "wa_smoke" }] } });
const asg = await db.experimentAssignment.deleteMany({ where: { visitorId: { startsWith: "smoke" } } });
const rl = await db.rateLimit.deleteMany({});
console.log({ registrations: regs.count, ambassadors: ambs.count, events: evs.count, assignments: asg.count, rateLimits: rl.count });
await db.$disconnect();
