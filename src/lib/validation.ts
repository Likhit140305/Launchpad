import { z } from "zod";
import { visitorIdSchema } from "./http";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(60, "Name is too long")
    .regex(/^[\p{L}][\p{L} .'-]*$/u, "Use letters only"),
  email: z.string().trim().toLowerCase().max(120).pipe(z.email("Enter a valid email")),
  phone: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=[6-9]\d{9}$)/, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number")),
  college: z.string().trim().min(3, "Enter your college").max(100, "College name is too long"),
  gradYear: z.coerce.number().int("Pick your graduation year"),
  branch: z.string().trim().max(40).optional(),
  ref: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,12}$/).optional().or(z.literal("")),
  channel: z.string().trim().max(60).optional(),
  visitorId: visitorIdSchema.optional(),
  website: z.string().max(0, "Bot detected").optional(), // honeypot: humans never see this field
});

export const publicEventSchema = z.object({
  type: z.enum(["page_view", "registration_started", "whatsapp_shared", "link_copied", "calendar_added"]),
  visitorId: visitorIdSchema,
  channel: z.string().trim().max(60).optional(),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,12}$/).optional(),
  meta: z.record(z.string(), z.union([z.string().max(120), z.number()])).optional(),
});

export const experimentCreateSchema = z.object({
  name: z.string().trim().min(4).max(90),
  hypothesis: z.string().trim().max(240).optional(),
  minSamplePerArm: z.number().int().min(50).max(100_000),
  variants: z
    .array(
      z.object({
        headline: z.string().trim().min(8).max(110),
        subhead: z.string().trim().min(8).max(200),
        cta: z.string().trim().min(3).max(32),
        weight: z.number().int().min(1).max(100).default(50),
      }),
    )
    .min(2, "An experiment needs a control and at least one challenger")
    .max(4),
});

export const promoteSchema = z.object({ variantId: z.string().min(5).max(40) });

export const ambassadorSchema = z.object({
  name: z.string().trim().min(2).max(60),
  college: z.string().trim().min(3).max(100),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "10-digit mobile").optional().or(z.literal("")),
});

export const attendanceImportSchema = z.object({
  csv: z.string().min(5, "Paste the attendance CSV").max(2_000_000),
  workshopId: z.string().min(5).max(40).optional(),
});

export const rewardActionSchema = z.object({ action: z.enum(["issue", "reject", "reopen"]) });
export const referralActionSchema = z.object({ action: z.enum(["approve", "flag"]), reason: z.string().trim().max(120).optional() });
export const demoActionSchema = z.object({ action: z.enum(["seed", "clear"]) });
