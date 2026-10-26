// Synthetic test data only. Never generates a working authentication link.
// node --env-file=.env --import tsx scripts/test-resend-templates.ts --all
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { Resend } from 'resend';
import { authResendTemplate, RESEND_TEMPLATE_IDS, reservationResendTemplate, tenantResendTemplate, type HavenMailKind } from '../services/resendTemplates';
import { createReservationConfirmation } from '../services/reservationFulfillment';
import { paymentReceiptPdf } from '../services/paymentReceiptPdf';
import type { Booking } from '../types';
import type { TenantMailJob } from '../services/tenantMail';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

const to = process.env.RESEND_TEST_EMAIL_TO?.trim();
if (!process.env.RESEND_API_KEY || !to) throw new Error('Configuration locale Resend incomplète.');
const client = new Resend(process.env.RESEND_API_KEY);
const now = new Date().toISOString();
const day = (offset: number) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);
const booking = { id: `demo-${randomUUID()}`, tenantId: 'demo', ownerId: 'demo', listingId: 'demo', listingTitle: 'Maison de démonstration & Haven', roomName: 'Chambre Horizon', startDate: day(7), endDate: day(14), paidAt: now, completedAt: now, totalPrice: 176, basePrice: 140, cleaningFee: 20, platformFee: 16, paymentProvider: 'SIMULATION', paymentIsTest: true,
  cancellation: { cancelledAt: now, cancelledBy: 'TENANT', reason: 'Exemple fictif : changement de programme.', refundAmount: 176, refundStatus: 'SIMULATED' } } as Booking;
const receipt = createReservationConfirmation(booking, { address: 'Adresse fictive pour cet essai' }, { firstName: 'Paul', email: to });
const origin = process.env.APP_ORIGIN;
const kinds = process.argv.includes('--all') ? Object.keys(RESEND_TEMPLATE_IDS) as HavenMailKind[] : ['CONFIRMATION'] as HavenMailKind[];
for (const kind of kinds) {
  let content;
  if (kind === 'EMAIL_VERIFICATION' || kind === 'PASSWORD_RESET') {
    content = authResendTemplate(kind, 'Paul', `https://${firebaseConfig.authDomain}/__/auth/action?mode=${kind === 'EMAIL_VERIFICATION' ? 'verifyEmail' : 'resetPassword'}&oobCode=DEMONSTRATION_SANS_VALIDITE`, firebaseConfig.authDomain);
    content.template.variables.MENTION_TEST = 'TEST · Modèle de démonstration. Le bouton ne contient aucun lien de sécurité utilisable.';
  } else if (['ACCOUNT_APPROVED', 'ACCOUNT_CORRECTION', 'CANCELLED', 'REVIEW_INVITE'].includes(kind)) {
    content = tenantResendTemplate({ kind, userId: 'demo', occurredAt: now, exceptional: kind === 'ACCOUNT_APPROVED' } as TenantMailJob, { firstName: 'Paul', rejectionReason: 'Exemple fictif : merci de fournir une pièce lisible.' }, booking, undefined, origin);
  } else content = reservationResendTemplate(kind as 'CONFIRMATION', receipt, { appOrigin: origin, occurredAt: now, instructions: 'Exemple fictif : contactez le propriétaire pour organiser votre arrivée. Aucun code d’accès réel.' });
  const result = await client.emails.send({ from: process.env.EMAIL_FROM || 'Haven <onboarding@resend.dev>', to, subject: `[TEST HAVEN] ${kind}`, ...content,
    ...(kind === 'CONFIRMATION' ? { attachments: [{ filename: 'justificatif-test-haven.pdf', content: await paymentReceiptPdf(receipt) }] } : {}) }, { idempotencyKey: `template-test-${booking.id}-${kind}` });
  if (result.error) {
    console.error(`${kind} : refusé (${result.error.name}). ${result.error.message}`);
    process.exitCode = 1;
    break; // Stop the series if the provider rejects the sender or recipient.
  } else console.log(`${kind} : accepté (${result.data?.id}).`);
  await setTimeout(600);
}
