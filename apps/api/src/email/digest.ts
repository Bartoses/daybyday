/**
 * Weekly digest email — a warm Sunday recap. Branded to the app's palette with
 * email-safe inline styles (table layout, web-safe serif for headings). Surfaces
 * the week's recap, a featured tip, and an upcoming milestone to pull parents back.
 */
export interface DigestInput {
  parentName: string;
  childName: string;
  tipsThisWeek: number;
  totalTips: number;
  streak: number;
  featured: { insight: string; action: string } | null;
  milestone: { label: string; age_label: string; description: string } | null;
  appUrl: string;
}

const COLORS = {
  bg: "#E7E2D9",
  cream: "#FAF4EC",
  surface: "#FFFFFF",
  coral: "#E07E5F",
  coralDeep: "#C9694B",
  navy: "#233152",
  ink: "#2A2A2E",
  muted: "#6E665C",
  peach: "#FBEAE0",
  border: "#EADFCF",
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildWeeklyDigest(input: DigestInput): { subject: string; html: string } {
  const { parentName, childName, tipsThisWeek, totalTips, streak, featured, milestone, appUrl } =
    input;
  const subject = `Your week with ${childName} 🌿`;

  const recap =
    tipsThisWeek > 0
      ? `You opened ${tipsThisWeek} day${tipsThisWeek === 1 ? "" : "s"} this week${
          streak >= 2 ? ` — a ${streak}-day streak going` : ""
        }. ${totalTips} tip${totalTips === 1 ? "" : "s"} learned so far.`
      : `It's been a little while — here's a fresh idea for ${esc(childName)} to ease back in.`;

  const featuredBlock = featured
    ? `
      <tr><td style="padding:0 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:18px;">
          <tr><td style="padding:22px 22px 18px;">
            <div style="font:600 12px ${SANS};letter-spacing:.6px;text-transform:uppercase;color:${COLORS.coralDeep};">This week's tip</div>
            <div style="font:600 21px/1.35 ${SERIF};color:${COLORS.navy};margin:8px 0 14px;">${esc(featured.insight)}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.peach};border-radius:14px;">
              <tr><td style="padding:14px 16px;">
                <div style="font:800 11px ${SANS};letter-spacing:.6px;text-transform:uppercase;color:${COLORS.coralDeep};">✓ Try this</div>
                <div style="font:400 16px/1.5 ${SANS};color:${COLORS.ink};margin-top:4px;">${esc(featured.action)}</div>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const milestoneBlock = milestone
    ? `
      <tr><td style="padding:18px 28px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:18px;">
          <tr><td style="padding:20px 22px;">
            <div style="font:800 11px ${SANS};letter-spacing:.6px;text-transform:uppercase;color:${COLORS.muted};">Coming up · ${esc(milestone.age_label)}</div>
            <div style="font:600 18px ${SERIF};color:${COLORS.navy};margin:6px 0 4px;">${esc(milestone.label)}</div>
            <div style="font:400 14px/1.5 ${SANS};color:${COLORS.muted};">${esc(milestone.description)}</div>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding:8px 28px 16px;">
          <span style="font:600 24px ${SERIF};color:${COLORS.navy};letter-spacing:-.4px;">DaybyDay</span>
        </td></tr>

        <tr><td style="padding:0 28px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.cream};border:1px solid ${COLORS.border};border-radius:20px;">
            <tr><td style="padding:24px 24px 20px;">
              <div style="font:500 26px/1.25 ${SERIF};color:${COLORS.navy};letter-spacing:-.3px;">Hi ${esc(parentName)},</div>
              <div style="font:400 16px/1.55 ${SANS};color:${COLORS.ink};margin-top:10px;">${recap}</div>
            </td></tr>
          </table>
        </td></tr>

        ${featuredBlock}
        ${milestoneBlock}

        <tr><td align="center" style="padding:26px 28px 8px;">
          <a href="${appUrl}/today" style="display:inline-block;background:${COLORS.coral};color:#ffffff;font:700 16px ${SANS};text-decoration:none;padding:15px 34px;border-radius:15px;">Open DaybyDay</a>
        </td></tr>

        <tr><td style="padding:18px 28px 28px;">
          <div style="font:400 12px/1.5 ${SANS};color:${COLORS.muted};">
            You're getting this weekly recap because email updates are on. Turn them off anytime in the app under Settings → Notifications.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}
