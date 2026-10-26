// Manual, synthetic-data test only. Run with: node --env-file=.env --import tsx scripts/test-reservation-email.ts
import { randomUUID } from 'node:crypto';
import { Resend } from 'resend';
import { createReservationConfirmation } from '../services/reservationFulfillment';
import { reservationLifecycleEmail } from '../services/reservationMail';
import { paymentReceiptPdf } from '../services/paymentReceiptPdf';
import type { Booking } from '../types';

const key = process.env.RESEND_API_KEY?.trim();
const to = process.env.RESEND_TEST_EMAIL_TO?.trim();
if (!key || !to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error('Renseignez RESEND_API_KEY et RESEND_TEST_EMAIL_TO dans le fichier .env local.');
  process.exit(1);
}
const day = (offset: number) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);
const receipt = createReservationConfirmation({
  id: `test-mail-${randomUUID()}`, tenantId: 'test-fictif', ownerId: 'test-fictif',
  startDate: day(7), endDate: day(14), paidAt: new Date().toISOString(),
  totalPrice: 180, basePrice: 140, cleaningFee: 20, platformFee: 20,
  paymentProvider: 'SIMULATION', paymentIsTest: true,
} as Booking, { title: 'Logement de démonstration — réservation fictive', address: 'Adresse fictive pour ce test' }, { firstName: 'Paul', email: to });
const mail = reservationLifecycleEmail('CONFIRMATION', receipt, { appOrigin: process.env.APP_ORIGIN });
try {
  const result = await new Resend(key).emails.send({
    from: process.env.EMAIL_FROM?.trim() || 'Haven <onboarding@resend.dev>', to,
    ...(process.env.EMAIL_REPLY_TO?.trim() ? { replyTo: process.env.EMAIL_REPLY_TO.trim() } : {}),
    ...mail, attachments: [{ filename: 'justificatif-test-haven.pdf', content: await paymentReceiptPdf(receipt) }],
  }, { idempotencyKey: receipt.id });
  if (result.error) {
    console.error(`Test refusé par Resend (${result.error.name}). Vérifiez la clé, l’expéditeur et l’adresse du titulaire du compte dans Resend.`);
    process.exitCode = 1;
  } else console.log(`Test accepté par Resend. Identifiant : ${result.data?.id}. Vérifiez la réception et le PDF dans votre boîte mail.`);
} catch {
  console.error('Impossible de joindre Resend. Aucun succès de distribution ne peut être confirmé.');
  process.exitCode = 1;
}
