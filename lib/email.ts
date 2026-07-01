import { Resend } from "resend";

const _resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://talkode.netlify.app";

type InviteEmailParams = {
  to: string;
  name?: string | null;
  inviteCode: string;
  assessmentTitle: string;
  timeLimitMinutes: number;
  dueAt?: string | null;
};

function inviteLink(code: string) {
  return `${APP_URL}/assessment?code=${code}`;
}

function dueLine(dueAt?: string | null, prefix = "") {
  if (!dueAt) return "";
  const formatted = new Date(dueAt).toLocaleDateString("en-US", {
    dateStyle: "long",
  });
  return `${prefix}Must be completed by ${formatted}.`;
}

export async function sendInviteEmail({
  to,
  name,
  inviteCode,
  assessmentTitle,
  timeLimitMinutes,
  dueAt,
}: InviteEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const url = inviteLink(inviteCode);
  const greeting = name ? `Hi ${name}` : "Hi there";
  const due = dueLine(dueAt, " ");

  const { error } = await _resend.emails.send({
    from: "Talkode <onboarding@resend.dev>",
    to,
    subject: `You've been invited: ${assessmentTitle}`,
    text: [
      `${greeting},`,
      ``,
      `You've been invited to complete a technical assessment: ${assessmentTitle}.`,
      ``,
      `The assessment takes approximately ${timeLimitMinutes} minutes and consists of a`,
      `codebase walkthrough with an AI interviewer.${due}`,
      ``,
      `Start here: ${url}`,
      ``,
      `(If this email landed in spam, please mark it as not spam so future emails reach you.)`,
      ``,
      `Good luck!`,
      `— The Talkode Team`,
    ].join("\n"),
    html: `
<p>${greeting},</p>
<p>You've been invited to complete a technical assessment: <strong>${assessmentTitle}</strong>.</p>
<p>The assessment takes approximately <strong>${timeLimitMinutes} minutes</strong> and consists of a codebase walkthrough with an AI interviewer.${due ? ` ${due}` : ""}</p>
<p style="margin-top:24px">
  <a href="${url}" style="display:inline-block;padding:12px 24px;background:#c8f500;color:#111510;font-weight:700;text-decoration:none;border-radius:3px;font-size:15px">
    Start assessment
  </a>
</p>
<p style="margin-top:12px;color:#888;font-size:12px">Or paste this link: ${url}</p>
<p style="margin-top:24px;color:#aaa;font-size:11px">If this email landed in spam, please mark it as not spam so future messages reach you.</p>
`,
  });

  if (error) throw new Error(error.message);
}

export async function sendReminderEmail({
  to,
  name,
  inviteCode,
  assessmentTitle,
  timeLimitMinutes,
  dueAt,
}: InviteEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const url = inviteLink(inviteCode);
  const greeting = name ? `Hi ${name}` : "Hi there";
  const due = dueLine(dueAt, " ");

  const { error } = await _resend.emails.send({
    from: "Talkode <onboarding@resend.dev>",
    to,
    subject: `Reminder: ${assessmentTitle} is waiting for you`,
    text: [
      `${greeting},`,
      ``,
      `Just a reminder — you have a pending technical assessment: ${assessmentTitle}.${due}`,
      ``,
      `The assessment takes approximately ${timeLimitMinutes} minutes.`,
      ``,
      `Start here: ${url}`,
      ``,
      `— The Talkode Team`,
    ].join("\n"),
    html: `
<p>${greeting},</p>
<p>Just a reminder — you have a pending technical assessment: <strong>${assessmentTitle}</strong>.${due ? ` ${due}` : ""}</p>
<p>The assessment takes approximately <strong>${timeLimitMinutes} minutes</strong>.</p>
<p style="margin-top:24px">
  <a href="${url}" style="display:inline-block;padding:12px 24px;background:#c8f500;color:#111510;font-weight:700;text-decoration:none;border-radius:3px;font-size:15px">
    Start assessment
  </a>
</p>
<p style="margin-top:12px;color:#888;font-size:12px">Or paste this link: ${url}</p>
`,
  });

  if (error) throw new Error(error.message);
}
