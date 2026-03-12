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
  /** Action: 'created' (default), 'approved', 'approved_with_changes', 'rejected' */
  action?: string;
  /** Moderation note / rejection reason */
  moderationNote?: string;
  /** Old category key (before admin change) */
  oldCategory?: string;
  /** New category key (after admin change) */
  newCategory?: string;
}

const TRANSLATIONS: Record<string, {
  subject: string;
  subjectApproved: string;
  subjectRejected: string;
  greet: string;
  approved: string;
  pending: string;
  approvedMsg: string;
  approvedWithChangesMsg: string;
  rejectedMsg: string;
  reasonLabel: string;
  categoryChangedMsg: string;
  noteLabel: string;
  footer: string;
  footerModeration: string;
  exploreBtn: string;
}> = {
  fr: {
    subject: 'Votre son a été ajouté — Ecnelis FLY',
    subjectApproved: 'Votre son a été approuvé — Ecnelis FLY',
    subjectRejected: 'Décision concernant votre son — Ecnelis FLY',
    greet: 'Bonjour',
    approved: 'Votre son <strong>"{{title}}"</strong> a bien été publié sur la carte sonore mondiale Ecnelis FLY.',
    pending: 'Votre son <strong>"{{title}}"</strong> a été soumis et est <strong>en attente de validation</strong>. Il sera publié prochainement après vérification par notre équipe.',
    approvedMsg: 'Bonne nouvelle ! Votre son <strong>"{{title}}"</strong> a été <strong>approuvé</strong> et est désormais disponible sur la carte sonore mondiale Ecnelis FLY.',
    approvedWithChangesMsg: 'Votre son <strong>"{{title}}"</strong> a été <strong>approuvé</strong> et est désormais disponible sur la carte sonore mondiale Ecnelis FLY. Quelques ajustements ont été effectués par notre équipe.',
    rejectedMsg: 'Après examen, votre son <strong>"{{title}}"</strong> n\'a pas pu être publié sur la carte sonore mondiale. Il reste toutefois consultable dans votre espace personnel au statut privé.',
    reasonLabel: 'Motif',
    categoryChangedMsg: 'La catégorie a été modifiée de <strong>"{{oldCat}}"</strong> à <strong>"{{newCat}}"</strong>.',
    noteLabel: 'Note de l\'équipe',
    footer: 'Merci de contribuer à la cartographie sonore mondiale !',
    footerModeration: 'Si vous avez des questions, n\'hésitez pas à nous contacter.',
    exploreBtn: 'Explorer la carte',
  },
  en: {
    subject: 'Your sound has been added — Ecnelis FLY',
    subjectApproved: 'Your sound has been approved — Ecnelis FLY',
    subjectRejected: 'Decision regarding your sound — Ecnelis FLY',
    greet: 'Hello',
    approved: 'Your sound <strong>"{{title}}"</strong> has been published on the Ecnelis FLY world sound map.',
    pending: 'Your sound <strong>"{{title}}"</strong> has been submitted and is <strong>pending validation</strong>. It will be published shortly after review by our team.',
    approvedMsg: 'Great news! Your sound <strong>"{{title}}"</strong> has been <strong>approved</strong> and is now available on the Ecnelis FLY world sound map.',
    approvedWithChangesMsg: 'Your sound <strong>"{{title}}"</strong> has been <strong>approved</strong> and is now available on the Ecnelis FLY world sound map. A few adjustments were made by our team.',
    rejectedMsg: 'After review, your sound <strong>"{{title}}"</strong> could not be published on the world sound map. It remains accessible in your personal space as a private sound.',
    reasonLabel: 'Reason',
    categoryChangedMsg: 'The category was changed from <strong>"{{oldCat}}"</strong> to <strong>"{{newCat}}"</strong>.',
    noteLabel: 'Team note',
    footer: 'Thank you for contributing to the world sound map!',
    footerModeration: 'If you have any questions, feel free to contact us.',
    exploreBtn: 'Explore the map',
  },
  es: {
    subject: 'Tu sonido ha sido añadido — Ecnelis FLY',
    subjectApproved: 'Tu sonido ha sido aprobado — Ecnelis FLY',
    subjectRejected: 'Decisión sobre tu sonido — Ecnelis FLY',
    greet: 'Hola',
    approved: 'Tu sonido <strong>"{{title}}"</strong> ha sido publicado en el mapa sonoro mundial de Ecnelis FLY.',
    pending: 'Tu sonido <strong>"{{title}}"</strong> ha sido enviado y está <strong>pendiente de validación</strong>. Será publicado próximamente tras la revisión de nuestro equipo.',
    approvedMsg: '¡Buenas noticias! Tu sonido <strong>"{{title}}"</strong> ha sido <strong>aprobado</strong> y ya está disponible en el mapa sonoro mundial de Ecnelis FLY.',
    approvedWithChangesMsg: 'Tu sonido <strong>"{{title}}"</strong> ha sido <strong>aprobado</strong> y ya está disponible en el mapa sonoro mundial de Ecnelis FLY. Nuestro equipo realizó algunos ajustes.',
    rejectedMsg: 'Tras su revisión, tu sonido <strong>"{{title}}"</strong> no ha podido ser publicado en el mapa sonoro mundial. Sin embargo, sigue siendo accesible en tu espacio personal como sonido privado.',
    reasonLabel: 'Motivo',
    categoryChangedMsg: 'La categoría se ha cambiado de <strong>"{{oldCat}}"</strong> a <strong>"{{newCat}}"</strong>.',
    noteLabel: 'Nota del equipo',
    footer: '¡Gracias por contribuir al mapa sonoro mundial!',
    footerModeration: 'Si tienes alguna pregunta, no dudes en contactarnos.',
    exploreBtn: 'Explorar el mapa',
  },
};

function getSubject(payload: SoundEmailPayload): string {
  const lang = payload.lang && TRANSLATIONS[payload.lang] ? payload.lang : 'fr';
  const t = TRANSLATIONS[lang];
  const action = payload.action || 'created';
  if (action === 'rejected') return t.subjectRejected;
  if (action === 'approved' || action === 'approved_with_changes') return t.subjectApproved;
  return t.subject; // 'created'
}

function buildBodyContent(payload: SoundEmailPayload): string {
  const lang = payload.lang && TRANSLATIONS[payload.lang] ? payload.lang : 'fr';
  const t = TRANSLATIONS[lang];
  const action = payload.action || 'created';
  const title = payload.soundTitle;
  let parts: string[] = [];

  if (action === 'approved') {
    parts.push(t.approvedMsg.replace('{{title}}', title));
  } else if (action === 'approved_with_changes') {
    parts.push(t.approvedWithChangesMsg.replace('{{title}}', title));
    if (payload.oldCategory && payload.newCategory) {
      parts.push(t.categoryChangedMsg
        .replace('{{oldCat}}', payload.oldCategory)
        .replace('{{newCat}}', payload.newCategory));
    }
    if (payload.moderationNote) {
      parts.push(`<strong>${t.noteLabel} :</strong> ${payload.moderationNote}`);
    }
  } else if (action === 'rejected') {
    parts.push(t.rejectedMsg.replace('{{title}}', title));
    if (payload.moderationNote) {
      parts.push(`<strong>${t.reasonLabel} :</strong> ${payload.moderationNote}`);
    }
  } else {
    // 'created' — backward compatible
    const isApproved = payload.soundStatus === 'public';
    parts.push((isApproved ? t.approved : t.pending).replace('{{title}}', title));
  }

  return parts.join('<br/><br/>');
}

function buildHtml(payload: SoundEmailPayload): string {
  const lang = payload.lang && TRANSLATIONS[payload.lang] ? payload.lang : 'fr';
  const t = TRANSLATIONS[lang];
  const action = payload.action || 'created';
  const subject = getSubject(payload);
  const body = buildBodyContent(payload);
  const isRejected = action === 'rejected';
  const isModeration = action === 'approved' || action === 'approved_with_changes' || action === 'rejected';
  const headerGradient = isRejected
    ? 'linear-gradient(135deg,#c62828,#d32f2f)'
    : 'linear-gradient(135deg,#1976d2,#3f51b5)';
  const ctaColor = isRejected ? '#c62828' : '#1976d2';
  const footer = isModeration ? t.footerModeration : t.footer;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:${headerGradient};padding:28px 32px;text-align:center;">
            <img src="https://www.ecnelisfly.com/img/logos/logo_blue_orange_left_round.png" alt="Ecnelis FLY" height="56" style="display:block;margin:0 auto 12px;" />
            <span style="color:#fff;font-size:1.4rem;font-weight:700;letter-spacing:1px;">ECNELIS FLY</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:1rem;color:#333;">${t.greet} <strong>${payload.username}</strong>,</p>
            <p style="margin:0 0 24px;font-size:1rem;color:#444;line-height:1.6;">${body}</p>
            ${!isRejected ? `<div style="text-align:center;margin:24px 0;">
              <a href="https://www.ecnelisfly.com/mapfly" style="display:inline-block;padding:12px 28px;background:${ctaColor};color:#fff;text-decoration:none;border-radius:24px;font-weight:600;font-size:0.95rem;">
                🌍 ${t.exploreBtn}
              </a>
            </div>` : ''}
            <p style="margin:24px 0 0;font-size:0.85rem;color:#888;text-align:center;">${footer}</p>
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

function buildAdminNotificationHtml(payload: SoundEmailPayload): string {
  const action = payload.action || 'created';
  const isModeration = action !== 'created';
  const headerGradient = isModeration
    ? 'linear-gradient(135deg,#f57c00,#ff9800)'
    : 'linear-gradient(135deg,#1976d2,#3f51b5)';

  let bodyLines: string[] = [];

  if (action === 'created') {
    const statusLabel = payload.soundStatus === 'public' ? 'Public (admin)' : 'En attente de modération';
    bodyLines.push(`<strong>${payload.username}</strong> a ajouté un nouveau son : <strong>"${payload.soundTitle}"</strong>`);
    bodyLines.push(`Statut : <strong>${statusLabel}</strong>`);
  } else {
    const actionLabels: Record<string, string> = {
      approved: 'Approuvé',
      approved_with_changes: 'Approuvé avec modifications',
      rejected: 'Rejeté',
    };
    bodyLines.push(`Décision de modération pour le son <strong>"${payload.soundTitle}"</strong> de <strong>${payload.username}</strong> : <strong>${actionLabels[action] || action}</strong>`);
    if (payload.oldCategory && payload.newCategory) {
      bodyLines.push(`Catégorie modifiée : ${payload.oldCategory} → ${payload.newCategory}`);
    }
    if (payload.moderationNote) {
      bodyLines.push(`Note : ${payload.moderationNote}`);
    }
  }

  const subject = action === 'created'
    ? `Nouveau son ajouté par ${payload.username} — Ecnelis FLY`
    : `[Modération] ${payload.soundTitle} — Ecnelis FLY`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${headerGradient};padding:28px 32px;text-align:center;">
            <img src="https://www.ecnelisfly.com/img/logos/logo_blue_orange_left_round.png" alt="Ecnelis FLY" height="56" style="display:block;margin:0 auto 12px;" />
            <span style="color:#fff;font-size:1.4rem;font-weight:700;letter-spacing:1px;">ECNELIS FLY — ADMIN</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 24px;font-size:1rem;color:#444;line-height:1.6;">${bodyLines.join('<br/><br/>')}</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="https://www.ecnelisfly.com/admin/dashboard" style="display:inline-block;padding:12px 28px;background:#1976d2;color:#fff;text-decoration:none;border-radius:24px;font-weight:600;font-size:0.95rem;">
                🔧 Tableau de bord
              </a>
            </div>
          </td>
        </tr>
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

function getAdminSubject(payload: SoundEmailPayload): string {
  const action = payload.action || 'created';
  if (action === 'created') return `Nouveau son ajouté par ${payload.username} — Ecnelis FLY`;
  return `[Modération] ${payload.soundTitle} — Ecnelis FLY`;
}

export const handler = async (event: any) => {
  // Amplify Gen2 mutations pass args in event.arguments
  const payload: SoundEmailPayload = event.arguments ?? event;
  console.log(`${PREFIX} Invoked`, JSON.stringify(payload));

  const senderEmail = process.env['SENDER_EMAIL'];
  const adminEmail = process.env['ADMIN_EMAIL'];
  const enabled = process.env['SEND_EMAIL_ENABLED'] === 'true';

  if (!enabled) {
    console.log(`${PREFIX} Email sending disabled (SEND_EMAIL_ENABLED != "true"). Dry-run only.`);
    return { status: 'dry_run', toEmail: payload.toEmail };
  }

  if (!senderEmail) {
    console.error(`${PREFIX} SENDER_EMAIL env var not set — cannot send email.`);
    return { status: 'error', reason: 'SENDER_EMAIL not configured' };
  }

  if (!payload.toEmail || !payload.soundTitle || !payload.username) {
    console.error(`${PREFIX} Missing required payload fields.`);
    return { status: 'error', reason: 'Missing payload fields' };
  }

  const ses = new SESv2Client({});
  const action = payload.action || 'created';

  // 1) Send user email (for all actions)
  const subject = getSubject(payload);
  const html = buildHtml(payload);

  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: senderEmail,
      Destination: { ToAddresses: [payload.toEmail] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Html: { Data: html, Charset: 'UTF-8' } },
        },
      },
    }));
    console.log(`${PREFIX} Email sent to ${payload.toEmail}`);
  } catch (err) {
    console.error(`${PREFIX} SES send to user failed:`, err);
    return { status: 'error', reason: String(err) };
  }

  // 2) Send admin notification email (separate email with admin-specific content)
  if (adminEmail && adminEmail !== payload.toEmail) {
    try {
      const adminSubject = getAdminSubject(payload);
      const adminHtml = buildAdminNotificationHtml(payload);
      await ses.send(new SendEmailCommand({
        FromEmailAddress: senderEmail,
        Destination: { ToAddresses: [adminEmail] },
        Content: {
          Simple: {
            Subject: { Data: adminSubject, Charset: 'UTF-8' },
            Body: { Html: { Data: adminHtml, Charset: 'UTF-8' } },
          },
        },
      }));
      console.log(`${PREFIX} Admin notification sent to ${adminEmail}`);
    } catch (err) {
      console.warn(`${PREFIX} Admin notification failed (non-blocking):`, err);
    }
  }

  return { status: 'sent', toEmail: payload.toEmail };
};
