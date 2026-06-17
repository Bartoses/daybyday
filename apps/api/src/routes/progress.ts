import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { makeAuthPreHandler } from "../plugins/auth.js";
import { makeRequireParent } from "../plugins/parent.js";

/** YYYY-MM-DD (UTC) — matches how messages.send_date is written by the feed. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function shift(key: string, deltaDays: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return dayKey(d);
}

/** Current + longest consecutive-day streak from a set of active day-keys. */
function computeStreaks(dates: Set<string>): { current: number; longest: number } {
  const sorted = [...dates].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && shift(prev, 1) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  // Current streak counts back from today, or yesterday if they haven't opened
  // today yet (so the streak doesn't read 0 before the day's first visit).
  const today = dayKey(new Date());
  let anchor: string | null = dates.has(today)
    ? today
    : dates.has(shift(today, -1))
      ? shift(today, -1)
      : null;
  let current = 0;
  while (anchor && dates.has(anchor)) {
    current += 1;
    anchor = shift(anchor, -1);
  }
  return { current, longest };
}

/** Streak + progress for the habit loop (drives the Today reward). */
export async function progressRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [makeAuthPreHandler(app.config), makeRequireParent()];

  // GET /v1/progress — streak + tips-learned for the signed-in parent.
  app.get("/v1/progress", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parentId = req.parent!.id;

    const [{ data: dailyDates }, { count: tipsLearned }] = await Promise.all([
      app.db
        .from("messages")
        .select("send_date")
        .eq("parent_id", parentId)
        .eq("message_type", "daily")
        .order("send_date", { ascending: false })
        .limit(1000),
      app.db
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", parentId)
        .eq("message_type", "daily"),
    ]);

    const dates = new Set(
      ((dailyDates as { send_date: string | null }[] | null) ?? [])
        .map((r) => r.send_date)
        .filter((d): d is string => Boolean(d)),
    );
    const { current, longest } = computeStreaks(dates);

    return reply.send({
      current_streak: current,
      longest_streak: longest,
      tips_learned: tipsLearned ?? 0,
      days_active: dates.size,
      seen_today: dates.has(dayKey(new Date())),
    });
  });
}
