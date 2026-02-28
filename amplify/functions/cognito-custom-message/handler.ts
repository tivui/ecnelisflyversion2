import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Default email templates (fallback if no custom template in DynamoDB)
const DEFAULT_SUBJECT_VERIFY = 'Vérifiez votre compte Ecnelis FLY 🎧';
const DEFAULT_BODY_VERIFY = `
<html><head><meta charset="UTF-8"><style>
body{font-family:sans-serif;background:#f1f2f6;margin:0;padding:20px}
.card{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
.header{background:linear-gradient(135deg,#1976d2,#3f51b5,#7e57c2);padding:32px 24px;text-align:center}
.logo{height:52px}
.title{color:#fff;font-size:1.3rem;font-weight:800;margin:10px 0 0}
.body{padding:32px 24px;color:#333}
.code{display:block;font-size:2rem;font-weight:900;text-align:center;letter-spacing:10px;color:#1976d2;background:#e3f2fd;border-radius:12px;padding:16px;margin:24px 0}
.note{font-size:.82rem;color:#888}
.footer{background:#f8f9fa;padding:12px 24px;text-align:center;font-size:.75rem;color:#aaa}
a{color:#1976d2;text-decoration:none}
</style></head><body>
<div class="card">
  <div class="header">
    <img src="https://www.ecnelisfly.com/img/logos/logo_blue_orange_left_round.png" alt="Ecnelis FLY" class="logo">
    <div class="title">🎧 Ecnelis FLY</div>
  </div>
  <div class="body">
    <p>Merci de rejoindre <strong>Ecnelis FLY</strong>, la plateforme d'exploration sonore géolocalisée.</p>
    <p>Votre code de vérification est :</p>
    <span class="code">{####}</span>
    <p class="note">Ce code expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.</p>
  </div>
  <div class="footer">© 2021-2026 Ecnelis FLY · <a href="https://www.ecnelisfly.com">ecnelisfly.com</a></div>
</div>
</body></html>
`;

const DEFAULT_SUBJECT_FORGOT = 'Réinitialisez votre mot de passe Ecnelis FLY';
const DEFAULT_BODY_FORGOT = `
<html><head><meta charset="UTF-8"><style>
body{font-family:sans-serif;background:#f1f2f6;margin:0;padding:20px}
.card{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
.header{background:linear-gradient(135deg,#1976d2,#3f51b5,#7e57c2);padding:32px 24px;text-align:center}
.logo{height:52px}
.title{color:#fff;font-size:1.3rem;font-weight:800;margin:10px 0 0}
.body{padding:32px 24px;color:#333}
.code{display:block;font-size:2rem;font-weight:900;text-align:center;letter-spacing:10px;color:#1976d2;background:#e3f2fd;border-radius:12px;padding:16px;margin:24px 0}
.note{font-size:.82rem;color:#888}
.footer{background:#f8f9fa;padding:12px 24px;text-align:center;font-size:.75rem;color:#aaa}
a{color:#1976d2;text-decoration:none}
</style></head><body>
<div class="card">
  <div class="header">
    <img src="https://www.ecnelisfly.com/img/logos/logo_blue_orange_left_round.png" alt="Ecnelis FLY" class="logo">
    <div class="title">🎧 Ecnelis FLY</div>
  </div>
  <div class="body">
    <p>Vous avez demandé la réinitialisation de votre mot de passe <strong>Ecnelis FLY</strong>.</p>
    <p>Votre code de réinitialisation est :</p>
    <span class="code">{####}</span>
    <p class="note">Ce code expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
  </div>
  <div class="footer">© 2021-2026 Ecnelis FLY · <a href="https://www.ecnelisfly.com">ecnelisfly.com</a></div>
</div>
</body></html>
`;

interface CognitoCustomMessageEvent {
  triggerSource: string;
  request: {
    codeParameter: string;
    usernameParameter?: string;
  };
  response: {
    emailSubject?: string;
    emailMessage?: string;
  };
}

export const handler = async (event: CognitoCustomMessageEvent): Promise<CognitoCustomMessageEvent> => {
  const tableName = process.env['EMAIL_TEMPLATES_TABLE_NAME'];
  const { triggerSource } = event;
  const code = event.request.codeParameter;

  // Determine which template ID to use
  let templateId: string | null = null;

  if (
    triggerSource === 'CustomMessage_SignUp' ||
    triggerSource === 'CustomMessage_ResendCode'
  ) {
    templateId = 'VERIFY_EMAIL';
  } else if (triggerSource === 'CustomMessage_ForgotPassword') {
    templateId = 'FORGOT_PASSWORD';
  }

  if (!templateId) {
    // No custom template needed for this trigger (e.g. admin create)
    return event;
  }

  // Determine defaults
  const isVerify = templateId === 'VERIFY_EMAIL';
  const defaultSubject = isVerify ? DEFAULT_SUBJECT_VERIFY : DEFAULT_SUBJECT_FORGOT;
  const defaultBody = isVerify ? DEFAULT_BODY_VERIFY : DEFAULT_BODY_FORGOT;

  let subject = defaultSubject;
  let body = defaultBody;

  // Try to load custom template from DynamoDB
  if (tableName) {
    try {
      const result = await ddb.send(new GetCommand({
        TableName: tableName,
        Key: { templateType: templateId },
      }));
      if (result.Item && result.Item['bodyHtml']) {
        subject = result.Item['subject'] || defaultSubject;
        body = result.Item['bodyHtml'];
      }
    } catch (e) {
      console.error('[cognito-custom-message] DynamoDB read failed, using default template:', e);
    }
  }

  // Replace placeholder with actual code
  event.response.emailSubject = subject;
  event.response.emailMessage = body.replace(/{####}/g, code);

  return event;
};
