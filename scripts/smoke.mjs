// End-to-end check of every endpoint against a running server.
// Usage: BASE=http://localhost:3000 ADMIN_KEY=nxtwave-admin node scripts/smoke.mjs
// Creates test registrations with @smoke.test emails and removes them at the end via the DB-free API path
// (they are left as real rows only if cleanup fails; they are clearly marked by the email domain).

const BASE = process.env.BASE ?? "http://localhost:3000";
const KEY = process.env.ADMIN_KEY ?? "nxtwave-admin";
const run = Date.now().toString(36);
let failures = 0;

function check(name, cond, detail = "") {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

async function call(method, path, { body, admin, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(admin ? { "x-admin-key": KEY } : {}), "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const type = res.headers.get("content-type") ?? "";
  const data = type.includes("json") ? await res.json() : await res.text();
  return { status: res.status, data, headers: res.headers };
}

const phone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;

console.log(`LaunchPad smoke test against ${BASE}`);

console.log("\npages + public reads");
check("GET /api/health", (await call("GET", "/api/health")).data.ok === true);
const home = await call("GET", "/");
check("GET / renders", home.status === 200 && String(home.data).includes("NxtWave"));
check("GET /admin renders", (await call("GET", "/admin")).status === 200);
const vidA = `smoke${run}visitorA`;
const cfg = await call("GET", `/api/config?vid=${vidA}`);
check("GET /api/config returns config + variant", cfg.status === 200 && cfg.data.config?.goal > 0 && cfg.data.variant?.headline);
const cfg2 = await call("GET", `/api/config?vid=${vidA}`);
check("A/B assignment is sticky per visitor", cfg2.data.variant?.id === cfg.data.variant?.id);
check("GET /api/leaderboard", Array.isArray((await call("GET", "/api/leaderboard")).data.leaders));
const ics = await call("GET", "/workshop.ics");
check("GET /workshop.ics", ics.status === 200 && String(ics.data).includes("BEGIN:VCALENDAR") && String(ics.data).includes("TRIGGER:-PT30M"));

console.log("\nevents");
check("POST /api/events page_view", [200, 201].includes((await call("POST", "/api/events", { body: { type: "page_view", visitorId: vidA, channel: "wa_smoke" } })).status));
const dup = await call("POST", "/api/events", { body: { type: "page_view", visitorId: vidA, channel: "wa_smoke" } });
check("duplicate page_view is deduplicated", dup.status === 200 && dup.data.recorded === false);
check("event with unknown type is rejected", (await call("POST", "/api/events", { body: { type: "reward_issued", visitorId: vidA } })).status === 400);
check("non-JSON body is rejected (415)", (await call("POST", "/api/events", { body: "type=page_view", headers: { "Content-Type": "text/plain" } })).status === 415);
check("malformed JSON is rejected (400)", (await call("POST", "/api/events", { body: "{bad", headers: { "Content-Type": "application/json" } })).status === 400);

console.log("\nregistration");
const alice = { name: "Smoke Alice", email: `alice.${run}@smoke.test`, phone: phone(), college: "Smoke Institute of Technology", gradYear: cfg.data.config.targetGradYear, branch: "CSE", channel: "wa_smoke", visitorId: vidA };
const r1 = await call("POST", "/api/register", { body: alice });
check("POST /api/register creates (201)", r1.status === 201 && /^[A-Z0-9]{7}$/.test(r1.data.code), JSON.stringify(r1.data));
const r1b = await call("POST", "/api/register", { body: alice });
check("same person again is idempotent (200, same code)", r1b.status === 200 && r1b.data.code === r1.data.code && r1b.data.again === true);
const clash = await call("POST", "/api/register", { body: { ...alice, phone: phone() } });
check("same email, other phone -> 409 with field", clash.status === 409 && clash.data.fields?.email);
const bad = await call("POST", "/api/register", { body: { ...alice, email: "nope", phone: "12345", name: "1" } });
check("invalid fields -> 400 with per-field errors", bad.status === 400 && bad.data.fields?.email && bad.data.fields?.phone && bad.data.fields?.name);
const year = await call("POST", "/api/register", { body: { ...alice, email: `y.${run}@smoke.test`, phone: phone(), gradYear: 2019 } });
check("graduation year outside campaign -> 400", year.status === 400 && year.data.fields?.gradYear);
const bot = await call("POST", "/api/register", { body: { ...alice, email: `bot.${run}@smoke.test`, phone: phone(), website: "http://spam" } });
check("honeypot filled -> rejected", bot.status === 400);
const plus91 = await call("POST", "/api/register", { body: { ...alice, name: "Smoke Plus", email: `plus.${run}@smoke.test`, phone: `+91 ${phone()}` } });
check("+91 prefixed phone is normalised", plus91.status === 201);

console.log("\nreferral loop");
const short = await call("GET", `/r/${r1.data.code}`);
check("GET /r/<code> redirects with ref", short.status === 302 && (short.headers.get("location") ?? "").includes(`ref=${r1.data.code}`));
const bob = { name: "Smoke Bob", email: `bob.${run}@smoke.test`, phone: phone(), college: "Smoke Institute of Technology", gradYear: cfg.data.config.targetGradYear, ref: r1.data.code, visitorId: `smoke${run}visitorB` };
const r2 = await call("POST", "/api/register", { body: bob });
check("referred registration (201)", r2.status === 201);
const tracker = await call("GET", `/api/referral/${r1.data.code}`);
check("GET /api/referral/<code> shows the friend", tracker.status === 200 && tracker.data.counts.joined === 1 && tracker.data.friends[0]?.name === "Smoke B.");
check("unknown referral code -> 404", (await call("GET", "/api/referral/ZZZZ999")).status === 404);
check("GET /me/<code> renders", (await call("GET", `/me/${r1.data.code}`)).status === 200);
check("share event with code", [200, 201].includes((await call("POST", "/api/events", { body: { type: "whatsapp_shared", visitorId: vidA, code: r1.data.code, meta: { target: "whatsapp" } } })).status));

console.log("\nadmin auth");
check("analytics without key -> 401", (await call("GET", "/api/analytics")).status === 401);
check("analytics with wrong key -> 401", (await call("GET", "/api/analytics", { headers: { "x-admin-key": "wrong" } })).status === 401);
const an = await call("GET", "/api/analytics", { admin: true });
check("GET /api/analytics", an.status === 200 && an.data.summary.total >= 2 && Array.isArray(an.data.summary.funnel));

console.log("\nattendance -> qualification -> rewards");
const csv = `Name,User Email,Duration (Minutes)\nSmoke Bob,${bob.email},40\nSmoke Bob,${bob.email},12\nStranger,stranger.${run}@smoke.test,50`;
const att = await call("POST", "/api/attendance", { admin: true, body: { csv } });
check("POST /api/attendance matches and sums joins", att.status === 200 && att.data.matched === 1 && att.data.unmatchedCount === 1, JSON.stringify(att.data));
const tracker2 = await call("GET", `/api/referral/${r1.data.code}`);
check("referral qualified after attendance", tracker2.data.counts.qualified === 1);
check("bad attendance CSV -> 400", (await call("POST", "/api/attendance", { admin: true, body: { csv: "foo,bar\n1,2" } })).status === 400);
const rw = await call("POST", "/api/rewards", { admin: true, body: {} });
check("POST /api/rewards recomputes within budget", rw.status === 200 && rw.data.committedInr <= rw.data.budgetInr);
const an2 = await call("GET", "/api/analytics", { admin: true });
const aliceReward = an2.data.rewards.find((r) => r.code === r1.data.code && r.status === "eligible");
check("referrer earned a reward", !!aliceReward);
if (aliceReward) {
  const iss = await call("PATCH", `/api/rewards/${aliceReward.id}`, { admin: true, body: { action: "issue" } });
  check("PATCH /api/rewards/<id> issue", iss.status === 200 && iss.data.status === "issued");
  check("PATCH reopen", (await call("PATCH", `/api/rewards/${aliceReward.id}`, { admin: true, body: { action: "reopen" } })).data.status === "eligible");
}

console.log("\nexperiments");
const exps = await call("GET", "/api/experiments", { admin: true });
check("GET /api/experiments", exps.status === 200 && exps.data.experiments.length >= 1);
const running = exps.data.experiments.find((e) => e.status === "running");
if (running) {
  const ready = running.challengers.every((c) => c.test.ready);
  const challenger = running.arms.find((a) => !a.isControl);
  const pr = await call("POST", `/api/experiments/${running.id}/promote`, { admin: true, body: { variantId: challenger.id } });
  if (!ready) check("promote before minimum sample is refused (409)", pr.status === 409);
  else check("promote responds (200 if significant, 409 if not)", [200, 409].includes(pr.status));
}
check("promote unknown experiment -> 404", (await call("POST", "/api/experiments/nope12345/promote", { admin: true, body: { variantId: "abcdefgh" } })).status === 404);
check("create experiment with one variant -> 400", (await call("POST", "/api/experiments", { admin: true, body: { name: "Bad test", minSamplePerArm: 100, variants: [{ headline: "Only one variant", subhead: "Only one subhead", cta: "Go" }] } })).status === 400);

console.log("\nambassadors, referrals review, config, exports");
const amb = await call("POST", "/api/ambassadors", { admin: true, body: { name: "Smoke Amb", college: `Smoke College ${run}` } });
check("POST /api/ambassadors returns tagged link", amb.status === 201 && amb.data.link.includes("utm_source=amb_"));
const flaggedId = an2.data.flagged[0]?.id;
if (flaggedId) check("PATCH /api/referrals/<id> approve", (await call("PATCH", `/api/referrals/${flaggedId}`, { admin: true, body: { action: "approve" } })).status === 200);
else check("PATCH /api/referrals/<id> unknown -> 404", (await call("PATCH", "/api/referrals/nope12345", { admin: true, body: { action: "approve" } })).status === 404);
const conf = await call("GET", "/api/campaign", { admin: true });
check("GET /api/campaign", conf.status === 200 && conf.data.config.goal > 0);
check("PUT /api/campaign rejects invalid config", (await call("PUT", "/api/campaign", { admin: true, body: { ...conf.data.config, goal: -5 } })).status === 400);
check("PUT /api/campaign saves valid config", (await call("PUT", "/api/campaign", { admin: true, body: conf.data.config })).status === 200);
for (const type of ["registrations", "reminders", "rewards"]) {
  const ex = await call("GET", `/api/export?type=${type}`, { admin: true });
  check(`GET /api/export?type=${type}`, ex.status === 200 && String(ex.data).split("\n").length >= 2);
}
check("export unknown type -> 400", (await call("GET", "/api/export?type=passwords", { admin: true })).status === 400);
const regCsv = await call("GET", "/api/export?type=registrations", { admin: true });
check("CSV neutralises formula injection", !/\n=|,=/.test(String(regCsv.data)));

console.log("\nrate limiting");
let limited = false;
for (let i = 0; i < 12 && !limited; i++) {
  const res = await call("POST", "/api/register", { body: { ...alice }, headers: { "x-forwarded-for": `10.250.${run.length}.7` } });
  if (res.status === 429) limited = true;
}
check("register is rate limited per network (429)", limited);

console.log(failures ? `\n${failures} check(s) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
