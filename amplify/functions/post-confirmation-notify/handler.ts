import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { PostConfirmationTriggerHandler } from 'aws-lambda';

const PREFIX = '[POST-CONFIRMATION-NOTIFY]';
const ADMIN_EMAIL = 'ecnelisfly@gmail.com';

export const handler: PostConfirmationTriggerHandler = async (event) => {
  console.log(`${PREFIX} Trigger: ${event.triggerSource}`);

  // Only notify on sign-up confirmation (not forgot password)
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  const email = event.request.userAttributes.email ?? 'inconnu';
  const sub = event.request.userAttributes.sub ?? '';
  const date = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  console.log(`${PREFIX} New user: ${email} (${sub})`);

  const ses = new SESv2Client({});

  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: ADMIN_EMAIL,
      Destination: { ToAddresses: [ADMIN_EMAIL] },
      Content: {
        Simple: {
          Subject: {
            Data: `Nouvelle inscription — Ecnelis FLY`,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: buildHtml(email, sub, date),
              Charset: 'UTF-8',
            },
          },
        },
      },
    }));
    console.log(`${PREFIX} Notification sent to ${ADMIN_EMAIL}`);
  } catch (err) {
    // Don't block the user sign-up if notification fails
    console.error(`${PREFIX} Failed to send notification:`, err);
  }

  return event;
};

function buildHtml(email: string, sub: string, date: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1976d2,#3f51b5);padding:20px 24px;text-align:center;">
            <span style="color:#fff;font-size:1.2rem;font-weight:700;">Ecnelis FLY — Nouvelle inscription</span>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 12px;font-size:1rem;color:#333;">Un nouvel utilisateur s'est inscrit :</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 12px;font-weight:600;color:#555;border-bottom:1px solid #eee;">Email</td>
                <td style="padding:8px 12px;color:#1976d2;border-bottom:1px solid #eee;">${email}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;font-weight:600;color:#555;border-bottom:1px solid #eee;">Date</td>
                <td style="padding:8px 12px;color:#333;border-bottom:1px solid #eee;">${date}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;font-weight:600;color:#555;">Cognito Sub</td>
                <td style="padding:8px 12px;color:#888;font-size:0.85rem;">${sub}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8f9fa;padding:12px 24px;text-align:center;border-top:1px solid #e0e0e0;">
            <p style="margin:0;font-size:0.75rem;color:#aaa;">&copy; 2021-2026 Ecnelis FLY</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
