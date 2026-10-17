import { createReservationConfirmation, confirmationEmail, canReleaseArrivalInstructions, type ReservationConfirmation } from './services/reservationFulfillment';
import { paymentReceiptPdf } from './services/paymentReceiptPdf';
import { getPaymentMode, PaymentConfigurationError } from './services/paymentConfiguration';
import { preparePaymentConfirmation, simulationSessionId, type PaymentReceipt } from './services/paymentCheckout';
import { isOwnerBookingVisible } from './services/bookingVisibility';
import { BookingLifecycleError, bookingDeadline, isBookingExpired, assertBookingPayable, prepareInventoryReport } from './services/bookingLifecycle';
import { hasVerificationException, hasTrustedVerificationException, prepareVerificationException, VerificationExceptionError } from './services/verificationException';
import { countNights, isBookableStay } from './services/stay';
import { getCancellationTerms } from './services/cancellationPolicy';
import { isStayReviewWindowOpen } from './services/reviewPolicy';
import { hasCompleteVerificationDetails, hasRequiredPhoneNumber, isVerificationReadyToSubmit } from './services/profileVerification';
import type { Booking, BookingAvailability, Listing, Room } from './types';
import { isRoomAvailableForStay } from './services/availability';
import { minimumNights } from './services/minimumStay';
import { canConfirmEmailOwnership } from './services/emailOwnership';
import { preparePersonalDetails, preparePhoneForVerification } from './services/accountProfileMutation';
import { normalizeAccountIdentifier, resolveAccountEntry } from './services/accountEntry';
import { assertAccountTermsConsent, selectAccountTerms } from './services/accountTerms';
import { normalizePhoneForVerification } from './services/phoneVerification';
import { createApiRequestBodyParser } from './services/apiRequestBody';
import { routeStayIssue, bindStayIssueToBooking } from './services/stayIssueRouting';
import { buildAuditTargetSnapshot } from './services/auditPresentation';
import { ReportFollowUpError, prepareReportFollowUp } from './services/reportFollowUp';
import { IncidentEscalationError, prepareIncidentEscalation } from './services/incidentMonitoring';
import { OwnerIncidentError, prepareOwnerIncidentUpdate } from './services/ownerIncident';
import { ListingReviewError, prepareListingReview } from './services/listingReview';
import { MemberApprovalError, prepareMemberApproval, prepareMemberModeration } from './services/memberApproval';
import { buildHousematePreviews, eligibleHousemateBookings } from './services/housemates';
import type { HousemateProfile } from './services/housemates';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from "resend";
import Stripe from "stripe";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { DocumentReference } from "firebase-admin/firestore";
import type { NextFunction, Request, Response } from "express";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

let stripeClient: Stripe | null = null;
const adminApp = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId: firebaseConfig.projectId });
const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
const verificationCodes = new Map<string, { hash: Buffer; expiresAt: number; attempts: number; lastSentAt: number }>();
const verifiedEmailTickets = new Map<string, number>();
const normalizeEmail = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
const hashCode = (email: string, code: string) => createHash("sha256").update(`${email}:${code}`).digest();
const verificationLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const sensitiveApiLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
const emailFrom = process.env.EMAIL_FROM?.trim() || "Haven <onboarding@resend.dev>";
const emailReplyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;
const isProduction = process.env.NODE_ENV === "production";

function getEmailProvider() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { error: "Le service d’envoi d’e-mails n’est pas configuré." } as const;
  if (isProduction && emailFrom.includes("onboarding@resend.dev")) {
    return { error: "L’expéditeur professionnel des e-mails n’est pas encore configuré." } as const;
  }
  return { resend: new Resend(apiKey) } as const;
}

interface AuthenticatedRequest extends Request { user?: { uid: string; email?: string } }

type AdminActor = { uid: string; name: string; level: 'PRIMARY' | 'STANDARD' };

const sendApiError = (res: Response, status: number, message: string) => {
  res.status(status).json({ error: message, code: String(status) });
};

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return sendApiError(res, 401, "Authentification requise");
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const profile = await adminDb.collection('users').doc(decoded.uid).get();
    if (profile.data()?.status === 'BANNED') return sendApiError(res, 403, 'Ce compte est banni. Contactez Haven pour toute question.');
    req.user = { uid: decoded.uid, email: decoded.email };
    next();
  } catch {
    return sendApiError(res, 401, "Session invalide ou expirée");
  }
}

async function getAdminActor(req: AuthenticatedRequest): Promise<AdminActor | null> {
  if (!req.user?.uid) return null;
  const profile = await adminDb.collection('users').doc(req.user.uid).get();
  const data = profile.data();
  if (!profile.exists || data?.role !== 'ADMIN') return null;
  const name = [data.firstName, data.lastName].filter(Boolean).join(' ').trim() || data.email || 'Administrateur HAVEN';
  return { uid: req.user.uid, name, level: data.adminLevel === 'PRIMARY' ? 'PRIMARY' : 'STANDARD' };
}

async function requireAdmin(req: AuthenticatedRequest, res: Response): Promise<AdminActor | null> {
  const actor = await getAdminActor(req);
  if (!actor) sendApiError(res, 403, 'Accès administrateur requis');
  return actor;
}

async function requirePrimaryAdmin(req: AuthenticatedRequest, res: Response): Promise<AdminActor | null> {
  const actor = await requireAdmin(req, res);
  if (!actor) return null;
  if (actor.level !== 'PRIMARY') {
    sendApiError(res, 403, 'Accès réservé à l’administrateur principal');
    return null;
  }
  return actor;
}

async function writeAdminAudit(actor: AdminActor, input: {
  action: string;
  category: string;
  targetType: string;
  targetId: string;
  summary: string;
}) {
  const ref = adminDb.collection('admin_audit').doc();
  const collections: Record<string, string> = { USER: 'users', LISTING: 'listings', REPORT: 'reports', INCIDENT: 'incidents', CONTACT_REQUEST: 'contact_requests', LEGAL_DOCUMENT: 'settings' };
  let target = {};
  if (collections[input.targetType] && /^[a-zA-Z0-9_-]{1,200}$/.test(input.targetId)) {
    try {
      const snapshot = await adminDb.collection(collections[input.targetType]).doc(input.targetId).get();
      if (snapshot.exists) target = buildAuditTargetSnapshot(input.targetType, snapshot.data()!);
    } catch (error) { console.error('Audit target lookup unavailable', error); }
  }
  await ref.set({ id: ref.id, actorId: actor.uid, actorName: actor.name, ...input, ...target, createdAt: new Date().toISOString() });
}

const reviewIdForBooking = (bookingId: string) => `stay_${bookingId}`;

async function createAutomaticReviewIfExpired(bookingRef: DocumentReference, now = Date.now()) {
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) return false;
  const booking = bookingSnap.data()!;
  if (booking.status !== 'COMPLETED' || isStayReviewWindowOpen(booking.completedAt, booking.endDate, now)) return false;

  const reviewRef = adminDb.collection('reviews').doc(reviewIdForBooking(bookingRef.id));
  const listingRef = adminDb.collection('listings').doc(booking.listingId);
  const tenantSnap = await adminDb.collection('users').doc(booking.tenantId).get();
  const tenant = tenantSnap.data() || {};
  return adminDb.runTransaction(async transaction => {
    const [freshBookingSnap, existingReview, listingSnap] = await Promise.all([
      transaction.get(bookingRef), transaction.get(reviewRef), transaction.get(listingRef)
    ]);
    if (!freshBookingSnap.exists || existingReview.exists) return false;
    const freshBooking = freshBookingSnap.data()!;
    if (freshBooking.status !== 'COMPLETED' || isStayReviewWindowOpen(freshBooking.completedAt, freshBooking.endDate, now)) return false;
    const createdAt = new Date(now).toISOString();
    const previousCount = Number(listingSnap.data()?.reviewsCount) || 0;
    const previousAverage = Number(listingSnap.data()?.rating) || 0;
    const newCount = previousCount + 1;
    transaction.create(reviewRef, {
      id: reviewRef.id,
      bookingId: bookingRef.id,
      authorId: freshBooking.tenantId,
      authorName: [tenant.firstName, tenant.lastName?.[0] ? `${tenant.lastName[0]}.` : ''].filter(Boolean).join(' ') || 'Locataire',
      authorAvatarUrl: tenant.avatarUrl || '',
      targetId: freshBooking.listingId,
      targetType: 'LISTING',
      rating: 5,
      comment: "Note attribuée automatiquement : aucun avis n'a été publié dans les 7 jours suivant le séjour.",
      isAutomatic: true,
      createdAt,
    });
    if (listingSnap.exists) transaction.update(listingRef, {
      rating: Number(((previousAverage * previousCount + 5) / newCount).toFixed(1)),
      reviewsCount: newCount,
    });
    return true;
  });
}

async function finalizeExpiredStayReviews() {
  const completed = await adminDb.collection('bookings').where('status', '==', 'COMPLETED').get();
  for (const booking of completed.docs) {
    try {
      await createAutomaticReviewIfExpired(booking.ref);
    } catch (error) {
      console.error(`Could not finalize stay review ${booking.id}`, error);
    }
  }
}

function safeReturnUrl(req: Request, pathValue: unknown) {
  const path = typeof pathValue === "string" ? pathValue : "/#/dashboard";
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid return path");
  const configuredOrigin = process.env.APP_ORIGIN?.replace(/\/$/, "");
  const origin = configuredOrigin || `${req.protocol}://${req.get("host")}`;
  return `${origin}${path}`;
}

function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

async function settleBookingPayment(receipt: PaymentReceipt, actorId?: string) {
  const ref = adminDb.collection('bookings').doc(receipt.bookingId);
  const result = await adminDb.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new BookingLifecycleError('Réservation introuvable.', 404);
    const booking = { ...snapshot.data(), id: snapshot.id } as Booking;
    let candidate = booking;
    if (receipt.provider === 'SIMULATION') {
      if (getPaymentMode() !== 'SIMULATION') throw new BookingLifecycleError('La simulation est désactivée.', 403);
      if (actorId !== booking.tenantId) throw new BookingLifecycleError('Accès refusé.', 403);
      if (booking.paymentProvider === 'STRIPE' || booking.stripeSessionId?.startsWith('cs_')) throw new BookingLifecycleError('Cette réservation utilise déjà Stripe.');
      candidate = { ...booking, paymentProvider: 'SIMULATION', checkoutSessionId: simulationSessionId(booking.id) };
    }
    const prepared = preparePaymentConfirmation(candidate, receipt);
    if (prepared.disposition === 'REFUND') return { disposition: 'REFUND' as const, booking };
    if (prepared.disposition === 'DUPLICATE') return { disposition: 'DUPLICATE' as const, booking };
    const [listingSnapshot, tenantSnapshot, accessSnapshot] = await Promise.all([
      transaction.get(adminDb.collection('listings').doc(booking.listingId)),
      transaction.get(adminDb.collection('users').doc(booking.tenantId)),
      transaction.get(adminDb.collection('listing_access').doc(booking.listingId))
    ]);
    const confirmed = { ...booking, ...prepared.bookingUpdate };
    const confirmation = createReservationConfirmation(confirmed, listingSnapshot.data() || {}, tenantSnapshot.data() || {}, accessSnapshot.data()?.timeZone || 'Europe/Paris');
    transaction.create(adminDb.collection('reservation_confirmations').doc(booking.id), confirmation);
    transaction.create(adminDb.collection('documents').doc(confirmation.id), {
      id: confirmation.id, receiptId: booking.id, bookingId: booking.id, userId: booking.tenantId,
      title: confirmation.isTest ? 'Justificatif de simulation du paiement' : 'Justificatif de paiement',
      type: 'RENT_RECEIPT', url: '', createdAt: confirmation.paidAt, listingTitle: confirmation.listingTitle
    });
    for (const kind of ['CONFIRMATION', 'ARRIVAL']) {
      transaction.create(adminDb.collection('reservation_mail_outbox').doc(`${booking.id}-${kind}`), {
        bookingId: booking.id, kind, status: 'PENDING', attempts: 0,
        nextAttemptAt: kind === 'CONFIRMATION' ? confirmation.paidAt : confirmation.instructionsDueAt
      });
    }
    transaction.update(ref, prepared.bookingUpdate);
    transaction.create(adminDb.collection('payments').doc(prepared.payment.id), prepared.payment);
    transaction.set(adminDb.collection('booking_availability').doc(booking.id), prepared.availability);
    transaction.create(adminDb.collection('messages').doc(prepared.message.id), prepared.message);
    return { disposition: 'CONFIRM' as const, booking: { ...booking, ...prepared.bookingUpdate } };
  });
  if (result.disposition === 'CONFIRM') void deliverReservationMail();
  return result;
}

// A durable outbox survives restarts. A transaction lease prevents concurrent workers
// from dispatching the same message; the provider also receives a stable idempotency key.
let mailSweepRunning = false;
async function deliverReservationMail() {
  if (mailSweepRunning) return;
  const provider = getEmailProvider();
  if ('error' in provider) return; // Keep messages queued until the sender is configured.
  mailSweepRunning = true;
  try {
    const due = await adminDb.collection('reservation_mail_outbox').where('nextAttemptAt', '<=', new Date().toISOString()).limit(25).get();
    for (const item of due.docs) {
      const job = await adminDb.runTransaction(async transaction => {
        const fresh = await transaction.get(item.ref);
        const data = fresh.data();
        if (!data?.nextAttemptAt || data.nextAttemptAt > new Date().toISOString()) return null;
        transaction.update(item.ref, { status: 'SENDING', nextAttemptAt: new Date(Date.now() + 5 * 60_000).toISOString() });
        return data;
      });
      if (!job) continue;
      try {
        const [bookingSnap, receiptSnap] = await Promise.all([
          adminDb.collection('bookings').doc(job.bookingId).get(),
          adminDb.collection('reservation_confirmations').doc(job.bookingId).get()
        ]);
        const booking = bookingSnap.data() as Booking | undefined;
        if (!booking || booking.paymentStatus !== 'PAID' || !['CONFIRMED', 'COMPLETED'].includes(booking.status)) {
          await item.ref.update({ status: 'CANCELLED', nextAttemptAt: FieldValue.delete() }); continue;
        }
        const receipt = receiptSnap.data() as ReservationConfirmation;
        if (!receipt?.email) throw new Error('Adresse e-mail du locataire manquante.');
        let instructions: string | undefined;
        if (job.kind === 'ARRIVAL') {
          if (!canReleaseArrivalInstructions(booking, receipt.instructionsDueAt)) {
            await item.ref.update({ status: 'CANCELLED', nextAttemptAt: FieldValue.delete() }); continue;
          }
          if (new Date(booking.endDate).getTime() < Date.now() - 24 * 3600_000) {
            await item.ref.update({ status: 'EXPIRED', nextAttemptAt: FieldValue.delete() }); continue;
          }
          const access = await adminDb.collection('listing_access').doc(booking.listingId).get();
          instructions = access.data()?.instructions?.trim();
          if (!instructions) {
            await item.ref.update({ status: 'WAITING_INSTRUCTIONS', lastError: 'Le propriétaire doit renseigner les consignes d’entrée.', nextAttemptAt: new Date(Date.now() + 15 * 60_000).toISOString() }); continue;
          }
        }
        const mail = confirmationEmail(receipt, instructions);
        const attachment = job.kind === 'CONFIRMATION' ? [{ filename: `${receipt.id}.pdf`, content: await paymentReceiptPdf(receipt) }] : undefined;
        const sent = await provider.resend.emails.send({ from: emailFrom, to: receipt.email, replyTo: emailReplyTo, ...mail, attachments: attachment }, { idempotencyKey: `reservation-${item.id}` });
        if (sent.error) throw new Error(sent.error.message);
        await item.ref.update({ status: 'SENT', sentAt: new Date().toISOString(), providerMessageId: sent.data?.id || '', lastError: FieldValue.delete(), nextAttemptAt: FieldValue.delete() });
      } catch (error) {
        const attempts = (job.attempts || 0) + 1;
        await item.ref.update({ status: 'RETRY', attempts, lastError: error instanceof Error ? error.message : 'Envoi indisponible.', nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 60_000 * 2 ** Math.min(attempts, 6))).toISOString() });
      }
    }
  } catch (error) { console.error('Reservation mail outbox unavailable', error); }
  finally { mailSweepRunning = false; }
}

async function expireBooking(bookingId: string) {
  const ref = adminDb.collection('bookings').doc(bookingId);
  return adminDb.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || !isBookingExpired(snapshot.data() as Booking)) return;
    const booking = snapshot.data() as Booking;
    const now = new Date().toISOString();
    transaction.update(ref, { status: 'CANCELLED', expiredAt: now });
    transaction.set(adminDb.collection('booking_availability').doc(bookingId), {
      id: bookingId, bookingId, listingId: booking.listingId, roomId: booking.roomId,
      startDate: booking.startDate, endDate: booking.endDate, status: 'CANCELLED', updatedAt: now
    });

  });
}
async function expireBookings() {
  try {
    const pending = await adminDb.collection('bookings').where('status', 'in', ['PENDING', 'APPROVED']).get();
    await Promise.all(pending.docs.filter(item => isBookingExpired(item.data() as Booking)).map(item => expireBooking(item.id)));
  } catch (error) { console.error('Booking expiration unavailable', error); }
}

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = 3000;

  // The current UI still uses an inline Tailwind configuration. Keep CSP disabled
  // until Tailwind is bundled, while enabling Helmet's other security headers.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    try { if (getPaymentMode() !== 'STRIPE') return sendApiError(res, 503, 'Stripe est désactivé.'); }
    catch { return sendApiError(res, 503, 'Stripe n’est pas configuré.'); }
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(503).json({ error: "Webhook Stripe non configuré" });
    try {
      const event = getStripe().webhooks.constructEvent(req.body, req.headers["stripe-signature"] as string, webhookSecret);
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const bookingId = session.metadata?.bookingId;
        if (bookingId && session.payment_status === "paid") {
          const result = await settleBookingPayment({ bookingId, sessionId: session.id, provider: 'STRIPE', amountCents: session.amount_total || 0, currency: session.currency || '', isTest: !session.livemode });
          if (result.disposition === 'REFUND') {
            const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
            if (!paymentIntent) throw new Error('Payment intent missing for stale checkout');
            await getStripe().refunds.create({ payment_intent: paymentIntent }, { idempotencyKey: `stale-checkout-${session.id}` });
          }
        }
      }
      return res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook rejected", error);
      return res.status(400).json({ error: "Webhook invalide" });
    }
  });

  app.use(createApiRequestBodyParser());

  app.post('/api/auth/identify', verificationLimiter, async (req, res) => {
    try {
      normalizeAccountIdentifier(req.body?.identifier);
    } catch (error) {
      return sendApiError(res, 422, (error as Error).message);
    }
    try {
      const result = await resolveAccountEntry(req.body.identifier, {
        email: value => adminAuth.getUserByEmail(value),
        phone: value => adminAuth.getUserByPhoneNumber(value)
      });
      // Never return an email, phone or profile belonging to an existing user.
      res.set('Cache-Control', 'no-store');
      return res.json(result);
    } catch (error) {
      console.error('Account identification failed', (error as { code?: string }).code || 'unavailable');
      return sendApiError(res, 503, 'Impossible de vérifier le compte pour le moment. Réessayez dans quelques instants.');
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    let paymentMode: string = 'UNAVAILABLE';
    try { paymentMode = getPaymentMode(); } catch { /* Invalid configuration disables payment. */ }
    res.json({ status: 'ok', env: process.env.NODE_ENV, paymentMode, emailConfigured: !('error' in getEmailProvider()) });
  });

  app.post('/api/bookings', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id, listingId, roomId, startDate, endDate } = req.body || {};
      if (![id, listingId, roomId].every(value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)) ||
          typeof startDate !== 'string' || typeof endDate !== 'string' || !isBookableStay(startDate, endDate)) {
        return sendApiError(res, 422, 'Les informations ou les dates du séjour sont invalides');
      }
      const userRef = adminDb.collection('users').doc(req.user!.uid);
      const listingRef = adminDb.collection('listings').doc(listingId);
      const bookingRef = adminDb.collection('bookings').doc(id);
      const availabilityRef = adminDb.collection('booking_availability').doc(id);
      const createdAt = new Date().toISOString();
      const roomLockRef = adminDb.collection('room_booking_locks').doc(`${listingId}_${roomId}`);
      let createdBooking: Record<string, unknown> | null = null;

      await adminDb.runTransaction(async transaction => {
        const [userSnap, listingSnap, existingBooking, existingAvailability, availabilityQuery] = await Promise.all([
          transaction.get(userRef), transaction.get(listingRef), transaction.get(bookingRef), transaction.get(availabilityRef),
          transaction.get(adminDb.collection('booking_availability').where('listingId', '==', listingId)),
          transaction.get(roomLockRef)
        ]);
        if (!userSnap.exists) throw new Error('COMPTE_INTRouvable');
        const user = userSnap.data()!;
        const isAdminAccount = user.role === 'ADMIN';
        const identityDocument = typeof user.documents?.idCard === 'string' && user.documents.idCard.length > 0;
        const exceptionRecord = hasVerificationException(user) ? await transaction.get(adminDb.collection('verification_exceptions').doc(`USER_${req.user!.uid}`)) : undefined;
        const testException = hasTrustedVerificationException(user, exceptionRecord?.data(), req.user!.uid);
        if (!isAdminAccount && !testException && (user.status !== 'APPROVED' || user.emailVerified !== true || !hasRequiredPhoneNumber(user) || user.identityVerified !== true || !identityDocument)) {
          throw new Error('VERIFICATION_REQUISE');
        }
        if (!listingSnap.exists || listingSnap.data()?.status !== 'APPROVED') throw new Error('LOGEMENT_INDISPONIBLE');
        const listing = listingSnap.data() as import('./types').Listing;
        if (listing.ownerId === req.user!.uid) throw new Error('PROPRE_LOGEMENT');
        const room = listing.rooms?.find((item: Room) => item.id === roomId);
        if (!room || !Number.isFinite(room.pricePerDay) || room.pricePerDay <= 0) throw new Error('CHAMBRE_INVALIDE');
        const nights = countNights(startDate, endDate);
        if (nights < minimumNights(listing.minStay) || nights > 366) throw new Error('DATES_INVALIDES');
        const availability = availabilityQuery.docs.map(item => item.data() as BookingAvailability);
        if (!isRoomAvailableForStay(room, listing, availability, startDate, endDate)) throw new Error('DATES_INDISPONIBLES');
        if (existingBooking.exists || existingAvailability.exists) throw new Error('RESERVATION_EXISTANTE');

        const basePrice = room.pricePerDay * nights;
        const cleaningFee = Number.isFinite(Number(listing.cleaningFee)) ? Math.max(0, Number(listing.cleaningFee)) : 0;
        const platformFee = Math.round(basePrice * 0.15);
        const booking: Booking = {
          id, listingId, listingTitle: listing.title, roomId, roomName: room.name || 'Chambre', tenantId: req.user!.uid,
          ownerId: listing.ownerId, startDate, endDate, status: 'PENDING', basePrice, cleaningFee,
          platformFee, totalPrice: basePrice + cleaningFee + platformFee, createdAt,
          paymentStatus: 'PENDING', bookingMode: 'INSTANT',
          checkInTime: listing.checkInTime || '15:00', checkOutTime: listing.checkOutTime || '11:00',
        };
        transaction.set(roomLockRef, { updatedAt: createdAt });
        transaction.create(bookingRef, booking);
        transaction.create(availabilityRef, {
          id, bookingId: id, listingId, roomId, startDate, endDate, status: 'PENDING', updatedAt: createdAt,
        });
        createdBooking = booking as unknown as Record<string, unknown>;
      });
      return res.status(201).json({ booking: createdBooking });
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      if (reason === 'VERIFICATION_REQUISE') return sendApiError(res, 403, 'La validation manuelle de votre compte et de votre pièce d’identité est requise pour réserver');
      if (reason === 'LOGEMENT_INDISPONIBLE' || reason === 'CHAMBRE_INVALIDE') return sendApiError(res, 404, 'Ce logement ou cette chambre n’est plus disponible');
      if (reason === 'PROPRE_LOGEMENT') return sendApiError(res, 403, 'Vous ne pouvez pas réserver votre propre logement');
      if (reason === 'DATES_INVALIDES') return sendApiError(res, 422, 'Ces dates ne respectent pas la durée minimale ou maximale du séjour');
      if (reason === 'DATES_INDISPONIBLES' || reason === 'RESERVATION_EXISTANTE') return sendApiError(res, 409, 'Ces dates viennent d’être réservées. Choisissez une autre période');
      console.error('Booking request creation failed', error);
      return sendApiError(res, 500, 'La demande de réservation n’a pas pu être enregistrée. Réessayez dans quelques instants');
    }
  });

  app.post('/api/bookings/:bookingId/inventory', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.bookingId);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id) || !req.body?.report) return sendApiError(res, 422, 'État des lieux invalide');
      const ref = adminDb.collection('bookings').doc(id);
      const report = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new BookingLifecycleError('Réservation introuvable', 404);
        const booking = { ...snapshot.data(), id } as Booking;
        const listingSnap = await transaction.get(adminDb.collection('listings').doc(booking.listingId));
        if (!listingSnap.exists) throw new BookingLifecycleError('Logement introuvable', 404);
        const listing = listingSnap.data() as Listing;
        const now = new Date();
        const report = prepareInventoryReport(booking, listing, req.user!.uid, req.body.report, now);
        let details: any = {};
        try { details = JSON.parse(report.comments) || {}; } catch { /* Older forms use plain text. */ }
        const issues: { category: string; subCategory: string; description: string; photo?: string }[] = [];
        if (report.type === 'OUT' && details.incident?.subCategory) issues.push(details.incident);
        if (report.type === 'IN' && Array.isArray(details.nonConformities)) for (const item of details.nonConformities) {
          issues.push({ category: 'État du logement', subCategory: item.clean === false ? 'Ménage non fait' : 'Non-conformité à l’arrivée', description: `${item.area === 'ROOM' ? 'Chambre' : 'Espaces communs'} : ${String(item.comment || 'Non-conformité signalée à l’arrivée').slice(0, 4500)}`, photo: item.photos?.[0] || '' });
        }
        if (issues.length > 3) throw new BookingLifecycleError('Trop de problèmes dans cet état des lieux.', 422);
        const routedIssues = issues.map((issue, index) => routeStayIssue({ ...issue, id: `inc-${report.id}-${index}`, bookingId: id, listingId: booking.listingId, ownerId: booking.ownerId, reporterId: booking.tenantId, createdAt: now.toISOString() }));
        transaction.create(adminDb.collection('inventory').doc(report.id), report);
        for (const issue of routedIssues) {
          if (issue.destination === 'OWNER') transaction.create(adminDb.collection('incidents').doc(issue.incident.id), issue.incident);
          else transaction.create(adminDb.collection('reports').doc(issue.report.id), issue.report);
        }
        const documentId = `doc-${report.id}`;
        transaction.create(adminDb.collection('documents').doc(documentId), {
          id: documentId, userId: booking.tenantId, bookingId: id,
          title: `${report.type === 'IN' ? 'État des lieux d’entrée' : 'État des lieux de sortie'} - ${listing.title}`,
          type: report.type === 'IN' ? 'INVENTORY_IN' : 'INVENTORY_OUT',
          url: '', reportId: report.id, createdAt: now.toISOString(), listingTitle: listing.title
        });
        transaction.update(ref, report.type === 'IN' ? { checkInReportId: report.id } : { checkOutReportId: report.id, status: 'COMPLETED', completedAt: now.toISOString() });
        if (report.type === 'OUT') transaction.set(adminDb.collection('booking_availability').doc(id), {
          id, bookingId: id, listingId: booking.listingId, roomId: booking.roomId,
          startDate: booking.startDate, endDate: booking.endDate, status: 'COMPLETED', updatedAt: now.toISOString()
        });
        return report;
      });
      return res.status(201).json({ report });
    } catch (error) {
      if (error instanceof BookingLifecycleError) return sendApiError(res, error.status, error.message);
      console.error('Inventory submission failed', error);
      return sendApiError(res, 503, 'L’état des lieux n’a pas pu être enregistré. Réessayez.');
    }
  });

  app.post('/api/bookings/:bookingId/complete', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const bookingId = String(req.params.bookingId);
      const bookingRef = adminDb.collection('bookings').doc(bookingId);
      const bookingSnap = await bookingRef.get();
      if (!bookingSnap.exists) return sendApiError(res, 404, 'Réservation introuvable');
      const booking = bookingSnap.data()!;
      if (booking.tenantId !== req.user?.uid) return sendApiError(res, 403, 'Seul le locataire peut terminer ce séjour');
      if (booking.status === 'COMPLETED' && booking.completedAt) return res.json({ completedAt: booking.completedAt });
      if (booking.status !== 'CONFIRMED') return sendApiError(res, 409, 'Seul un séjour confirmé peut être terminé');
      const reportId = typeof booking.checkOutReportId === 'string' ? booking.checkOutReportId : '';
      if (!reportId || (req.body?.checkOutReportId && req.body.checkOutReportId !== reportId)) {
        return sendApiError(res, 409, 'Terminez d’abord l’état des lieux de sortie');
      }
      const reportSnap = await adminDb.collection('inventory').doc(reportId).get();
      const report = reportSnap.data();
      if (!reportSnap.exists || report?.bookingId !== bookingId || report?.tenantId !== req.user.uid || report?.type !== 'OUT') {
        return sendApiError(res, 409, 'L’état des lieux de sortie doit être validé avant de terminer le séjour');
      }
      const completedAt = new Date().toISOString();
      await adminDb.runTransaction(async transaction => {
        const current = await transaction.get(bookingRef);
        if (!current.exists || current.data()?.tenantId !== req.user?.uid) throw new Error('Réservation introuvable ou accès refusé');
        if (current.data()?.status === 'COMPLETED' && current.data()?.completedAt) return;
        if (current.data()?.status !== 'CONFIRMED' || current.data()?.checkOutReportId !== reportId) throw new Error('Le séjour ne peut plus être terminé');
        transaction.update(bookingRef, { status: 'COMPLETED', completedAt });
      });
      const refreshed = await bookingRef.get();
      return res.json({ completedAt: refreshed.data()?.completedAt || completedAt });
    } catch (error) {
      console.error('Booking completion failed', error);
      return sendApiError(res, 500, 'Impossible de terminer le séjour');
    }
  });

  app.post('/api/bookings/:bookingId/review', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const bookingId = String(req.params.bookingId);
      const bookingRef = adminDb.collection('bookings').doc(bookingId);
      const reviewRef = adminDb.collection('reviews').doc(reviewIdForBooking(bookingId));
      const rating = req.body?.rating;
      const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 2000) {
        return sendApiError(res, 422, 'La note ou le commentaire est invalide');
      }
      const [bookingSnap, tenantSnap] = await Promise.all([
        bookingRef.get(), adminDb.collection('users').doc(req.user!.uid).get()
      ]);
      if (!bookingSnap.exists) return sendApiError(res, 404, 'Réservation introuvable');
      const booking = bookingSnap.data()!;
      if (booking.tenantId !== req.user?.uid) return sendApiError(res, 403, 'Seul le locataire peut noter ce séjour');
      if (booking.status !== 'COMPLETED' || !booking.completedAt) return sendApiError(res, 409, 'Le séjour doit être terminé avant de pouvoir être noté');
      if (!isStayReviewWindowOpen(booking.completedAt, booking.endDate)) return sendApiError(res, 409, 'Le délai de 7 jours pour noter ce séjour est écoulé');

      const createdAt = new Date().toISOString();
      const tenant = tenantSnap.data() || {};
      const listingRef = adminDb.collection('listings').doc(booking.listingId);
      await adminDb.runTransaction(async transaction => {
        const [currentBooking, existingReview, listingSnap] = await Promise.all([
          transaction.get(bookingRef), transaction.get(reviewRef), transaction.get(listingRef)
        ]);
        if (!currentBooking.exists || currentBooking.data()?.tenantId !== req.user?.uid || currentBooking.data()?.status !== 'COMPLETED') {
          throw new Error('Séjour non admissible');
        }
        const current = currentBooking.data()!;
        if (!isStayReviewWindowOpen(current.completedAt, current.endDate)) throw new Error('Délai de notation écoulé');
        if (existingReview.exists) throw new Error('Un avis définitif existe déjà pour ce séjour');
        const previousCount = Number(listingSnap.data()?.reviewsCount) || 0;
        const previousAverage = Number(listingSnap.data()?.rating) || 0;
        const newCount = previousCount + 1;
        transaction.create(reviewRef, {
          id: reviewRef.id,
          bookingId,
          authorId: req.user!.uid,
          authorName: [tenant.firstName, tenant.lastName?.[0] ? `${tenant.lastName[0]}.` : ''].filter(Boolean).join(' ') || 'Locataire',
          authorAvatarUrl: tenant.avatarUrl || '',
          targetId: current.listingId,
          targetType: 'LISTING',
          rating,
          comment,
          isAutomatic: false,
          createdAt,
        });
        if (listingSnap.exists) transaction.update(listingRef, {
          rating: Number(((previousAverage * previousCount + rating) / newCount).toFixed(1)),
          reviewsCount: newCount,
        });
      });
      return res.status(201).json({ id: reviewRef.id, bookingId, rating, comment, createdAt, isAutomatic: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('définitif') || message.includes('écoulé') || message.includes('admissible')) return sendApiError(res, 409, message);
      console.error('Stay review creation failed', error);
      return sendApiError(res, 500, 'Impossible d’enregistrer cet avis');
    }
  });

  app.post('/api/reviews/finalize-expired', sensitiveApiLimiter, requireAuth, async (_req: AuthenticatedRequest, res) => {
    try {
      await finalizeExpiredStayReviews();
      return res.json({ finalized: true });
    } catch (error) {
      console.error('Expired stay reviews finalization failed', error);
      return sendApiError(res, 500, 'Impossible de finaliser les avis arrivés à échéance');
    }
  });

  // Administrative accounts are managed server-side so that elevation,
  // revocation and every related decision have a durable audit trail.
  app.get('/api/admin/audit', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = await requirePrimaryAdmin(req, res);
      if (!actor) return;
      const snapshot = await adminDb.collection('admin_audit').orderBy('createdAt', 'desc').limit(250).get();
      return res.json({ entries: snapshot.docs.map(item => item.data()) });
    } catch (error) {
      console.error('Admin audit list failed', error);
      return sendApiError(res, 500, 'Impossible de charger le journal administratif');
    }
  });

  app.post('/api/stay-issues', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    const input = req.body;
    if (!input || !/^[a-zA-Z0-9_-]{1,160}$/.test(input.id || '') || !/^[a-zA-Z0-9_-]{1,160}$/.test(input.bookingId || '')) return sendApiError(res, 422, 'Séjour ou identifiant invalide.');
    try {
      const destination = await adminDb.runTransaction(async transaction => {
        const booking = await transaction.get(adminDb.collection('bookings').doc(input.bookingId));
        if (!booking.exists) throw new Error('Séjour introuvable.');
        const bound = bindStayIssueToBooking(booking.data() as import('./types').Booking, req.user!.uid, { ...input, createdAt: new Date().toISOString() });
        const routed = routeStayIssue(bound);
        const record = routed.destination === 'OWNER' ? routed.incident : routed.report;
        const ref = adminDb.collection(routed.destination === 'OWNER' ? 'incidents' : 'reports').doc(input.id);
        const existing = await transaction.get(ref);
        if (existing.exists) {
          if (existing.data()?.reporterId !== req.user!.uid || existing.data()?.bookingId !== input.bookingId) throw new Error('Identifiant déjà utilisé.');
        } else transaction.create(ref, record);
        return routed.destination;
      });
      return res.json({ destination });
    } catch (error) {
      console.error('Stay issue submission failed', error);
      return sendApiError(res, 422, error instanceof Error ? error.message : 'Impossible de transmettre le problème.');
    }
  });

  app.post('/api/incidents/:incidentId/escalate', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.incidentId);
      if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) return sendApiError(res, 422, 'Incident invalide.');
      const incidentRef = adminDb.collection('incidents').doc(id);
      const reportRef = adminDb.collection('reports').doc(`incident_${id}`);
      const result = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(incidentRef);
        if (!snapshot.exists) throw new IncidentEscalationError('Incident introuvable.', 404);
        const incident = { ...snapshot.data(), id } as import('./types').Incident;
        if (incident.reporterId !== req.user!.uid) throw new IncidentEscalationError('Seul l’auteur de l’incident peut demander l’intervention de Haven.', 403);
        if (incident.escalationReportId) return { reportId: incident.escalationReportId, alreadySent: true };
        const prepared = prepareIncidentEscalation(incident, req.user!.uid, req.body?.reason, reportRef.id);
        const existing = await transaction.get(reportRef);
        if (existing.exists && (existing.data()?.reporterId !== req.user!.uid || existing.data()?.incidentId !== id)) throw new IncidentEscalationError('Un signalement utilise déjà cet identifiant.', 409);
        if (!existing.exists) transaction.create(reportRef, prepared.report);
        transaction.update(incidentRef, prepared.update);
        return { reportId: reportRef.id, alreadySent: existing.exists };
      });
      return res.json(result);
    } catch (error) {
      if (error instanceof IncidentEscalationError) return sendApiError(res, error.status, error.message);
      console.error('Incident escalation failed', error);
      return sendApiError(res, 500, 'Impossible de transmettre la demande à Haven.');
    }
  });

  app.post('/api/incidents/:incidentId/status', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.incidentId);
      if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) return sendApiError(res, 422, 'Incident invalide.');
      const ref = adminDb.collection('incidents').doc(id);
      const result = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new OwnerIncidentError('Incident introuvable.', 404);
        const update = prepareOwnerIncidentUpdate(snapshot.data() as import('./types').Incident, req.user!.uid, req.body?.status, req.body?.ownerNotes ?? '');
        transaction.update(ref, update);
        return update;
      });
      return res.json(result);
    } catch (error) {
      if (error instanceof OwnerIncidentError) return sendApiError(res, error.status, error.message);
      console.error('Owner incident update failed', error);
      return sendApiError(res, 500, 'Impossible de mettre à jour cet incident.');
    }
  });

  app.post('/api/admin/verification-exceptions/:targetType/:targetId', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = await requirePrimaryAdmin(req, res); if (!actor) return;
      const type = String(req.params.targetType); const id = String(req.params.targetId);
      if (!['USER', 'LISTING'].includes(type) || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return sendApiError(res, 422, 'Élément invalide.');
      const ref = adminDb.collection(type === 'USER' ? 'users' : 'listings').doc(id);
      const exceptionRef = adminDb.collection('verification_exceptions').doc(`${type}_${id}`);
      const auditRef = adminDb.collection('admin_audit').doc();
      const result = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new VerificationExceptionError('Élément introuvable.', 404);
        const before = snapshot.data()!;
        const update = prepareVerificationException(type, before, actor, req.body?.mode, req.body?.reason, auditRef.id);
        transaction.update(ref, update);
        transaction.set(exceptionRef, { active: req.body.mode === 'GRANT', subjectId: id, decisionId: auditRef.id, actorId: actor.uid, reason: req.body.reason.trim(), updatedAt: new Date().toISOString() });
        transaction.create(auditRef, {
          id: auditRef.id, actorId: actor.uid, actorName: actor.name,
          action: `${type}_TEST_${req.body.mode === 'GRANT' ? 'APPROVED' : 'REVOKED'}`,
          category: type === 'USER' ? 'ACCOUNT' : 'LISTING', targetType: type, targetId: id,
          ...buildAuditTargetSnapshot(type, before), beforeStatus: before.status || 'PENDING', afterStatus: update.status,
          summary: `${req.body.mode === 'GRANT' ? 'Validation exceptionnelle de test accordée' : 'Dérogation de test retirée'} par l’administrateur principal. Motif : ${req.body.reason.trim()}`,
          createdAt: new Date().toISOString()
        });
        return update;
      });
      return res.json(result);
    } catch (error) {
      if (error instanceof VerificationExceptionError) return sendApiError(res, error.status, error.message);
      console.error('Verification exception failed', error);
      return sendApiError(res, 500, 'Impossible d’enregistrer cette dérogation.');
    }
  });

  app.post('/api/listings/test-create', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const input = req.body?.listing;
      if (!input || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.id || '')) return sendApiError(res, 422, 'Annonce invalide.');
      const ownerRef = adminDb.collection('users').doc(req.user!.uid);
      const listingRef = adminDb.collection('listings').doc(input.id);
      const saved = await adminDb.runTransaction(async transaction => {
        const [profile, exception] = await Promise.all([
          transaction.get(ownerRef), transaction.get(adminDb.collection('verification_exceptions').doc(`USER_${req.user!.uid}`))
        ]);
        if (!profile.exists || !hasTrustedVerificationException(profile.data()!, exception.data(), req.user!.uid)) throw new VerificationExceptionError('Dérogation de test absente ou retirée.', 403);
        const fields = ['id', 'title', 'description', 'city', 'address', 'coordinates', 'type', 'totalRooms', 'availableRooms', 'surface', 'amenities', 'mainPhotoUrl', 'galleryUrls', 'rooms', 'bathrooms', 'minStay', 'cleaningFee', 'bookingMode', 'checkInTime', 'checkOutTime', 'blockedDates'];
        const listing = { ...Object.fromEntries(fields.filter(key => input[key] !== undefined).map(key => [key, input[key]])), ownerId: req.user!.uid, bookingMode: 'INSTANT', status: 'PENDING', rating: 0, reviewsCount: 0, verificationException: null } as import('./types').Listing;
        prepareListingReview(listing, profile.data() as import('./types').User, 'APPROVED', true, undefined, req.user!.uid, undefined, true);
        transaction.create(listingRef, listing);
        return listing;
      });
      return res.status(201).json(saved);
    } catch (error) {
      if (error instanceof VerificationExceptionError || error instanceof ListingReviewError) return sendApiError(res, error.status, error.message);
      console.error('Test listing creation failed', error);
      return sendApiError(res, 500, 'Impossible d’enregistrer cette annonce.');
    }
  });

  app.post('/api/admin/reports/:reportId/status', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = await requireAdmin(req, res); if (!actor) return;
      const id = String(req.params.reportId);
      if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id)) return sendApiError(res, 422, 'Signalement invalide.');
      const ref = adminDb.collection('reports').doc(id);
      const auditRef = adminDb.collection('admin_audit').doc();
      const result = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new ReportFollowUpError('Signalement introuvable.', 404);
        const report = snapshot.data() as import('./types').Report;
        const incidentRef = typeof report.incidentId === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(report.incidentId)
          ? adminDb.collection('incidents').doc(report.incidentId) : null;
        const incidentSnap = incidentRef ? await transaction.get(incidentRef) : undefined;
        const incident = incidentSnap?.exists ? { ...incidentSnap.data(), id: incidentSnap.id } as import('./types').Incident : undefined;
        if (incident && (incident.listingId !== report.targetId || incident.reporterId !== report.reporterId)) throw new ReportFollowUpError('Le signalement ne correspond pas à cet incident.');
        const prepared = prepareReportFollowUp(report, incident, req.body?.status, req.body?.note, req.body?.reviewDate, actor.uid);
        transaction.update(ref, prepared.reportUpdate);
        if (incidentRef && prepared.incidentUpdate) transaction.update(incidentRef, prepared.incidentUpdate);
        transaction.create(auditRef, {
          id: auditRef.id, actorId: actor.uid, actorName: actor.name,
          action: `REPORT_${prepared.reportUpdate.status}`, category: 'REPORT', targetType: 'REPORT', targetId: id,
          ...buildAuditTargetSnapshot('REPORT', report as unknown as Record<string, unknown>), beforeStatus: report.status, afterStatus: prepared.reportUpdate.status,
          summary: `Signalement : ${prepared.reportUpdate.status}.${prepared.reportUpdate.adminNotes ? ` Note : ${prepared.reportUpdate.adminNotes}` : ''}`,
          createdAt: prepared.reportUpdate.updatedAt
        });
        return prepared.reportUpdate;
      });
      return res.json(result);
    } catch (error) {
      if (error instanceof ReportFollowUpError) return sendApiError(res, error.status, error.message);
      console.error('Report follow-up failed', error);
      return sendApiError(res, 500, 'Impossible d’enregistrer le suivi du signalement.');
    }
  });

  app.post('/api/admin/listings/:listingId/review', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const listingId = String(req.params.listingId);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(listingId)) return sendApiError(res, 422, 'Annonce invalide.');
      const listingRef = adminDb.collection('listings').doc(listingId);
      const auditRef = adminDb.collection('admin_audit').doc();
      const result = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(listingRef);
        if (!snapshot.exists) throw new ListingReviewError('Annonce introuvable.', 404);
        const listing = snapshot.data() as import('./types').Listing;
        const owner = typeof listing.ownerId === 'string' && listing.ownerId && !listing.ownerId.includes('/')
          ? await transaction.get(adminDb.collection('users').doc(listing.ownerId)) : undefined;
        const ownerData = owner?.data() as import('./types').User | undefined;
        const ownerException = ownerData && hasVerificationException(ownerData) ? await transaction.get(adminDb.collection('verification_exceptions').doc(`USER_${listing.ownerId}`)) : undefined;
        const update = prepareListingReview(listing, ownerData, req.body?.status, req.body?.reviewed, req.body?.reason, actor.uid, undefined, Boolean(ownerData && hasTrustedVerificationException(ownerData, ownerException?.data(), listing.ownerId)));
        transaction.update(listingRef, update);
        transaction.create(auditRef, {
          id: auditRef.id, actorId: actor.uid, actorName: actor.name,
          action: `LISTING_${update.status}`, category: 'LISTING', targetType: 'LISTING', targetId: listingId,
          ...buildAuditTargetSnapshot('LISTING', listing as unknown as Record<string, unknown>), beforeStatus: listing.status, afterStatus: update.status,
          summary: update.status === 'APPROVED' ? 'Annonce validée après contrôle de la fiche et des photos.' : `Annonce refusée : ${update.rejectionReason}`,
          createdAt: update.reviewedAt
        });
        return update;
      });
      return res.json(result);
    } catch (error) {
      if (error instanceof ListingReviewError) return sendApiError(res, error.status, error.message);
      console.error('Listing review failed', error);
      return sendApiError(res, 500, 'Impossible d’enregistrer la décision sur cette annonce.');
    }
  });

  app.post('/api/admin/users/:userId/moderate', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const userId = String(req.params.userId);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(userId)) return sendApiError(res, 422, 'Utilisateur invalide.');
      const ref = adminDb.collection('users').doc(userId);
      const auditRef = adminDb.collection('admin_audit').doc();
      const result = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new MemberApprovalError('Profil introuvable.', 404);
        const update = prepareMemberModeration(snapshot.data()!, req.body?.status, req.body?.reason, actor.uid);
        transaction.update(ref, update);
        transaction.set(adminDb.collection('verification_exceptions').doc(`USER_${userId}`), { active: false }, { merge: true });
        transaction.create(auditRef, {
          id: auditRef.id, actorId: actor.uid, actorName: actor.name,
          action: `USER_${update.status}`, category: 'ACCOUNT', targetType: 'USER', targetId: userId,
          ...buildAuditTargetSnapshot('USER', snapshot.data()!), beforeStatus: snapshot.data()?.status || 'PENDING', afterStatus: update.status,
          summary: `${update.status === 'BANNED' ? 'Compte banni' : 'Dossier refusé'} : ${update.rejectionReason}`, createdAt: update.moderatedAt
        });
        return update;
      });
      return res.json(result);
    } catch (error) {
      if (error instanceof MemberApprovalError) return sendApiError(res, error.status, error.message);
      console.error('Member moderation failed', error);
      return sendApiError(res, 500, 'Impossible d’enregistrer la décision.');
    }
  });

  app.post('/api/admin/users/:userId/approve', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const userId = String(req.params.userId);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(userId)) return sendApiError(res, 422, 'Utilisateur invalide.');
      if (req.body?.identityReviewed !== true) return sendApiError(res, 422, 'Examinez la pièce d’identité avant de valider le profil.');
      const userRef = adminDb.collection('users').doc(userId);
      const auditRef = adminDb.collection('admin_audit').doc();
      const approval = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(userRef);
        if (!snapshot.exists) throw new MemberApprovalError('Profil introuvable.', 404);
        const update = prepareMemberApproval(snapshot.data()!, actor.uid);
        transaction.update(userRef, update);
        transaction.set(adminDb.collection('verification_exceptions').doc(`USER_${userId}`), { active: false }, { merge: true });
        transaction.create(auditRef, {
          id: auditRef.id, actorId: actor.uid, actorName: actor.name,
          action: 'USER_APPROVED', category: 'ACCOUNT', targetType: 'USER', targetId: userId,
          ...buildAuditTargetSnapshot('USER', snapshot.data()!), beforeStatus: snapshot.data()?.status || 'PENDING', afterStatus: update.status,
          summary: 'Profil et identité validés après examen du dossier par un administrateur.', createdAt: update.approvedAt
        });
        return update;
      });
      return res.json(approval);
    } catch (error) {
      if (error instanceof MemberApprovalError) return sendApiError(res, error.status, error.message);
      console.error('Member approval failed', error);
      return sendApiError(res, 500, 'Impossible de valider le profil pour le moment.');
    }
  });

  app.post('/api/admin/audit', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = await requireAdmin(req, res);
      if (!actor) return;
      const { action, category, targetType, targetId, summary } = req.body || {};
      if (![action, category, targetType, targetId, summary].every(value => typeof value === 'string' && value.trim().length > 0)) {
        return sendApiError(res, 422, 'Entrée de journal invalide');
      }
      await writeAdminAudit(actor, {
        action: action.trim().slice(0, 80),
        category: category.trim().slice(0, 40),
        targetType: targetType.trim().slice(0, 80),
        targetId: targetId.trim().slice(0, 160),
        summary: summary.trim().slice(0, 500)
      });
      return res.status(201).json({ recorded: true });
    } catch (error) {
      console.error('Admin audit write failed', error);
      return sendApiError(res, 500, 'Impossible d’enregistrer l’action administrative');
    }
  });

  app.post('/api/admin/staff', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = await requirePrimaryAdmin(req, res);
      if (!actor) return;
      const email = normalizeEmail(req.body?.email);
      const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
      const lastName = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';
      if (!email || !firstName || !lastName) return sendApiError(res, 422, 'Prénom, nom et adresse e-mail sont requis');

      const candidates = await adminDb.collection('users').where('email', '==', email).limit(2).get();
      if (candidates.empty) return sendApiError(res, 404, 'Ce compte HAVEN doit d’abord être créé par son titulaire');
      const target = candidates.docs[0];
      if (target.id === actor.uid) return sendApiError(res, 409, 'Votre compte est déjà administrateur principal');
      if (target.data().adminLevel === 'PRIMARY') return sendApiError(res, 409, 'Un administrateur principal ne peut pas être modifié ici');

      const now = new Date().toISOString();
      await target.ref.update({
        firstName,
        lastName,
        role: 'ADMIN',
        status: 'APPROVED',
        isVerified: true,
        adminLevel: 'STANDARD',
        adminCreatedBy: actor.uid,
        adminCreatedAt: now
      });
      await writeAdminAudit(actor, {
        action: 'ADMIN_GRANTED', category: 'ADMINISTRATION', targetType: 'USER', targetId: target.id,
        summary: `Accès administrateur accordé à ${firstName} ${lastName} (${email}).`
      });
      return res.status(201).json({ user: { id: target.id, ...target.data(), firstName, lastName, role: 'ADMIN', adminLevel: 'STANDARD' } });
    } catch (error) {
      console.error('Admin creation failed', error);
      return sendApiError(res, 500, 'Impossible de créer l’accès administrateur');
    }
  });

  app.delete('/api/admin/staff/:userId', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const actor = await requirePrimaryAdmin(req, res);
      if (!actor) return;
      const target = await adminDb.collection('users').doc(String(req.params.userId)).get();
      if (!target.exists) return sendApiError(res, 404, 'Compte administrateur introuvable');
      const data = target.data()!;
      if (data.adminLevel === 'PRIMARY' || target.id === actor.uid) return sendApiError(res, 409, 'L’administrateur principal ne peut pas retirer son propre accès');
      if (data.role !== 'ADMIN') return sendApiError(res, 409, 'Ce compte n’est pas administrateur');
      await target.ref.update({ role: 'TENANT', adminLevel: null, adminCreatedBy: null, adminCreatedAt: null });
      await writeAdminAudit(actor, {
        action: 'ADMIN_REVOKED', category: 'ADMINISTRATION', targetType: 'USER', targetId: target.id,
        summary: `Accès administrateur retiré à ${data.firstName || ''} ${data.lastName || ''}`.trim()
      });
      return res.json({ revoked: true });
    } catch (error) {
      console.error('Admin revocation failed', error);
      return sendApiError(res, 500, 'Impossible de retirer l’accès administrateur');
    }
  });

  // Shows only the voluntary public profiles of confirmed tenants whose stay
  // overlaps the dates requested by a signed-in prospective housemate. Contacts,
  // legal identity and payment information never leave the server here.
  app.get("/api/listings/:listingId/housemates", sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const listingId = String(req.params.listingId || "");
      const startDate = typeof req.query.start === "string" ? req.query.start : "";
      const endDate = typeof req.query.end === "string" ? req.query.end : "";
      const roomId = typeof req.query.roomId === "string" ? req.query.roomId : "";
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(listingId) || !isBookableStay(startDate, endDate)) {
        return sendApiError(res, 422, "Dates ou logement invalides");
      }

      const listingSnap = await adminDb.collection("listings").doc(listingId).get();
      if (!listingSnap.exists || listingSnap.data()?.status !== "APPROVED") {
        return sendApiError(res, 404, "Logement introuvable");
      }
      if (!roomId || !listingSnap.data()?.rooms?.some((room: { id?: string }) => room.id === roomId)) {
        return sendApiError(res, 422, "Chambre invalide");
      }

      const bookingsSnapshot = await adminDb.collection("bookings").where("listingId", "==", listingId).get();
      const stay = { viewerId: req.user!.uid, roomId, startDate, endDate };
      const candidates = eligibleHousemateBookings(bookingsSnapshot.docs.map(item => item.data()), stay);

      const uniqueTenantIds = [...new Set(candidates.map(booking => String(booking.tenantId)))];
      const profiles = await Promise.all(uniqueTenantIds.map(async (tenantId): Promise<HousemateProfile | null> => {
        // A stale or malformed profile must not make the whole listing page fail.
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(tenantId)) return null;
        try {
          const snapshot = await adminDb.collection("users").doc(tenantId).get();
          return snapshot.exists ? { ...snapshot.data(), id: tenantId } : null;
        } catch (error) {
          console.warn("Skipping unavailable housemate profile", tenantId, error);
          return null;
        }
      }));
      const profilesById = new Map<string, HousemateProfile>(profiles.filter((profile): profile is HousemateProfile => Boolean(profile))
        .map(profile => [profile.id, profile]));
      const housemates = buildHousematePreviews(candidates, profilesById, stay);

      return res.json({ housemates });
    } catch (error) {
      console.error("Housemate preview failed", error);
      return sendApiError(res, 500, "Impossible de charger les futurs colocataires");
    }
  });

  app.put("/api/users/me/housemate-visibility", sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (typeof req.body?.shareProfileWithHousemates !== "boolean") {
        return sendApiError(res, 422, "Préférence de visibilité invalide");
      }
      const userRef = adminDb.collection("users").doc(req.user!.uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) return sendApiError(res, 404, "Profil introuvable");
      await userRef.update({ shareProfileWithHousemates: req.body.shareProfileWithHousemates });
      return res.json({ shareProfileWithHousemates: req.body.shareProfileWithHousemates });
    } catch (error) {
      console.error("Housemate visibility update failed", error);
      return sendApiError(res, 500, "Impossible de mettre à jour la visibilité du profil");
    }
  });

  // Personal verification details are written by the authenticated server.
  // The deployed client rules may lag the form, and a member must never be
  // able to set their own approval or verification flags.
  app.post("/api/users/me/personal-details", sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const ref = adminDb.collection("users").doc(req.user!.uid);
      await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new Error("Profil introuvable.");
        if (snapshot.data()?.role === "ADMIN") throw new Error("Action indisponible pour un administrateur.");
        const update = preparePersonalDetails(snapshot.data()!, req.body || {});
        if (update) transaction.update(ref, update);
      });
      return res.json({ saved: true });
    } catch (error) {
      if (error instanceof Error && /invalide|confirmé|confirmée|introuvable|administrateur/i.test(error.message)) {
        return sendApiError(res, 422, error.message);
      }
      console.error("Personal details update failed", error);
      return sendApiError(res, 500, "Impossible d’enregistrer les coordonnées pour le moment.");
    }
  });

  app.post("/api/users/me/phone-for-verification", sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const ref = adminDb.collection("users").doc(req.user!.uid);
      await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new Error("Profil introuvable.");
        if (snapshot.data()?.role === "ADMIN") throw new Error("Action indisponible pour un administrateur.");
        const update = preparePhoneForVerification(snapshot.data()!, req.body?.phone);
        if (update) transaction.update(ref, update);
      });
      return res.json({ saved: true });
    } catch (error) {
      if (error instanceof Error && /valide|confirmé|introuvable|administrateur/i.test(error.message)) {
        return sendApiError(res, 422, error.message);
      }
      console.error("Phone preparation failed", error);
      return sendApiError(res, 500, "Impossible d’enregistrer le numéro pour le moment.");
    }
  });

  // Complete email ownership verification after Firebase confirms its action
  // link or a short-lived one-time code is redeemed for the same address.
  app.post("/api/users/me/confirm-email", sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const email = normalizeEmail(req.user?.email);
      const authUser = await adminAuth.getUser(req.user!.uid);
      if (normalizeEmail(authUser.email) !== email) return sendApiError(res, 403, "L’adresse e-mail du compte ne correspond pas à celle vérifiée.");
      if (!canConfirmEmailOwnership(email, authUser.email, authUser.emailVerified, verifiedEmailTickets.get(email) || 0)) {
        return sendApiError(res, 400, "Confirmez le lien reçu par e-mail ou saisissez un code de validation encore valide.");
      }
      const userRef = adminDb.collection("users").doc(req.user!.uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) return sendApiError(res, 404, "Profil introuvable");
      const profile = userSnap.data()!;
      if (normalizeEmail(profile.email) !== email) return sendApiError(res, 409, "L’adresse e-mail du profil ne correspond pas à celle du compte.");
      if (!authUser.emailVerified) await adminAuth.updateUser(req.user!.uid, { emailVerified: true });
      const emailVerifiedAt = new Date().toISOString();
      await userRef.update({
        emailVerified: true,
        emailVerifiedAt,
        isVerified: hasRequiredPhoneNumber(profile) && profile.identityVerified === true
      });
      verifiedEmailTickets.delete(email);
      return res.json({ emailVerified: true, emailVerifiedAt });
    } catch (error) {
      console.error("Email verification completion failed", error);
      return sendApiError(res, 500, "Impossible de confirmer l’adresse e-mail pour le moment.");
    }
  });

  // Firebase Phone Auth links the SMS-verified number to the signed-in
  // account. The server independently checks that Firebase holds that number.
  app.post("/api/users/me/confirm-phone", sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const [authUser, userSnap] = await Promise.all([
        adminAuth.getUser(req.user!.uid),
        adminDb.collection("users").doc(req.user!.uid).get()
      ]);
      if (!userSnap.exists) return sendApiError(res, 404, "Profil introuvable");
      const profile = userSnap.data()!;
      const normalizePhone = (value: unknown) => typeof value === "string" ? normalizePhoneForVerification(value) : "";
      if (!authUser.phoneNumber || normalizePhone(authUser.phoneNumber) !== normalizePhone(profile.phone)) {
        return sendApiError(res, 403, "Le numéro confirmé ne correspond pas au numéro du profil.");
      }
      const phoneVerifiedAt = new Date().toISOString();
      await userSnap.ref.update({
        phoneVerified: true,
        phoneVerifiedAt,
        isVerified: profile.emailVerified === true && profile.identityVerified === true
      });
      return res.json({ phoneVerified: true, phoneVerifiedAt });
    } catch (error) {
      console.error("Phone verification completion failed", error);
      return sendApiError(res, 500, "Impossible de confirmer le numéro de téléphone pour le moment.");
    }
  });

  // Uploading or replacing an identity document always returns the account to
  // manual review. A previously approved account must not stay approved after
  // the evidence supporting that decision changes.
  app.post("/api/users/me/identity-document", sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const dataUrl = typeof req.body?.documentDataUrl === "string" ? req.body.documentDataUrl : "";
      if (!/^data:(image\/(jpeg|png)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
        return sendApiError(res, 422, "Le fichier de pièce d’identité est invalide");
      }
      if (Buffer.byteLength(dataUrl, "utf8") > 850 * 1024) {
        return sendApiError(res, 413, "Le fichier optimisé dépasse la taille autorisée");
      }
      const userRef = adminDb.collection("users").doc(req.user!.uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) return sendApiError(res, 404, "Profil introuvable");
      if (userSnap.data()?.role === "ADMIN") return sendApiError(res, 403, "Un compte administrateur ne peut pas transmettre de dossier de membre");

      await userRef.update({
        "documents.idCard": dataUrl,
        status: "PENDING",
        identityVerified: false,
        verificationException: null,
        isVerified: false,
        idVerifiedAt: null,
        verificationSubmittedAt: null,
        rejectionReason: null
      });
      return res.json({ status: "PENDING", identityVerified: false });
    } catch (error) {
      console.error("Identity document upload failed", error);
      return sendApiError(res, 500, "Impossible d’enregistrer la pièce d’identité");
    }
  });

  // Submitting a dossier only queues it for review. Approval remains an
  // explicit back-office action and cannot be granted by a browser client.
  app.post("/api/users/me/submit-verification", sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const role = req.body?.role;
      if (role !== "TENANT" && role !== "OWNER") {
        return sendApiError(res, 422, "Type de dossier invalide");
      }
      const userRef = adminDb.collection("users").doc(req.user!.uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) return sendApiError(res, 404, "Profil introuvable");

      const profile = userSnap.data()!;
      let termsAcceptance: Record<string, unknown> = {};
      if (profile.legalAccepted !== true) {
        const documents = await adminDb.collection('settings').get();
        const terms = selectAccountTerms(documents.docs.map(document => ({ ...document.data(), id: document.id })) as import('./types').LegalDocument[]);
        try {
          assertAccountTermsConsent(req.body?.acceptTerms, req.body?.termsVersion, terms);
        } catch (error) {
          return sendApiError(res, 422, (error as Error).message);
        }
        termsAcceptance = { legalAccepted: true, legalAcceptedAt: new Date().toISOString(), legalDocumentId: terms!.id, legalVersion: terms!.lastUpdated, legalContentHash: createHash('sha256').update(terms!.content).digest('hex') };
      }
      if (!isVerificationReadyToSubmit(profile)) {
        if (profile.emailVerified !== true) {
          return sendApiError(res, 422, "Confirmez votre adresse e-mail avant d’envoyer le dossier.");
        }
        if (!hasCompleteVerificationDetails(profile)) {
          return sendApiError(res, 422, "Complétez votre prénom, votre nom, votre date de naissance et votre téléphone avant d’envoyer le dossier.");
        }
        return sendApiError(res, 422, "La pièce d’identité doit être transmise");
      }

      const verificationSubmittedAt = new Date().toISOString();
      await userRef.update({ status: "PENDING", verificationException: null, verificationSubmittedAt, rejectionReason: null, ...termsAcceptance });
      return res.json({ status: "PENDING", verificationSubmittedAt });
    } catch (error) {
      console.error("Verification submission error", error);
      return sendApiError(res, 500, "Impossible de transmettre le dossier");
    }
  });

  // API route for sending verification email
  app.post("/api/send-verification", verificationLimiter, async (req, res) => {
    const email = normalizeEmail(req.body.email);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Adresse e-mail invalide" });
    }
    const provider = getEmailProvider();
    if ("error" in provider) return sendApiError(res, 503, provider.error);
    const previous = verificationCodes.get(email);
    if (previous && Date.now() - previous.lastSentAt < 60_000) return res.status(429).json({ error: "Veuillez attendre avant de renvoyer un code" });
    const code = randomInt(1000, 10000).toString();
    verificationCodes.set(email, { hash: hashCode(email, code), expiresAt: Date.now() + 10 * 60_000, attempts: 0, lastSentAt: Date.now() });

    try {
      const { data, error } = await provider.resend.emails.send({
        from: emailFrom,
        to: [email],
        ...(emailReplyTo ? { replyTo: emailReplyTo } : {}),
        subject: "Votre code de vérification Haven",
        html: `
          <div style="background:#f7f7f5;padding:32px 16px;font-family:Arial,sans-serif;color:#1e293b;">
            <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:36px 32px;">
              <p style="margin:0 0 20px;font-weight:700;font-size:24px;color:#17253b;">Haven</p>
              <h1 style="font-size:24px;margin:0 0 16px;color:#17253b;">Confirmez votre adresse e-mail</h1>
              <p style="line-height:1.6;margin:0 0 20px;">Voici votre code de vérification pour finaliser votre inscription sur Haven&nbsp;:</p>
              <div style="background:#f4f1ef;padding:20px;border-radius:12px;text-align:center;font-size:32px;font-weight:700;letter-spacing:6px;margin:20px 0;color:#17253b;">
              ${code}
              </div>
              <p style="font-size:14px;line-height:1.5;color:#64748b;margin:20px 0 0;">Ce code expire dans 10 minutes. Si vous n’avez pas demandé cette inscription, vous pouvez ignorer cet e-mail.</p>
            </div>
          </div>
        `,
      });
      
      if (error) {
        console.error("Resend error:", error);
        verificationCodes.delete(email);
        
        // A sandbox can be useful locally, but production must never claim an email was sent when it was not.
        if (!isProduction && (error.name === 'validation_error' || error.message.includes('authorized'))) {
          console.warn("Resend sandbox limitation detected; development verification code was not delivered.");
          return res.json({ 
            success: true, 
            data: { id: "development_mock" },
            warning: "Mode développement : l’e-mail n’a pas été distribué."
          });
        }
        
        return sendApiError(res, 503, "Le service d’envoi d’e-mails est temporairement indisponible.");
      }

      res.json({ success: true, data });
    } catch (err: any) {
      console.error("Server error:", err);
      verificationCodes.delete(email);
      sendApiError(res, 503, "Le service d’envoi d’e-mails est temporairement indisponible.");
    }
  });

  app.post("/api/verify-code", verificationLimiter, (req, res) => {
    const email = normalizeEmail(req.body.email);
    const code = typeof req.body.code === "string" ? req.body.code : "";
    const entry = verificationCodes.get(email);
    if (!entry || entry.expiresAt < Date.now() || entry.attempts >= 5) {
      verificationCodes.delete(email);
      return res.status(400).json({ error: "Code invalide ou expiré" });
    }
    entry.attempts += 1;
    const candidate = hashCode(email, code);
    if (!timingSafeEqual(candidate, entry.hash)) return res.status(400).json({ error: "Code invalide ou expiré" });
    verificationCodes.delete(email);
    verifiedEmailTickets.set(email, Date.now() + 10 * 60_000);
    return res.json({ success: true });
  });

  // Cancellations are deliberately handled by the server: the applicable
  // policy, refund and release of availability must form one audited action.
  app.post("/api/bookings/:bookingId/cancel", sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const bookingId = String(req.params.bookingId || "");
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().replace(/\s+/g, " ") : "";
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(bookingId)) return sendApiError(res, 422, "Réservation invalide");
      if (reason.length < 3 || reason.length > 500) return sendApiError(res, 422, "Indiquez un motif d’annulation entre 3 et 500 caractères");

      const bookingRef = adminDb.collection("bookings").doc(bookingId);
      const bookingSnap = await bookingRef.get();
      if (!bookingSnap.exists) return sendApiError(res, 404, "Réservation introuvable");
      const booking = bookingSnap.data()!;
      const actor = booking.tenantId === req.user?.uid ? "TENANT" : booking.ownerId === req.user?.uid ? "OWNER" : null;
      if (!actor || (actor === "OWNER" && !isOwnerBookingVisible(booking as Booking))) return sendApiError(res, 403, "Accès refusé");

      const terms = getCancellationTerms(booking as Pick<Booking, 'status' | 'startDate' | 'totalPrice' | 'paymentStatus'>, actor);
      if (!terms.canCancel) return sendApiError(res, 409, terms.detail);

      let refundStatus: "NOT_REQUIRED" | "SIMULATED" | "COMPLETED" = "NOT_REQUIRED";
      let refundId: string | undefined;
      const shouldRefund = booking.paymentStatus === "PAID" && terms.refundAmount > 0;
      if (shouldRefund) {
        const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
        const isStripeConfigured = Boolean(stripeKey && stripeKey !== "YOUR_STRIPE_SECRET_KEY" && !stripeKey.includes("***") && stripeKey.length >= 15);
        if (booking.paymentProvider === "SIMULATION" || booking.stripeSessionId?.startsWith("mock_")) {
          refundStatus = "SIMULATED";
          refundId = `mock_refund_${bookingId}_${Date.now()}`;
        } else if (!isStripeConfigured) {
          return sendApiError(res, 503, "Le remboursement Stripe est indisponible. Votre réservation reste active.");
        } else if (!booking.stripeSessionId) {
          return sendApiError(res, 503, "Le paiement d’origine est introuvable. Contactez HAVEN avec la référence de réservation.");
        } else {
          const session = await getStripe().checkout.sessions.retrieve(booking.stripeSessionId);
          const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
          if (!paymentIntent) return sendApiError(res, 503, "Le paiement d’origine est introuvable. Contactez HAVEN avec la référence de réservation.");
          const refund = await getStripe().refunds.create({
            payment_intent: paymentIntent,
            amount: Math.round(terms.refundAmount * 100),
            metadata: { bookingId, cancelledBy: actor },
          });
          refundStatus = "COMPLETED";
          refundId = refund.id;
        }
      }

      const cancelledAt = new Date().toISOString();
      const messageId = `m-cancel-${bookingId}-${Date.now()}`;
      const cancellation = {
        cancelledAt,
        cancelledBy: actor,
        reason,
        refundPercent: terms.refundPercent,
        refundAmount: terms.refundAmount,
        refundStatus,
        ...(refundId ? { refundId } : {}),
      };

      await adminDb.runTransaction(async transaction => {
        const freshSnap = await transaction.get(bookingRef);
        if (!freshSnap.exists || freshSnap.data()?.status !== booking.status) throw new Error("BOOKING_STATUS_CHANGED");
        transaction.update(bookingRef, { status: "CANCELLED", cancellation });
        transaction.set(adminDb.collection("booking_availability").doc(bookingId), {
          id: bookingId,
          bookingId,
          listingId: booking.listingId,
          roomId: booking.roomId,
          startDate: booking.startDate,
          endDate: booking.endDate,
          status: "CANCELLED",
          updatedAt: cancelledAt,
        });
        if (terms.refundAmount > 0) {
          const paymentId = (refundId || `refund_${bookingId}_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
          transaction.set(adminDb.collection("payments").doc(paymentId), {
            id: paymentId,
            bookingId,
            listingId: booking.listingId,
            ownerId: booking.ownerId,
            tenantId: booking.tenantId,
            amount: terms.refundAmount,
            status: "REFUNDED",
            type: "REFUND",
            createdAt: cancelledAt,
          });
        }
        const receiverId = actor === "TENANT" ? booking.ownerId : booking.tenantId;
        const refundText = terms.refundAmount > 0
          ? ` Le remboursement prévu est de ${terms.refundAmount} € (${terms.refundPercent} %).`
          : " Aucun remboursement n’est prévu selon les conditions d’annulation.";
        if (booking.paymentStatus === "PAID") transaction.set(adminDb.collection("messages").doc(messageId), {
          id: messageId,
          senderId: req.user!.uid,
          receiverId,
          bookingId,
          content: `La réservation de la chambre \"${booking.roomName || "Chambre"}\" a été annulée. Motif : ${reason}.${refundText}`,
          timestamp: cancelledAt,
          isRead: false,
          participants: [booking.tenantId, booking.ownerId],
        });
      });

      return res.json({ success: true, cancellation, status: "CANCELLED" });
    } catch (error) {
      if (error instanceof Error && error.message === "BOOKING_STATUS_CHANGED") return sendApiError(res, 409, "Cette réservation vient d’être modifiée. Actualisez la page avant de réessayer.");
      console.error("Booking cancellation failed", error);
      return sendApiError(res, 503, "L’annulation n’a pas pu être finalisée. Vos données n’ont pas été modifiées.");
    }
  });

  // API route for sending booking notification emails
  app.post("/api/send-booking-notification", sensitiveApiLimiter, requireAuth, async (req, res) => {
    const { email, type, details } = req.body;
    if (type === 'PAYMENT_CONFIRMED') return sendApiError(res, 410, 'La confirmation est envoyée automatiquement après paiement.');
    if (type === 'REQUEST_SUBMITTED' || type === 'REQUEST_APPROVED') return sendApiError(res, 410, 'La réservation est désormais confirmée directement après paiement.');

    if (!email || !type || !details) {
      return res.status(400).json({ error: "Email, type, and details are required" });
    }

    const bookingId = typeof details.bookingId === "string" ? details.bookingId : "";
    const bookingSnap = bookingId ? await adminDb.collection("bookings").doc(bookingId).get() : null;
    if (!bookingSnap?.exists) return res.status(404).json({ error: "Réservation introuvable" });
    const booking = bookingSnap.data()!;
    if (type === 'PAYMENT_CONFIRMED' && (booking.paymentStatus !== 'PAID' || booking.status !== 'CONFIRMED')) return sendApiError(res, 409, 'Le paiement de cette réservation n’est pas confirmé.');
    const callerId = (req as AuthenticatedRequest).user?.uid;
    if (callerId !== booking.tenantId && callerId !== booking.ownerId) return res.status(403).json({ error: "Accès refusé" });
    const [tenantSnap, ownerSnap] = await Promise.all([
      adminDb.collection("users").doc(booking.tenantId).get(),
      adminDb.collection("users").doc(booking.ownerId).get()
    ]);
    const allowedEmails = (booking.paymentStatus === "PAID" ? [tenantSnap.data()?.email, ownerSnap.data()?.email] : [tenantSnap.data()?.email]).filter(Boolean);
    if (!allowedEmails.includes(normalizeEmail(email))) return res.status(403).json({ error: "Destinataire non autorisé" });

    const provider = getEmailProvider();
    if ("error" in provider) {
      if (!isProduction) {
        console.info("Notification e-mail non distribuée en mode développement.", { type, bookingId });
        return res.json({ success: true, mocked: true, message: "Mode développement : l’e-mail n’a pas été distribué." });
      }
      return sendApiError(res, 503, provider.error);
    }

    try {
      let subject = "";
      let htmlContent = "";

      const { listingTitle, roomName, amount, startDate, endDate, tenantName, ownerName, bookingId } = details;

      if (type === "REQUEST_SUBMITTED") {
        subject = `Nouvelle demande de colocation - HAVEN`;
        htmlContent = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 20px; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #A34343; font-size: 28px; font-weight: bold; margin: 0;">HAVEN</h1>
              <p style="text-transform: uppercase; font-size: 10px; color: #9ca3af; letter-spacing: 2px; margin-top: 5px;">Nouvelle Demande de Réservation</p>
            </div>
            <p>Bonjour <strong>${ownerName || 'Propriétaire'}</strong>,</p>
            <p>Vous avez reçu une nouvelle demande de colocation pour votre logement <strong>${listingTitle}</strong> (Chambre: <strong>${roomName || 'Chambre'}</strong>).</p>
            
            <div style="background-color: #f8fafc; padding: 25px; border-radius: 16px; margin: 25px 0;">
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Locataire :</td>
                  <td style="padding: 6px 0; text-align: right; color: #0f172a; font-weight: bold;">${tenantName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Période :</td>
                  <td style="padding: 6px 0; text-align: right; color: #0f172a; font-weight: bold;">${startDate} au ${endDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Arrivée / départ :</td>
                  <td style="padding: 6px 0; text-align: right; color: #0f172a; font-weight: bold;">à partir de ${booking.checkInTime || '15:00'} / avant ${booking.checkOutTime || '11:00'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Tarif total :</td>
                  <td style="padding: 6px 0; text-align: right; color: #A34343; font-weight: bold; font-size: 16px;">${amount}€</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; font-size: 14px; color: #b45309; border-radius: 8px; margin-bottom: 25px;">
              ⚠️ Vous disposez de <strong>24 heures</strong> pour accepter ou refuser cette demande à partir de votre tableau de bord. Passé ce délai, la demande expirera automatiquement.
            </div>

            <div style="text-align: center; margin: 35px 0;">
              <a href="${req.headers.origin || 'http://localhost:3000'}/#/owner/dashboard" style="background-color: #0c1c2a; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Accéder à mon Tableau de Bord</a>
            </div>

            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
              Cet email a été envoyé automatiquement par HAVEN. Merci de ne pas y répondre directement.
            </p>
          </div>
        `;
      } else if (type === "REQUEST_APPROVED") {
        subject = `Votre demande a été acceptée ! Finalisez votre réservation - HAVEN`;
        htmlContent = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 20px; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #A34343; font-size: 28px; font-weight: bold; margin: 0;">HAVEN</h1>
              <p style="text-transform: uppercase; font-size: 10px; color: #9ca3af; letter-spacing: 2px; margin-top: 5px;">Demande Acceptée - En attente de paiement</p>
            </div>
            <p>Bonjour <strong>${tenantName || 'Locataire'}</strong>,</p>
            <p>Bonne nouvelle ! Le propriétaire <strong>${ownerName}</strong> a accepté votre demande de réservation pour le logement <strong>${listingTitle}</strong> (Chambre: <strong>${roomName || 'Chambre'}</strong>).</p>
            
            <div style="background-color: #f8fafc; padding: 25px; border-radius: 16px; margin: 25px 0;">
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Période :</td>
                  <td style="padding: 6px 0; text-align: right; color: #0f172a; font-weight: bold;">${startDate} au ${endDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Montant total :</td>
                  <td style="padding: 6px 0; text-align: right; color: #A34343; font-weight: bold; font-size: 16px;">${amount}€</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; font-size: 14px; color: #1d4ed8; border-radius: 8px; margin-bottom: 25px;">
              ⏳ Vous disposez de <strong>24 heures</strong> pour finaliser le paiement sur votre tableau de bord afin de bloquer définitivement votre place. Passé ce délai, votre place sera libérée.
            </div>

            <div style="text-align: center; margin: 35px 0;">
              <a href="${req.headers.origin || 'http://localhost:3000'}/#/dashboard" style="background-color: #A34343; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Procéder au Paiement Sécurisé</a>
            </div>

            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
              Cet email a été envoyé automatiquement par HAVEN. Merci de ne pas y répondre directement.
            </p>
          </div>
        `;
      } else if (type === "PAYMENT_CONFIRMED") {
        subject = `Réservation confirmée ! Bienvenue chez HAVEN 🎉`;
        htmlContent = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 20px; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #A34343; font-size: 28px; font-weight: bold; margin: 0;">HAVEN</h1>
              <p style="text-transform: uppercase; font-size: 10px; color: #10b981; letter-spacing: 2px; margin-top: 5px;">Réservation Confirmée</p>
            </div>
            <p>Bonjour <strong>${tenantName}</strong>,</p>
            <p>🎉 C'est officiel ! Votre paiement de <strong>${amount}€</strong> a été validé. Votre réservation pour le logement <strong>${listingTitle}</strong> (Chambre: <strong>${roomName || 'Chambre'}</strong>) est définitivement sécurisée.</p>
            
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 16px; margin: 25px 0; border: 1px solid #bbf7d0;">
              <h3 style="color: #15803d; margin-top: 0; font-size: 16px;">Détails du Séjour</h3>
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #166534; font-weight: 500;">Période :</td>
                  <td style="padding: 6px 0; text-align: right; color: #166534; font-weight: bold;">${startDate} au ${endDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #166534; font-weight: 500;">Hôte :</td>
                  <td style="padding: 6px 0; text-align: right; color: #166534; font-weight: bold;">${ownerName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #166534; font-weight: 500;">Statut :</td>
                  <td style="padding: 6px 0; text-align: right; color: #15803d; font-weight: bold;">Signé & Confirmé</td>
                </tr>
              </table>
            </div>

            <p>Vous pouvez dès à présent communiquer avec votre propriétaire via la messagerie HAVEN pour organiser votre arrivée.</p>

            <div style="text-align: center; margin: 35px 0;">
              <a href="${req.headers.origin || 'http://localhost:3000'}/#/dashboard" style="background-color: #0c1c2a; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Consulter mon Espace Locataire</a>
            </div>

            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
              Cet email a été envoyé automatiquement par HAVEN. Merci de ne pas y répondre directement.
            </p>
          </div>
        `;
      } else if (type === "BOOKING_CANCELLED") {
        subject = `Demande de réservation expirée ou déclinée - HAVEN`;
        htmlContent = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 20px; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #A34343; font-size: 28px; font-weight: bold; margin: 0;">HAVEN</h1>
              <p style="text-transform: uppercase; font-size: 10px; color: #ef4444; letter-spacing: 2px; margin-top: 5px;">Demande Libérée</p>
            </div>
            <p>Bonjour <strong>${tenantName}</strong>,</p>
            <p>La demande de réservation pour le logement <strong>${listingTitle}</strong> (Chambre: <strong>${roomName || 'Chambre'}</strong>) du ${startDate} au ${endDate} a expiré ou a été déclinée.</p>
            <p>Les dates ont été libérées de notre système. N'hésitez pas à parcourir d'autres offres de colocation courte durée disponibles sur notre portail.</p>

            <div style="text-align: center; margin: 35px 0;">
              <a href="${req.headers.origin || 'http://localhost:3000'}/#/search" style="background-color: #A34343; color: #ffffff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block;">Trouver un autre logement</a>
            </div>

            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
              Cet email a été envoyé automatiquement par HAVEN. Merci de ne pas y répondre directement.
            </p>
          </div>
        `;
      }

      const { error } = await provider.resend.emails.send({
        from: emailFrom,
        to: [email],
        ...(emailReplyTo ? { replyTo: emailReplyTo } : {}),
        subject: subject,
        html: htmlContent
      });

      if (error) {
        console.error("Booking email provider error:", error);
        return sendApiError(res, 503, "Le service d’envoi d’e-mails est temporairement indisponible.");
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Booking email send failed:", err);
      if (!isProduction) return res.json({ success: true, mocked: true, message: "Mode développement : l’e-mail n’a pas été distribué." });
      return sendApiError(res, 503, "Le service d’envoi d’e-mails est temporairement indisponible.");
    }
  });

  app.get('/api/bookings/:bookingId/confirmation', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.bookingId);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return sendApiError(res, 422, 'Réservation invalide.');
      const [snapshot, bookingSnapshot] = await Promise.all([adminDb.collection('reservation_confirmations').doc(id).get(), adminDb.collection('bookings').doc(id).get()]);
      const booking = bookingSnapshot.data() as Booking | undefined;
      if (!booking || ![booking.tenantId, booking.ownerId].includes(req.user!.uid)) return sendApiError(res, 403, 'Accès refusé.');
      if (!snapshot.exists) return sendApiError(res, 404, 'Le justificatif est disponible pour les paiements confirmés après cette mise à jour.');
      const receipt = snapshot.data() as ReservationConfirmation;
      res.setHeader('Cache-Control', 'no-store');
      if (req.query.format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${receipt.id}.pdf"`);
        return res.send(await paymentReceiptPdf(receipt));
      }
      const jobs = await Promise.all(['CONFIRMATION', 'ARRIVAL'].map(kind => adminDb.collection('reservation_mail_outbox').doc(`${id}-${kind}`).get()));
      let instructions = '';
      if (canReleaseArrivalInstructions(booking, receipt.instructionsDueAt)) {
        const access = await adminDb.collection('listing_access').doc(booking.listingId).get();
        instructions = access.data()?.instructions || '';
      }
      return res.json({ ...receipt, bookingStatus: booking.status, instructions, emailStatus: jobs[0].data()?.status || 'PENDING', arrivalEmailStatus: jobs[1].data()?.status || 'PENDING', emailConfigured: !('error' in getEmailProvider()) });
    } catch { return sendApiError(res, 503, 'Les informations du séjour sont indisponibles.'); }
  });

  // Access codes and key handover details never belong in publicly readable listings.
  app.all('/api/listings/:listingId/access-instructions', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.listingId);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return sendApiError(res, 422, 'Logement invalide.');
      const listing = await adminDb.collection('listings').doc(id).get();
      if (!listing.exists || (listing.data()?.ownerId !== req.user!.uid && !await getAdminActor(req))) return sendApiError(res, 403, 'Accès refusé.');
      const ref = adminDb.collection('listing_access').doc(id);
      res.setHeader('Cache-Control', 'no-store');
      if (req.method === 'GET') { const data = (await ref.get()).data(); return res.json({ instructions: data?.instructions || '', timeZone: data?.timeZone || 'Europe/Paris' }); }
      if (req.method !== 'PUT') return sendApiError(res, 405, 'Méthode non autorisée.');
      if (typeof req.body.instructions !== 'string' || req.body.instructions.length > 6000) return sendApiError(res, 422, 'Consignes invalides (6 000 caractères maximum).');
      const timeZone = req.body.timeZone || 'Europe/Paris';
      try { new Intl.DateTimeFormat('fr-FR', { timeZone }).format(); } catch { return sendApiError(res, 422, 'Fuseau horaire invalide.'); }
      await ref.set({ timeZone, instructions: req.body.instructions.trim(), updatedAt: new Date().toISOString(), updatedBy: req.user!.uid });
      return res.json({ success: true });
    } catch { return sendApiError(res, 503, 'Impossible d’enregistrer les consignes.'); }
  });

  app.get('/api/payments/:bookingId', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.bookingId);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return sendApiError(res, 422, 'Réservation invalide.');
      const snapshot = await adminDb.collection('bookings').doc(id).get();
      if (!snapshot.exists) return sendApiError(res, 404, 'Réservation introuvable.');
      const booking = { ...snapshot.data(), id } as Booking;
      if (booking.tenantId !== req.user!.uid) return sendApiError(res, 403, 'Ce paiement est réservé au locataire de la réservation.');
      const mode = getPaymentMode();
      if (booking.status === 'CANCELLED') throw new BookingLifecycleError('Cette réservation a été annulée.');
      if (booking.paymentStatus !== 'PAID') assertBookingPayable(booking, req.user!.uid);
      const [listing, customer] = await Promise.all([
        adminDb.collection('listings').doc(booking.listingId).get(), adminDb.collection('users').doc(booking.tenantId).get()
      ]);
      const profile = customer.data();
      res.set('Cache-Control', 'no-store');
      return res.json({ mode, booking, expiresAt: bookingDeadline(booking), listing: { title: booking.listingTitle || listing.data()?.title || 'Votre logement', city: listing.data()?.city || '', image: listing.data()?.mainPhotoUrl || '' }, customer: { name: [profile?.firstName, profile?.lastName].filter(Boolean).join(' '), email: profile?.email || '' } });
    } catch (error) {
      if (error instanceof BookingLifecycleError || error instanceof PaymentConfigurationError) return sendApiError(res, error.status, error.message);
      console.error('Checkout details failed', error);
      return sendApiError(res, 503, 'Le récapitulatif du paiement est momentanément indisponible.');
    }
  });

  app.post('/api/payments/:bookingId/simulate', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (getPaymentMode() !== 'SIMULATION') return sendApiError(res, 403, 'La simulation de paiement est désactivée.');
      const id = String(req.params.bookingId);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return sendApiError(res, 422, 'Réservation invalide.');
      const snapshot = await adminDb.collection('bookings').doc(id).get();
      if (!snapshot.exists) return sendApiError(res, 404, 'Réservation introuvable.');
      const booking = snapshot.data() as Booking;
      if (booking.tenantId !== req.user!.uid) return sendApiError(res, 403, 'Accès refusé.');
      const result = await settleBookingPayment({ bookingId: id, sessionId: simulationSessionId(id), provider: 'SIMULATION', amountCents: Math.round(booking.totalPrice * 100), currency: 'eur', isTest: true }, req.user!.uid);
      if (result.disposition === 'REFUND') return sendApiError(res, 409, 'Cette réservation ne peut plus être confirmée. Recommencez votre réservation.');
      return res.json({ bookingId: id, status: result.booking.status, paidAt: result.booking.paidAt, mode: 'SIMULATION', isTest: true });
    } catch (error) {
      if (error instanceof BookingLifecycleError || error instanceof PaymentConfigurationError) return sendApiError(res, error.status, error.message);
      console.error('Payment simulation failed', error);
      return sendApiError(res, 503, 'La simulation n’a pas pu aboutir. Vous pouvez réessayer sans créer de doublon.');
    }
  });

  app.post("/api/create-checkout-session", sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { bookingId } = req.body || {};
      if (typeof bookingId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(bookingId)) return sendApiError(res, 422, 'Réservation invalide.');
      const mode = getPaymentMode();
      await expireBooking(bookingId);
      const bookingRef = adminDb.collection('bookings').doc(bookingId);
      const snapshot = await bookingRef.get();
      if (!snapshot.exists) return sendApiError(res, 404, 'Réservation introuvable.');
      const booking = snapshot.data() as Booking;
      assertBookingPayable(booking, req.user!.uid);
      if (!isBookableStay(booking.startDate, booking.endDate)) return sendApiError(res, 422, 'La date d’arrivée ne peut pas être antérieure à aujourd’hui.');
      if (mode === 'SIMULATION') return res.json({ mode, url: safeReturnUrl(req, `/#/payment/${encodeURIComponent(bookingId)}`) });
      if (booking.paymentProvider === 'SIMULATION') throw new BookingLifecycleError('Cette réservation appartient au mode simulation. Créez une nouvelle réservation pour utiliser Stripe.');
      const stripe = getStripe();
      if (booking.checkoutSessionId || booking.stripeSessionId) {
        const existing = await stripe.checkout.sessions.retrieve(booking.checkoutSessionId || booking.stripeSessionId!);
        if (existing.status === 'open' && existing.url) return res.json({ mode, id: existing.id, url: existing.url });
        if (existing.payment_status === 'paid') return sendApiError(res, 409, 'Le paiement a déjà été effectué. Sa confirmation est en cours.');
        return sendApiError(res, 409, 'Cette session de paiement est terminée. Recommencez votre réservation.');
      }
      const listingSnap = await adminDb.collection('listings').doc(booking.listingId).get();
      const listing = listingSnap.data();
      if (!listingSnap.exists) return sendApiError(res, 404, 'Logement introuvable.');
      const successUrl = safeReturnUrl(req, `/?booking=pending&id=${encodeURIComponent(bookingId)}#/dashboard`);
      const cancelUrl = safeReturnUrl(req, `/#/payment/${encodeURIComponent(bookingId)}?cancelled=1`);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment', payment_method_types: ['card'], locale: 'fr', client_reference_id: bookingId,
        // Stable across retries with the same idempotency key. The checkout starts within the initial 30-minute hold.
        expires_at: Math.floor(Date.parse(booking.createdAt) / 1000) + 60 * 60,
        line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: Math.round(booking.totalPrice * 100), product_data: { name: String(booking.listingTitle || listing?.title || 'Séjour HAVEN').slice(0, 200), description: `${booking.roomName || 'Chambre'} · ${booking.startDate} → ${booking.endDate}` } } }],
        success_url: successUrl, cancel_url: cancelUrl,
        metadata: { bookingId, listingId: booking.listingId, tenantId: booking.tenantId }
      }, { idempotencyKey: `checkout-${bookingId}` });
      await adminDb.runTransaction(async transaction => {
        const fresh = await transaction.get(bookingRef);
        if (!fresh.exists) throw new BookingLifecycleError('Réservation introuvable.', 404);
        assertBookingPayable(fresh.data() as Booking, req.user!.uid);
        transaction.update(bookingRef, { paymentProvider: 'STRIPE', checkoutSessionId: session.id, stripeSessionId: session.id, checkoutExpiresAt: new Date(session.expires_at * 1000).toISOString() });
      });
      return res.json({ mode, id: session.id, url: session.url });
    } catch (error) {
      if (error instanceof BookingLifecycleError || error instanceof PaymentConfigurationError) return sendApiError(res, error.status, error.message);
      console.error('Stripe checkout failed', (error as { type?: string }).type || 'unavailable');
      return sendApiError(res, 503, 'Le paiement est momentanément indisponible. Aucun paiement simulé n’a été effectué.');
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // Run a catch-up sweep at startup and hourly. The authenticated history read
  // also triggers the same idempotent sweep so downtime never loses a rating.
  void deliverReservationMail();
  const reservationMailSweep = setInterval(() => void deliverReservationMail(), 30_000);
  reservationMailSweep.unref();
  void expireBookings();
  const bookingSweep = setInterval(() => void expireBookings(), 60_000);
  bookingSweep.unref();
  void finalizeExpiredStayReviews();
  const reviewSweep = setInterval(() => void finalizeExpiredStayReviews(), 60 * 60 * 1000);
  reviewSweep.unref();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite middleware...");
    try {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          hmr: false, // Disable HMR as per guidelines
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware initialized successfully.");
    } catch (e) {
      console.error("Failed to initialize Vite middleware:", e);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
