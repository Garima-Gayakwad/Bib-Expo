import { Resend } from "resend";

type CollectionType = "SELF" | "BEHALF" | "BULK";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendCollectionEmail({
  participantName,
  participantEmail,
  bibNumber,
  eventName,
  collectionType,
  collectorName,
}: {
  participantName: string;
  participantEmail: string;
  bibNumber: number;
  eventName: string;
  collectionType: CollectionType;
  collectorName?: string;
}) {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is not configured");
  }

  const safeEventName = eventName || "Bib Expo";
  const safeCollectorName = collectorName ?? "an authorized collector";
  const collectionLine =
    collectionType === "SELF"
      ? "Your bib / T-shirt / goodies have been successfully collected by you."
      : `Your bib / T-shirt / goodies have been collected by ${safeCollectorName}.`;
  const message =
    collectionType === "SELF"
      ? `Hi ${participantName},

Your bib / T-shirt / goodies have been successfully collected by you.

Event: ${safeEventName}
Bib Number: ${bibNumber}

Thank you for participating!`
      : `Hi ${participantName},

Your bib / T-shirt / goodies have been collected by ${safeCollectorName}.

Event: ${safeEventName}
Bib Number: ${bibNumber}

Thank you for participating!`;
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; background: #f8fafc; padding: 24px; color: #0f172a;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="padding: 16px 20px; background: linear-gradient(135deg, #4C1D95, #E11D48); color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px;">Bib Expo</h2>
          <p style="margin: 6px 0 0; font-size: 12px; opacity: 0.9;">Collection Confirmation</p>
        </div>
        <div style="padding: 20px;">
          <p style="margin: 0 0 12px;">Hi ${participantName},</p>
          <p style="margin: 0 0 16px;">${collectionLine}</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
            <p style="margin: 0 0 8px;"><strong>Event:</strong> ${safeEventName}</p>
            <p style="margin: 0;"><strong>Bib Number:</strong> ${bibNumber}</p>
          </div>
          <p style="margin: 16px 0 0;">Thank you for participating!</p>
        </div>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: participantEmail,
    subject: `Bib Collection Confirmation - ${safeEventName}`,
    text: message,
    html,
  });
}
