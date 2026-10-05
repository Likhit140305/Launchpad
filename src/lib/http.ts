import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { db } from "./db";

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Every route goes through this: typed errors in, consistent JSON out, nothing leaks. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status);
      if (err instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of err.issues) {
          const key = issue.path.join(".") || "_";
          fields[key] ??= issue.message;
        }
        return json({ error: "Please fix the highlighted fields.", fields }, 400);
      }
      console.error("[launchpad] unhandled", err);
      return json({ error: "Something went wrong on our side. Please try again." }, 500);
    }
  };
}

/** Parse a JSON body against a schema. Rejects non-JSON, oversized and malformed bodies. */
export async function body<T extends z.ZodType>(req: NextRequest, schema: T, maxBytes = 16_000): Promise<z.infer<T>> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new HttpError(415, "Send the request as JSON.");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request body is too large.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body is not valid JSON.");
  }
  return schema.parse(data);
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

/** Raw IPs are never stored: only a salted hash, used for rate limits and fraud flags. */
export function ipHash(req: NextRequest): string {
  const salt = process.env.IP_SALT ?? process.env.ADMIN_KEY ?? "launchpad";
  return createHash("sha256").update(`${salt}:${clientIp(req)}`).digest("hex").slice(0, 24);
}

/**
 * Fixed-window limiter stored in Postgres, so it holds across stateless
 * serverless instances. One upsert per request.
 */
export async function rateLimit(req: NextRequest, bucket: string, limit: number, windowSec: number) {
  const window = Math.floor(Date.now() / (windowSec * 1000));
  const key = `${bucket}:${ipHash(req)}:${window}`;
  const expiresAt = new Date((window + 1) * windowSec * 1000);
  const row = await db.rateLimit.upsert({
    where: { key },
    create: { key, count: 1, expiresAt },
    update: { count: { increment: 1 } },
  });
  if (row.count > limit) {
    const retry = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
    throw new HttpError(429, "Too many requests. Please wait a moment and try again.", { retryAfter: retry });
  }
  // Opportunistic cleanup; never blocks the request path on failure.
  if (Math.random() < 0.02) db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
}

export const DEFAULT_ADMIN_KEY = "nxtwave-admin";

export function adminKeyIsDefault() {
  return !process.env.ADMIN_KEY;
}

export function requireAdmin(req: NextRequest) {
  const expected = Buffer.from(process.env.ADMIN_KEY ?? DEFAULT_ADMIN_KEY);
  const given = Buffer.from(req.headers.get("x-admin-key") ?? "");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(401, "Admin key is missing or wrong.");
  }
}

export const visitorIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/, "Invalid visitor id");
