import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const PREFIX = '[SOUND-CONFIRM-EMAIL]';

interface SoundEmailPayload {
  /** Recipient email address */
  toEmail: string;
  /** Author's username */
  username: string;
  /** Sound title in the user's language */
  soundTitle: string;
  /** Sound status: 'public' | 'public_to_be_approved' */
  soundStatus: string;
  /** Language code: 'fr' | 'en' | 'es' */
  lang?: string;
}

const TRANSLATIONS: Record<string, {
  subject: string;
  greet: string;
  approved: string;
  pending: string;
  footer: string;
}> = {
  fr: {
    subject: 'Votre son a été ajouté — Ecnelis FLY',
    greet: 'Bonjour',
    approved: 'Votre son <strong>"{{title}}"</strong> a bien été publié sur la carte sonore mondiale Ecnelis FLY.',
    pending: 'Votre son <strong>"{{title}}"</strong> a été soumis et est <strong>en attente de validation</strong>. Il sera publié prochainement après vérification par notre équipe.',
    footer: 'Merci de contribuer à la cartographie sonore mondiale !',
  },
  en: {
    subject: 'Your sound has been added — Ecnelis FLY',
    greet: 'Hello',
    approved: 'Your sound <strong>"{{title}}"</strong> has been published on the Ecnelis FLY world sound map.',
    pending: 'Your sound <strong>"{{title}}"</strong> has been submitted and is <strong>pending validation</strong>. It will be published shortly after review by our team.',
    footer: 'Thank you for contributing to the world sound map!',
  },
  es: {
    subject: 'Tu sonido ha sido añadido — Ecnelis FLY',
    greet: 'Hola',
    approved: 'Tu sonido <strong>"{{title}}"</strong> ha sido publicado en el mapa sonoro mundial de Ecnelis FLY.',
    pending: 'Tu sonido <strong>"{{title}}"</strong> ha sido enviado y está <strong>pendiente de validación</strong>. Será publicado próximamente tras la revisión de nuestro equipo.',
    footer: '¡Gracias por contribuir al mapa sonoro mundial!',
  },
};

function buildHtml(payload: SoundEmailPayload): string {
  const lang = payload.lang && TRANSLATIONS[payload.lang] ? payload.lang : 'fr';
  const t = TRANSLATIONS[lang];
  const isApproved = payload.soundStatus === 'public';
  const body = (isApproved ? t.approved : t.pending).replace('{{title}}', payload.soundTitle);

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1976d2,#3f51b5);padding:28px 32px;text-align:center;">
            <img src="https://www.ecnelisfly.com/img/logos/logo_blue_orange_left_round.png" alt="Ecnelis FLY" height="56" style="display:block;margin:0 auto 12px;" />
            <span style="color:#fff;font-size:1.4rem;font-weight:700;letter-spacing:1px;">ECNELIS FLY</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:1rem;color:#333;">${t.greet} <strong>${payload.username}</strong>,</p>
            <p style="margin:0 0 24px;font-size:1rem;color:#444;line-height:1.6;">${body}</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="https://www.ecnelisfly.com/mapfly" style="display:inline-block;padding:12px 28px;background:#1976d2;color:#fff;text-decoration:none;border-radius:24px;font-weight:600;font-size:0.95rem;">
                🌍 Explorer la carte
              </a>
            </div>
            <p style="margin:24px 0 0;font-size:0.85rem;color:#888;text-align:center;">${t.footer}</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fa;padding:16px 32px;text-align:center;border-top:1px solid #e0e0e0;">
            <p style="margin:0;font-size:0.75rem;color:#aaa;">© 2021-2026 Ecnelis FLY · <a href="https://www.ecnelisfly.com" style="color:#1976d2;text-decoration:none;">ecnelisfly.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export const handler = async (event: SoundEmailPayload) => {
  console.log(`${PREFIX} Invoked`, JSON.stringify(event));

  const senderEmail = process.env['SENDER_EMAIL'];
  const enabled = process.env['SEND_EMAIL_ENABLED'] === 'true';

  if (!enabled) {
    console.log(`${PREFIX} Email sending disabled (SEND_EMAIL_ENABLED != "true"). Dry-run only.`);
    return { status: 'dry_run', toEmail: event.toEmail };
  }

  if (!senderEmail) {
    console.error(`${PREFIX} SENDER_EMAIL env var not set — cannot send email.`);
    return { status: 'error', reason: 'SENDER_EMAIL not configured' };
  }

  if (!event.toEmail || !event.soundTitle || !event.username) {
    console.error(`${PREFIX} Missing required payload fields.`);
    return { status: 'error', reason: 'Missing payload fields' };
  }

  const lang = event.lang && TRANSLATIONS[event.lang] ? event.lang : 'fr';
  const subject = TRANSLATIONS[lang].subject;
  const html = buildHtml(event);

  const ses = new SESv2Client({});

  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: senderEmail,
      Destination: { ToAddresses: [event.toEmail] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Html: { Data: html, Charset: 'UTF-8' } },
        },
      },
    }));
    console.log(`${PREFIX} Email sent to ${event.toEmail}`);
    return { status: 'sent', toEmail: event.toEmail };
  } catch (err) {
    console.error(`${PREFIX} SES send failed:`, err);
    return { status: 'error', reason: String(err) };
  }
};
