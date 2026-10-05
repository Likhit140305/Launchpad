import { db } from "@/lib/db";
import { json, route } from "@/lib/http";

export const GET = route(async () => {
  const started = Date.now();
  await db.$queryRaw`SELECT 1`;
  return json({ ok: true, db: "up", latencyMs: Date.now() - started, time: new Date().toISOString() });
});
