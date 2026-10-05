"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarPlus, Check, Copy, Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { firstTouch, track, visitorId } from "@/lib/client";

export type Kit = {
  name: string;
  again: boolean;
  code: string;
  shareUrl: string;
  trackerUrl: string;
  whatsapp: string;
  telegram: string;
  linkedin: string;
  google: string;
  ics: string;
};

type Fields = Record<string, string>;

const FIELD = "w-full rounded-[10px] border border-navy-200 bg-white px-3.5 py-3 text-[0.97rem] text-ink placeholder:text-navy-600/70 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/25 aria-[invalid=true]:border-rose-600";

export function RegisterForm({ cta, gradYears, targetYear }: { cta: string; gradYears: number[]; targetYear: number }) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Fields>({});
  const [message, setMessage] = useState<string | null>(null);
  const [kit, setKit] = useState<Kit | null>(null);
  const started = useRef(false);
  const touch = useRef<{ ref?: string; channel?: string }>({});

  useEffect(() => {
    touch.current = firstTouch();
  }, []);

  const onStart = () => {
    if (started.current) return;
    started.current = true;
    track("registration_started", { channel: touch.current.channel });
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Fields;
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, ref: touch.current.ref ?? "", channel: touch.current.channel, visitorId: visitorId() }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setKit(json as Kit);
        try {
          localStorage.setItem("lp_code", json.code);
        } catch {}
      } else {
        setErrors(json.fields ?? {});
        setMessage(res.status === 429 ? json.error : json.fields ? (json.error ?? null) : (json.error ?? "Could not register. Please try again."));
      }
    } catch {
      setMessage("You seem to be offline. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {kit ? (
        <ShareKit key="kit" kit={kit} />
      ) : (
        <motion.form
          key="form"
          onSubmit={submit}
          onFocus={onStart}
          noValidate
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="space-y-3"
        >
          <Field id="name" label="Full name" error={errors.name}>
            <input id="name" name="name" autoComplete="name" required maxLength={60} placeholder="Sneha Reddy" className={FIELD} aria-invalid={!!errors.name} aria-describedby="name-err" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="phone" label="WhatsApp number" error={errors.phone}>
              <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required placeholder="98765 43210" className={FIELD} aria-invalid={!!errors.phone} aria-describedby="phone-err" />
            </Field>
            <Field id="email" label="Email" error={errors.email}>
              <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@college.edu" className={FIELD} aria-invalid={!!errors.email} aria-describedby="email-err" />
            </Field>
          </div>
          <Field id="college" label="College" error={errors.college}>
            <input id="college" name="college" autoComplete="organization" required maxLength={100} placeholder="CBIT, Hyderabad" className={FIELD} aria-invalid={!!errors.college} aria-describedby="college-err" />
          </Field>
          <div className="grid grid-cols-[1fr_1.2fr] gap-3">
            <Field id="gradYear" label="Graduating in" error={errors.gradYear}>
              <select id="gradYear" name="gradYear" defaultValue={targetYear} className={FIELD} aria-invalid={!!errors.gradYear} aria-describedby="gradYear-err">
                {gradYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                    {y === targetYear ? " (final year)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="branch" label="Branch" optional error={errors.branch}>
              <input id="branch" name="branch" maxLength={40} placeholder="CSE, ECE, IT..." className={FIELD} />
            </Field>
          </div>
          {/* Honeypot: hidden from people and screen readers, filled only by bots. */}
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          {message && (
            <p role="alert" className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-medium text-rose-600">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="group flex w-full items-center justify-center gap-2 rounded-[10px] bg-marigold-400 px-5 py-3.5 font-display text-lg font-bold text-navy-950 shadow-[0_6px_18px_-6px_rgba(245,180,0,0.65)] transition-[background-color,transform] duration-200 hover:bg-marigold-500 active:translate-y-px disabled:cursor-wait disabled:opacity-80"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
            {busy ? "Saving your seat..." : cta}
            {!busy && <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />}
          </button>
          <p className="text-center text-xs text-ink-soft">Free. We only use your number for workshop reminders on WhatsApp.</p>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

function Field({ id, label, error, optional, children }: { id: string; label: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">
        {label} {optional && <span className="font-normal text-ink-soft">(optional)</span>}
      </label>
      {children}
      <p id={`${id}-err`} className="mt-1 min-h-0 text-xs font-medium text-rose-600">
        {error}
      </p>
    </div>
  );
}

export function ShareKit({ kit }: { kit: Kit }) {
  const [copied, setCopied] = useState(false);
  const share = (target: string) => track(target === "copy" ? "link_copied" : "whatsapp_shared", { code: kit.code, channel: "referral", meta: { target } });

  async function copy() {
    try {
      await navigator.clipboard.writeText(kit.shareUrl);
      setCopied(true);
      share("copy");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy your link", kit.shareUrl);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint-100 text-mint-600">
          <Check className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-2xl font-bold leading-tight text-ink">{kit.again ? `You're already in, ${kit.name.split(" ")[0]}.` : `Seat saved, ${kit.name.split(" ")[0]}.`}</h2>
          <p className="mt-1 text-sm text-ink-soft">The join link reaches your WhatsApp one hour before we start. Now bring your friends.</p>
        </div>
      </div>

      <div className="rounded-[10px] border border-navy-200 bg-navy-50 p-3">
        <p className="text-xs font-semibold text-ink-soft">Your invite link</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-sans text-[0.95rem] font-semibold text-blue-700">{kit.shareUrl.replace(/^https?:\/\//, "")}</code>
          <button onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:border-blue-600">
            {copied ? <Check className="h-4 w-4 text-mint-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <a
        href={kit.whatsapp}
        target="_blank"
        rel="noopener"
        onClick={() => share("whatsapp")}
        className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#1fa855] px-5 py-3.5 font-display text-lg font-bold text-white transition-colors hover:bg-[#178a45]"
      >
        <Send className="h-5 w-5" aria-hidden /> Share on WhatsApp
      </a>
      <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
        <a href={kit.telegram} target="_blank" rel="noopener" onClick={() => share("telegram")} className="rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-center text-ink hover:border-blue-600">
          Telegram
        </a>
        <a href={kit.linkedin} target="_blank" rel="noopener" onClick={() => share("linkedin")} className="rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-center text-ink hover:border-blue-600">
          LinkedIn
        </a>
        <a href={kit.google} target="_blank" rel="noopener" onClick={() => track("calendar_added", { code: kit.code })} className="flex items-center justify-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-ink hover:border-blue-600">
          <CalendarPlus className="h-4 w-4" aria-hidden /> Google Calendar
        </a>
        <a href={kit.ics} onClick={() => track("calendar_added", { code: kit.code })} className="flex items-center justify-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-ink hover:border-blue-600">
          <CalendarPlus className="h-4 w-4" aria-hidden /> Apple / Outlook
        </a>
      </div>
      <a href={`/me/${kit.code}`} className="flex items-center justify-center gap-1.5 text-sm font-bold text-blue-700 underline decoration-blue-600/40 hover:decoration-blue-600">
        Track who joins with your link <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
    </motion.div>
  );
}
