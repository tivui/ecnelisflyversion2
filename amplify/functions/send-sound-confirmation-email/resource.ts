import { defineFunction, secret } from '@aws-amplify/backend';

/**
 * Lambda: send a confirmation email after a sound is created.
 * Triggered from the frontend after Sound.create() succeeds.
 *
 * ⚠️  SES not yet configured — enable SEND_EMAIL_ENABLED once
 *     the OVH domain is verified in AWS SES and moved out of sandbox.
 *
 * Required env vars (set in Amplify Console → Functions → Environment):
 *   SENDER_EMAIL   e.g. noreply@ecnelis.fly
 *   SEND_EMAIL_ENABLED  "true" to activate (defaults to dry-run mode)
 */
export const sendSoundConfirmationEmail = defineFunction({
  name: 'send-sound-confirmation-email',
  entry: './handler.ts',
  timeoutSeconds: 15,
  memoryMB: 256,
});
