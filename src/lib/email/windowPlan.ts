import { getResend, EMAIL_FROM } from "@/lib/resend";
import type { GeneratedWindowPlan } from "@/lib/claude/plan";

export async function sendWindowPlanEmail(params: {
  to: string;
  plan: GeneratedWindowPlan;
  pdfBytes: Uint8Array;
  planUrl: string;
}) {
  const { to, plan, pdfBytes, planUrl } = params;

  const stepsHtml = plan.steps
    .map((step) => `<li style="margin-bottom:8px;">${step}</li>`)
    .join("");

  await getResend().emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Your Window Plan: ${plan.title}`,
    html: `
      <div style="font-family: sans-serif; color: #1A1A2E; max-width: 560px; margin: 0 auto;">
        <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; color: #4B2AA6; font-weight: 600;">Your Window Plan</p>
        <h1 style="font-size: 24px; margin: 8px 0 16px;">${plan.title}</h1>
        <p style="color: #55555f;">${plan.why_it_fits}</p>
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #4B2AA6; margin-top: 24px;">Steps</h2>
        <ol style="padding-left: 20px;">${stepsHtml}</ol>
        <div style="background: #F5F3EE; border: 1px solid #4B2AA6; border-radius: 12px; padding: 16px; margin-top: 16px;">
          <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #4B2AA6; font-weight: 600; margin: 0 0 4px;">First action</p>
          <p style="margin: 0;">${plan.first_action}</p>
        </div>
        <p style="margin-top: 16px; color: #55555f; font-size: 14px;">
          Time: ${plan.time_estimate} &middot; Cost: ${plan.cost_estimate}
        </p>
        <p style="margin-top: 24px;">
          <a href="${planUrl}" style="color: #4B2AA6;">View your Window Plan online</a>
        </p>
      </div>
    `,
    attachments: [
      {
        filename: "window-plan.pdf",
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });
}
