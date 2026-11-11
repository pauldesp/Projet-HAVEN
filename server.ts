import { createStripeConnect, ConnectError } from './services/stripeConnectServer';
import { createRecurringSeries, SeriesError } from './services/recurringSeriesServer';
import { isLaterSeriesStay } from './services/recurringInstallments';
import { isTeamMailKind, teamAlertMailJob, teamMailDisposition, teamMailRecipient, teamNotificationEmail, teamReportMailJob, teamReportToAnnounce, type TeamMailData, type TeamMailJob } from './services/teamMail';
import { isOwnerMailKind, ownerMailDisposition, ownerMailId, ownerMailJob, ownerNotificationEmail, type OwnerMailData, type OwnerMailJob } from './services/ownerMail';
import { CONTENT_SECURITY_POLICY } from './services/contentSecurityPolicy';
import { createSystemHealth } from './services/systemHealth';
import { buildMemberFile } from './services/memberFile';
import { AdminFinanceError, createAdminFinances } from './services/adminFinancesServer';
import { createAdminModeration } from './services/adminModerationServer';
import { createErrorTracking } from './services/errorTrackingServer';
import { CONNECT_POLICY_VERSION, DEPOSIT_POLICY } from './services/stripeConnect';
import { normalizePlatformFeedback } from './services/platformFeedback';
import { normalizeRoomGuide, normalizeRoomGuides } from './services/roomGuide';
import { CLEANING_POLICY_VERSION, assertCleaningPolicyAccepted } from './services/cleaningPolicy';
import { normalizePracticalInfo, releasedStayGuide, formatStayGuide } from './services/stayGuide';
import { normalizeResidence, hasRequiredResidence, validResidenceDocument } from './services/residence';
import { publicTenantProfile, validateCommunityProfile } from './services/publicProfile';
import { nextAuthMailLimit, sendAuthActionMail, type AuthMailLimit } from './services/authMail';
import { resendTemplatesEnabled, reservationResendTemplate, tenantResendTemplate, ownerResendTemplate, teamResendTemplate, selectMailContent, type ResendTemplate, type AuthMailKind } from './services/resendTemplates';
import { accountDecisionMail, cancellationMail, reviewInvitationMail, isTenantMailKind, isSeriesMailKind, tenantMailDisposition, tenantNotificationEmail, type TenantMailJob, type SeriesMailContext } from './services/tenantMail';
import { canSendReservationRecipient, initialReservationMailJobs, reservationMailJob, reservationMailDisposition, reservationLifecycleEmail, reservationEmailConfiguration, type ReservationMailJob } from './services/reservationMail';
import { stayLocalDate } from './services/inventoryTiming';
import { createReservationConfirmation, canReleaseArrivalInstructions, type ReservationConfirmation } from './services/reservationFulfillment';
import { paymentReceiptPdf } from './services/paymentReceiptPdf';
import { getPaymentMode, getConnectConfiguration, PaymentConfigurationError } from './services/paymentConfiguration';
import { preparePaymentConfirmation, simulationSessionId, type PaymentReceipt } from './services/paymentCheckout';
import { isOwnerBookingVisible } from './services/bookingVisibility';
import { BookingLifecycleError, bookingDeadline, isBookingExpired, assertBookingPayable, prepareInventoryReport, recoverInventoryReport } from './services/bookingLifecycle';
import { hasVerificationException, hasTrustedVerificationException, prepareVerificationException, VerificationExceptionError } from './services/verificationException';
import { countNights, isBookableStay } from './services/stay';
import { getCancellationTerms } from './services/cancellationPolicy';
import { isStayReviewWindowOpen } from './services/reviewPolicy';
import { hasCompleteVerificationDetails, hasRequiredPhoneNumber, isVerificationReadyToSubmit } from './services/profileVerification';
import type { Booking, BookingAvailability, BookingSeries, Incident, Listing, OwnerPayout, Report, Room } from './types';
import { isRoomAvailableForStay, publicAvailabilityItem } from './services/availability';
import { requiredNightsForStay } from './services/gapStay';
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
import { buildHousematePreviews, eligibleHousemateBookings, canViewBookingHousemates } from './services/housemates';
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
import { createHash, randomUUID } from "node:crypto";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

let stripeClient: Stripe | null = null;
const adminApp = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId: firebaseConfig.projectId });
const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
const normalizeEmail = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
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

interface AuthenticatedRequest extends Request { user?: { uid: string; email?: string; authTime?: number } }

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
    req.user = { uid: decoded.uid, email: decoded.email, authTime: decoded.auth_time };
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
  try {
    const completed = await adminDb.collection('bookings').where('status', '==', 'COMPLETED').get();
    for (const booking of completed.docs) {
      try {
        await createAutomaticReviewIfExpired(booking.ref);
      } catch (error) {
        console.error(`Could not finalize stay review ${booking.id}`, error);
      }
    }
    await systemHealth.success('REVIEW_CLOSING');
  } catch (error) { await systemHealth.failure('REVIEW_CLOSING', error); throw error; }
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

const connectConfiguration = () => getConnectConfiguration();

const ownerConnect = createStripeConnect(adminDb, getStripe, connectConfiguration);

/** Health of the background tasks, shown in the back office; 3 failures in a row alert the Haven team. */
const systemHealth = createSystemHealth(adminDb, async health => {
  const job = teamAlertMailJob(health);
  await adminDb.collection('reservation_mail_outbox').doc(`${health.task}-${job.occurredAt.replace(/[^0-9]/g, '')}-HAVEN_ALERT`).set(job);
});

/** Same verification gate as a single booking. Reads only: call it before any transaction write. */
async function assertTenantCanBook(transaction: FirebaseFirestore.Transaction, uid: string) {
  const userSnap = await transaction.get(adminDb.collection('users').doc(uid));
  if (!userSnap.exists) throw new Error('COMPTE_INTRouvable');
  const user = userSnap.data()!;
  if (user.role === 'ADMIN') return;
  const identityDocument = typeof user.documents?.idCard === 'string' && user.documents.idCard.length > 0;
  const exceptionRecord = hasVerificationException(user) ? await transaction.get(adminDb.collection('verification_exceptions').doc(`USER_${uid}`)) : undefined;
  if (hasTrustedVerificationException(user, exceptionRecord?.data(), uid)) return;
  if (user.status !== 'APPROVED' || user.emailVerified !== true || !hasRequiredPhoneNumber(user) || user.identityVerified !== true || !identityDocument) throw new Error('VERIFICATION_REQUISE');
}

/** With real payments, a listing goes online only once its owner can receive payouts. */
async function assertOwnerPayoutsReady(ownerId: string) {
  if (getPaymentMode() !== 'STRIPE') return; // Simulation: no real payout to receive.
  try { await ownerConnect.readyAccount(ownerId); }
  catch (error) {
    if (error instanceof ConnectError) throw new ListingReviewError('Publication impossible : le propriétaire doit d’abord configurer ses versements Stripe (identité et compte bancaire vérifiés).', 409);
    throw error;
  }
}

const recurringSeries = createRecurringSeries({
  db: adminDb,
  paymentMode: () => getPaymentMode(),
  stripe: getStripe,
  isTestMode: () => connectConfiguration().isTest,
  ownerPayoutAccount: ownerId => ownerConnect.payoutAccount(ownerId),
  settle: (receipt, actorId) => settleBookingPayment(receipt, actorId),
  registerPayment: (booking, payment) => ownerConnect.registerPayment(booking, payment),
  assertTenantCanBook,
  notifyMail: () => void deliverReservationMail(),
});

const adminModeration = createAdminModeration({ db: adminDb, notifyMail: () => void deliverReservationMail() });
const errorTracking = createErrorTracking({ db: adminDb, notifyMail: () => void deliverReservationMail(), alertsEnabled: process.env.NODE_ENV === 'production' });
const adminFinances = createAdminFinances({ db: adminDb, stripe: getStripe, sweepInstallments: () => recurringSeries.sweep() });

async function synchronizeCheckout(session: Stripe.Checkout.Session) {
  if (session.livemode === connectConfiguration().isTest) throw new Error('Stripe mode mismatch.');
  const bookingId = session.metadata?.bookingId;
  if (!bookingId || session.payment_status !== 'paid') return;
  const result = await settleBookingPayment({ bookingId, sessionId: session.id, provider: 'STRIPE', amountCents: session.amount_total || 0, currency: session.currency || '', isTest: !session.livemode });
  if (result.disposition === 'REFUND') {
    const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!intent) throw new Error('Payment intent missing.');
    await getStripe().refunds.create({ payment_intent: intent }, { idempotencyKey: `stale-checkout-${session.id}` });
  } else {
    await ownerConnect.registerPayment(result.booking as Booking, session);
    await recurringSeries.savePaymentMethod(result.booking as Booking, session);
  }
}

async function synchronizeRefund(refundId: string) {
  const refund = await getStripe().refunds.retrieve(refundId);
  const bookingId = refund.metadata?.bookingId;
  if (!bookingId) return;
  const intentId = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id;
  if (!intentId || (await getStripe().paymentIntents.retrieve(intentId)).livemode === connectConfiguration().isTest) return;
  const ref = adminDb.collection('bookings').doc(bookingId);
  await adminDb.runTransaction(async transaction => {
    const saved = await transaction.get(ref), data = saved.data();
    if (data?.cancellation?.refundId !== refund.id) return;
    const refundStatus = refund.status === 'succeeded' ? 'COMPLETED' : ['failed', 'canceled'].includes(refund.status || '') ? 'FAILED' : 'PENDING';
    transaction.update(ref, { 'cancellation.refundStatus': refundStatus });
    transaction.set(adminDb.collection('payments').doc(refund.id), { status: refundStatus === 'COMPLETED' ? 'REFUNDED' : refundStatus === 'FAILED' ? 'FAILED' : 'PENDING' }, { merge: true });
  });
}

let checkoutReconciliationRunning = false;
async function reconcileStripe() {
  if (!connectConfiguration().enabled || checkoutReconciliationRunning) return;
  checkoutReconciliationRunning = true;
  try {
    // Rebuild missing settlement records even if a webhook was lost after a crash.
    const bookings = await adminDb.collection('bookings').where('paymentProvider', '==', 'STRIPE').get();
    for (const doc of bookings.docs) {
      const data = doc.data(), sessionId = data.checkoutSessionId || data.stripeSessionId;
      if (!sessionId || data.paymentIsTest === !connectConfiguration().isTest) continue;
      if (data.cancellation?.refundId?.startsWith('re_')) try { await synchronizeRefund(data.cancellation.refundId); } catch { console.error('Stripe refund reconciliation requires a retry.'); }
      if (data.paymentStatus === 'PAID' && (await adminDb.collection('owner_settlements').doc(doc.id).get()).exists) continue;
      try {
        if (String(sessionId).startsWith('pi_')) await recurringSeries.synchronizeIntent(await getStripe().paymentIntents.retrieve(sessionId));
        else await synchronizeCheckout(await getStripe().checkout.sessions.retrieve(sessionId));
      }
      catch { console.error('Stripe checkout reconciliation requires a retry.'); }
    }
    await ownerConnect.reconcileAll();
    await systemHealth.success('STRIPE_RECONCILIATION');
  } catch (error) { console.error('Stripe reconciliation unavailable; retry scheduled.'); await systemHealth.failure('STRIPE_RECONCILIATION', error); }
  finally { checkoutReconciliationRunning = false; }
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
    for (const job of initialReservationMailJobs(confirmation)) {
      transaction.create(adminDb.collection('reservation_mail_outbox').doc(`${booking.id}-${job.kind}`), job);
    }
    // The owner hears about a single stay now; a recurring series is announced once, at its activation.
    if (!booking.seriesId) {
      const ownerJob = ownerMailJob('OWNER_BOOKING', booking.ownerId, confirmation.paidAt, { bookingId: booking.id });
      transaction.create(adminDb.collection('reservation_mail_outbox').doc(ownerMailId(ownerJob)), ownerJob);
    }
    transaction.update(ref, prepared.bookingUpdate);
    transaction.create(adminDb.collection('payments').doc(prepared.payment.id), prepared.payment);
    transaction.set(adminDb.collection('booking_availability').doc(booking.id), prepared.availability);
    transaction.create(adminDb.collection('messages').doc(prepared.message.id), prepared.message);
    return { disposition: 'CONFIRM' as const, booking: { ...booking, ...prepared.bookingUpdate } };
  });
  if (result.disposition === 'CONFIRM') {
    void deliverReservationMail();
    if (result.booking.seriesId && result.booking.seriesIndex === 0) void recurringSeries.activate(result.booking.seriesId).catch(() => console.error('Series activation requires a retry.'));
  }
  return result;
}

async function deliverAuthAction(kind: AuthMailKind, email: string, name: string, previousEmail?: string) {
  const provider = getEmailProvider();
  if ('error' in provider || !resendTemplatesEnabled(process.env)) throw new Error('AUTH_MAIL_UNAVAILABLE');
  if (!canSendReservationRecipient(emailFrom, email, process.env.RESEND_TEST_EMAIL_TO)) throw new Error('AUTH_MAIL_DOMAIN');
  const limitRef = adminDb.collection('auth_mail_limits').doc(createHash('sha256').update(`${kind}:${email}`).digest('hex'));
  return sendAuthActionMail(kind, name, firebaseConfig.authDomain, {
    claim: () => adminDb.runTransaction(async transaction => {
      const current = await transaction.get(limitRef);
      const update = nextAuthMailLimit(current.data() as AuthMailLimit | undefined, Date.now());
      if (!update) return false;
      transaction.set(limitRef, { ...update, expiresAt: new Date(Date.now() + 86400_000) });
      return true;
    }),
    generate: () => previousEmail ? adminAuth.generateVerifyAndChangeEmailLink(previousEmail, email) : kind === 'EMAIL_VERIFICATION' ? adminAuth.generateEmailVerificationLink(email) : adminAuth.generatePasswordResetLink(email),
    send: async content => {
      const result = await provider.resend.emails.send({ from: emailFrom, to: email, ...(emailReplyTo ? { replyTo: emailReplyTo } : {}), ...content }, { idempotencyKey: `auth-${kind}-${randomUUID()}` });
      // Do not log provider payloads or Firebase action links.
      if (result.error) throw new Error('AUTH_MAIL_SEND_FAILED');
    }
  });
}

async function resolveTenantMail(job: TenantMailJob, startAt: string) {
  const [userSnapshot, bookingSnapshot, reviewSnapshot] = await Promise.all([
    adminDb.collection('users').doc(job.userId).get(),
    job.bookingId ? adminDb.collection('bookings').doc(job.bookingId).get() : undefined,
    job.kind === 'REVIEW_INVITE' && job.bookingId ? adminDb.collection('reviews').doc(reviewIdForBooking(job.bookingId)).get() : undefined
  ]);
  const profile = userSnapshot.exists ? userSnapshot.data() : undefined;
  const booking = bookingSnapshot?.exists ? { ...bookingSnapshot.data(), id: bookingSnapshot.id } as Booking : undefined;
  const disposition = tenantMailDisposition(job, profile, booking, reviewSnapshot?.exists === true, startAt);
  if (disposition !== 'SEND') return { disposition };
  if (!profile?.email) throw new Error('Adresse e-mail du locataire manquante.');
  const listing = booking && !booking.listingTitle ? await adminDb.collection('listings').doc(booking.listingId).get() : undefined;
  let context: SeriesMailContext | undefined;
  if (isSeriesMailKind(job.kind) && booking?.seriesId) {
    const series = (await adminDb.collection('booking_series').doc(booking.seriesId).get()).data() as BookingSeries | undefined;
    if (series) context = { series, stays: (await Promise.all(series.bookingIds.map(id => adminDb.collection('bookings').doc(id).get()))).filter(item => item.exists).map(item => ({ ...item.data(), id: item.id }) as Booking) };
  }
  return { disposition, to: String(profile.email), mail: tenantNotificationEmail(job, profile, booking, listing?.data()?.title, process.env.APP_ORIGIN, context),
    selectedTemplate: resendTemplatesEnabled(process.env) ? tenantResendTemplate(job, profile, booking, listing?.data()?.title, process.env.APP_ORIGIN, context) : undefined };
}

/** Reads what an owner notification needs just before sending: owner, booking or series, incident or payout. */
async function resolveOwnerMail(job: OwnerMailJob, startAt: string) {
  const read = async <T,>(collection: string, id?: string) => {
    if (!id) return undefined;
    const snapshot = await adminDb.collection(collection).doc(id).get();
    return snapshot.exists ? { ...snapshot.data(), id: snapshot.id } as T : undefined;
  };
  const incident = await read<Incident>('incidents', job.incidentId);
  const payout = await read<OwnerPayout>('owner_payouts', job.payoutId);
  const series = await read<BookingSeries>('booking_series', job.seriesId);
  const booking = await read<Booking>('bookings', job.bookingId || incident?.bookingId || series?.bookingIds.find(Boolean));
  const stays = series ? (await Promise.all(series.bookingIds.map(id => read<Booking>('bookings', id)))).filter((item): item is Booking => Boolean(item)) : undefined;
  const firstStay = stays?.find(stay => stay.seriesIndex === 0) || booking;
  const [owner, tenant, listing] = await Promise.all([
    read<{ firstName?: string; email?: string }>('users', job.userId),
    read<{ firstName?: string; lastName?: string }>('users', firstStay?.tenantId || incident?.reporterId),
    read<Listing>('listings', firstStay?.listingId || incident?.listingId),
  ]);
  const data: OwnerMailData = { owner, tenant, booking: firstStay, stays, incident, payout, listingTitle: firstStay?.listingTitle || listing?.title };
  const disposition = ownerMailDisposition(job, data, startAt);
  if (disposition !== 'SEND') return { disposition };
  return { disposition, to: String(owner!.email), mail: ownerNotificationEmail(job, data, process.env.APP_ORIGIN),
    selectedTemplate: resendTemplatesEnabled(process.env) ? ownerResendTemplate(job, data, process.env.APP_ORIGIN) : undefined };
}

async function resolveTeamMail(job: TeamMailJob) {
  const report = job.reportId ? (await adminDb.collection('reports').doc(job.reportId).get()).data() as Report | undefined : undefined;
  const listingId = report?.listingId || (report?.targetType === 'LISTING' ? report.targetId : undefined);
  const [reporter, listing] = await Promise.all([
    report?.reporterId ? adminDb.collection('users').doc(report.reporterId).get() : undefined,
    listingId ? adminDb.collection('listings').doc(listingId).get() : undefined,
  ]);
  const data: TeamMailData = { report, reporter: reporter?.data() as TeamMailData['reporter'], listingTitle: listing?.data()?.title };
  const to = teamMailRecipient(process.env);
  const disposition = teamMailDisposition(job, data, to);
  if (disposition !== 'SEND') return { disposition };
  return { disposition, to, mail: teamNotificationEmail(job, data, process.env.APP_ORIGIN),
    selectedTemplate: resendTemplatesEnabled(process.env) ? teamResendTemplate(job, data, process.env.APP_ORIGIN) : undefined };
}

/** Queues one mail to the Haven team for each new report (listing, stay issue or escalation). */
let teamAlertsRunning = false;
async function queueTeamReportMails() {
  if (teamAlertsRunning || !reservationEmailConfiguration(process.env).enabled) return;
  teamAlertsRunning = true;
  try {
    const fresh = await adminDb.collection('reports').where('status', '==', 'NEW').get();
    for (const item of fresh.docs.filter(doc => teamReportToAnnounce(doc.data() as Report))) {
      await adminDb.runTransaction(async transaction => {
        const current = (await transaction.get(item.ref)).data() as (Report & { teamMailQueuedAt?: string }) | undefined;
        if (!current || !teamReportToAnnounce(current)) return;
        const at = new Date().toISOString();
        transaction.update(item.ref, { teamMailQueuedAt: at });
        transaction.set(adminDb.collection('reservation_mail_outbox').doc(`${item.id}-HAVEN_REPORT`), teamReportMailJob({ ...current, id: item.id }, at));
      });
    }
    await systemHealth.success('TEAM_ALERTS');
  } catch (error) { console.error('Team report alerts unavailable; retry scheduled.'); await systemHealth.failure('TEAM_ALERTS', error); }
  finally { teamAlertsRunning = false; }
}

// A durable outbox survives restarts. A transaction lease prevents concurrent workers
// from dispatching the same message; the provider also receives a stable idempotency key.
let mailSweepRunning = false;
async function deliverReservationMail() {
  if (mailSweepRunning) return;
  const configuration = reservationEmailConfiguration(process.env);
  if (!configuration.enabled) return;
  const provider = getEmailProvider();
  if ('error' in provider) { await systemHealth.failure('MAIL_DELIVERY', 'Fournisseur d’e-mails non configuré : les messages restent en attente.'); return; }
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
        if (job.firstSendAttemptAt && Date.now() - Date.parse(job.firstSendAttemptAt) >= 20 * 3600_000) {
          await item.ref.update({ status: 'REVIEW_REQUIRED', nextAttemptAt: FieldValue.delete() }); continue;
        }
        let mail: { subject: string; text: string; html: string };
        let recipient: string;
        let selectedTemplate: ResendTemplate | undefined;
        let receiptAttachment: ReservationConfirmation | undefined;
        if (isTeamMailKind(job.kind)) {
          const resolved = await resolveTeamMail(job as TeamMailJob);
          if (resolved.disposition !== 'SEND') {
            await item.ref.update({ status: resolved.disposition, nextAttemptAt: FieldValue.delete() }); continue;
          }
          mail = resolved.mail!; recipient = resolved.to!; selectedTemplate = resolved.selectedTemplate;
        } else if (isOwnerMailKind(job.kind)) {
          const resolved = await resolveOwnerMail(job as OwnerMailJob, configuration.startAt);
          if (resolved.disposition !== 'SEND') {
            await item.ref.update({ status: resolved.disposition, nextAttemptAt: FieldValue.delete() }); continue;
          }
          mail = resolved.mail!; recipient = resolved.to!; selectedTemplate = resolved.selectedTemplate;
        } else if (isTenantMailKind(job.kind)) {
          const resolved = await resolveTenantMail(job as TenantMailJob, configuration.startAt);
          if (resolved.disposition !== 'SEND') {
            await item.ref.update({ status: resolved.disposition === 'WAIT' ? 'PENDING' : resolved.disposition, nextAttemptAt: resolved.disposition === 'WAIT' ? new Date(Date.now() + 60_000).toISOString() : FieldValue.delete() }); continue;
          }
          mail = resolved.mail!; recipient = resolved.to!; selectedTemplate = resolved.selectedTemplate;
        } else {
          const [bookingSnap, receiptSnap] = await Promise.all([
            adminDb.collection('bookings').doc(job.bookingId).get(),
            adminDb.collection('reservation_confirmations').doc(job.bookingId).get()
          ]);
          const booking = bookingSnap.data() as Booking | undefined;
          const receipt = receiptSnap.data() as ReservationConfirmation | undefined;
          const disposition = reservationMailDisposition(job as ReservationMailJob, booking, receipt, configuration.startAt);
          if (disposition !== 'SEND') {
            await item.ref.update({ status: disposition === 'WAIT' ? 'PENDING' : disposition, nextAttemptAt: disposition === 'WAIT' ? new Date(Date.now() + 60_000).toISOString() : FieldValue.delete() }); continue;
          }
          if (!receipt?.email || !booking) throw new Error('Adresse e-mail du locataire manquante.');
          if (job.kind === 'CHECKIN' || job.kind === 'CHECKOUT') {
            const saved = await adminDb.collection('inventory').doc(job.reportId).get();
            const inspection = saved.data();
            if (!inspection || inspection.bookingId !== job.bookingId || inspection.tenantId !== booking.tenantId || inspection.type !== (job.kind === 'CHECKIN' ? 'IN' : 'OUT')) {
              await item.ref.update({ status: 'CANCELLED', nextAttemptAt: FieldValue.delete() }); continue;
            }
          }
          let instructions = '';
          if (job.kind === 'ARRIVAL') {
            const access = await adminDb.collection('listing_access').doc(booking.listingId).get();
            const room = await adminDb.collection('listing_access').doc(booking.listingId).collection('room_guides').doc(booking.roomId).get();
            instructions = formatStayGuide(access.data(), room.exists ? normalizeRoomGuide(room.data()) : undefined);
          }
          mail = reservationLifecycleEmail(job.kind, receipt, { instructions, occurredAt: job.occurredAt, appOrigin: process.env.APP_ORIGIN });
          selectedTemplate = resendTemplatesEnabled(process.env) ? reservationResendTemplate(job.kind, receipt, { instructions, occurredAt: job.occurredAt, appOrigin: process.env.APP_ORIGIN }) : undefined;
          recipient = receipt.email;
          if (job.kind === 'CONFIRMATION') receiptAttachment = receipt;
        }
        if (!canSendReservationRecipient(emailFrom, recipient, process.env.RESEND_TEST_EMAIL_TO)) {
          await item.ref.update({ status: 'WAITING_DOMAIN', lastError: 'Un domaine Resend validé est nécessaire pour ce destinataire.', nextAttemptAt: new Date(Date.now() + 3600_000).toISOString() }); continue;
        }
        // Freeze the exact provider request before the first attempt. PDF metadata,
        // changed instructions or settings must not change a retry's idempotent body.
        const payloadRef = adminDb.collection('reservation_mail_payloads').doc(item.id);
        let payloadSnapshot = await payloadRef.get();
        if (!payloadSnapshot.exists) {
          const payload = { from: emailFrom, to: recipient, ...(emailReplyTo ? { replyTo: emailReplyTo } : {}), ...selectMailContent(mail, selectedTemplate),
            ...(receiptAttachment ? { attachments: [{ filename: `${receiptAttachment.id}.pdf`, content: (await paymentReceiptPdf(receiptAttachment)).toString('base64') }] } : {}) };
          try { await payloadRef.create(payload); } catch (error) { if ((error as { code?: number }).code !== 6) throw error; }
          payloadSnapshot = await payloadRef.get();
        }
        if (!job.firstSendAttemptAt) {
          job.firstSendAttemptAt = new Date().toISOString();
          await item.ref.update({ firstSendAttemptAt: job.firstSendAttemptAt });
        }
        const payload = payloadSnapshot.data() as Parameters<Resend['emails']['send']>[0];
        if (!payload.from || !canSendReservationRecipient(payload.from, String(payload.to), process.env.RESEND_TEST_EMAIL_TO)) {
          await item.ref.update({ status: 'REVIEW_REQUIRED', nextAttemptAt: FieldValue.delete() }); continue;
        }
        const sent = await provider.resend.emails.send(payload, { idempotencyKey: `reservation-${item.id}` });
        if (sent.error) throw new Error(sent.error.message);
        await item.ref.update({ status: 'SENT', sentAt: new Date().toISOString(), providerMessageId: sent.data?.id || '', lastError: FieldValue.delete(), nextAttemptAt: FieldValue.delete() });
      } catch (error) {
        const attempts = (job.attempts || 0) + 1;
        await item.ref.update({ status: 'RETRY', attempts, lastError: error instanceof Error ? error.message : 'Envoi indisponible.', nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 60_000 * 2 ** Math.min(attempts, 6))).toISOString() });
      }
    }
    await systemHealth.success('MAIL_DELIVERY');
  } catch (error) { console.error('Reservation mail outbox unavailable', error); await systemHealth.failure('MAIL_DELIVERY', error); }
  finally { mailSweepRunning = false; }
}

async function expireBooking(bookingId: string) {
  const ref = adminDb.collection('bookings').doc(bookingId);
  const pending = (await ref.get()).data() as Booking | undefined;
  // A first payment may have landed just before the activation sweep: activate before releasing later stays.
  if (pending?.seriesId && isLaterSeriesStay(pending) && !pending.seriesActivatedAt) await recurringSeries.activate(pending.seriesId).catch(() => undefined);
  const expired = await adminDb.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || !isBookingExpired(snapshot.data() as Booking)) return null;
    const booking = { ...snapshot.data(), id: snapshot.id } as Booking;
    const now = new Date().toISOString();
    transaction.update(ref, { status: 'CANCELLED', expiredAt: now });
    recurringSeries.unpaidCancellationWrites(transaction, booking, now);
    transaction.set(adminDb.collection('booking_availability').doc(bookingId), {
      id: bookingId, bookingId, listingId: booking.listingId, roomId: booking.roomId,
      startDate: booking.startDate, endDate: booking.endDate, status: 'CANCELLED', updatedAt: now
    });
    return booking;
  });
  if (expired?.seriesId && expired.seriesIndex === 0) await recurringSeries.releaseInactive(expired.seriesId);
  if (expired?.unpaidCancelledAt || (expired && isLaterSeriesStay(expired) && expired.seriesActivatedAt)) void deliverReservationMail();
}
async function expireBookings() {
  try {
    const pending = await adminDb.collection('bookings').where('status', 'in', ['PENDING', 'APPROVED']).get();
    await Promise.all(pending.docs.filter(item => isBookingExpired(item.data() as Booking)).map(item => expireBooking(item.id)));
    await systemHealth.success('BOOKING_EXPIRY');
  } catch (error) { console.error('Booking expiration unavailable', error); await systemHealth.failure('BOOKING_EXPIRY', error); }
}

async function getHousematesForStay(listingId: string, stay: { viewerId: string; roomId: string; startDate: string; endDate: string }) {
  const bookingsSnapshot = await adminDb.collection("bookings").where("listingId", "==", listingId).get();
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
  return buildHousematePreviews(candidates, profilesById, stay);

}

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = 3000;

  // Tailwind is compiled and the page has no inline script: the built site runs under a CSP.
  // Vite's development server injects an inline preamble, so CSP stays off while developing.
  app.use(helmet({ contentSecurityPolicy: isProduction ? { useDefaults: false, directives: CONTENT_SECURITY_POLICY } : false }));

  for (const [route, secretName] of [['/api/stripe/webhook', 'STRIPE_WEBHOOK_SECRET'], ['/api/stripe/connect-webhook', 'STRIPE_CONNECT_WEBHOOK_SECRET']]) {
    app.post(route, express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
      try { if (getPaymentMode() !== 'STRIPE') return sendApiError(res, 503, 'Stripe est désactivé.'); }
      catch { return sendApiError(res, 503, 'Stripe n’est pas configuré.'); }
      const secret = process.env[secretName];
      if (!secret) return sendApiError(res, 503, 'Webhook non configuré.');
      let event: Stripe.Event;
      try { event = getStripe().webhooks.constructEvent(req.body, req.headers['stripe-signature'] as string, secret); }
      catch { return sendApiError(res, 400, 'Signature Stripe invalide.'); }
      void systemHealth.success('STRIPE_WEBHOOK');
      // A Connect endpoint can receive both test/live events. Never mix ledgers.
      if (event.livemode === connectConfiguration().isTest) return res.json({ received: true, ignored: true });
      try {
        if (!event.account && (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded')) await synchronizeCheckout(event.data.object as Stripe.Checkout.Session);
        if (!event.account && ['refund.created', 'refund.updated', 'refund.failed'].includes(event.type)) await synchronizeRefund((event.data.object as Stripe.Refund).id);
        if (!event.account && event.type === 'payment_intent.succeeded') await recurringSeries.synchronizeIntent(event.data.object as Stripe.PaymentIntent);
        await ownerConnect.handleEvent(event);
        return res.json({ received: true });
      } catch {
        console.error('Stripe webhook processing failed; provider retry required.', event.id);
        return sendApiError(res, 500, 'Synchronisation en attente de nouvelle tentative.');
      }
    });
  }

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
  app.get("/api/health", (_req, res) => {
    let paymentMode: string = 'UNAVAILABLE';
    try { paymentMode = getPaymentMode(); } catch { /* Invalid configuration disables payment. */ }
    res.json({ status: 'ok', env: process.env.NODE_ENV, paymentMode, emailConfigured: !('error' in getEmailProvider()), reservationEmailsEnabled: reservationEmailConfiguration(process.env).enabled, resendTemplatesEnabled: resendTemplatesEnabled(process.env) });
  });

  // Public calendar only: never expose booking participants, contact data or payment details.
  app.get('/api/availability', rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
    try {
      const listingId = req.query.listingId;
      if (listingId !== undefined && (typeof listingId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(listingId))) return sendApiError(res, 422, 'Logement invalide.');
      const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10);
      const query = listingId ? adminDb.collection('booking_availability').where('listingId', '==', listingId) : adminDb.collection('booking_availability').where('endDate', '>=', cutoff);
      const snapshot = await query.get();
      const availability = snapshot.docs.flatMap(item => {
        const value = item.data();
        const calendar = publicAvailabilityItem(item.id, value);
        return calendar && calendar.endDate >= cutoff ? [calendar] : [];
      });
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ availability });
    } catch { return sendApiError(res, 503, 'Impossible de vérifier les disponibilités.'); }
  });

  app.post('/api/bookings', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { id, listingId, roomId, startDate, endDate } = req.body || {};
      if (![id, listingId, roomId].every(value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)) ||
          typeof startDate !== 'string' || typeof endDate !== 'string' || !isBookableStay(startDate, endDate)) {
        return sendApiError(res, 422, 'Les informations ou les dates du séjour sont invalides');
      }
      try { assertCleaningPolicyAccepted(req.body?.cleaningPolicyVersion); } catch (error) { return sendApiError(res, 422, (error as Error).message); }
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
        const availability = availabilityQuery.docs.map(item => item.data() as BookingAvailability);
        // The minimum may be lowered to a gap the stay exactly fills between two occupations of the room.
        if (nights < requiredNightsForStay(room, listing, availability, startDate, endDate) || nights > 366) throw new Error('DATES_INVALIDES');
        if (!isRoomAvailableForStay(room, listing, availability, startDate, endDate)) throw new Error('DATES_INDISPONIBLES');
        if (existingBooking.exists || existingAvailability.exists) throw new Error('RESERVATION_EXISTANTE');

        const basePrice = room.pricePerDay * nights;
        const cleaningFee = Number.isFinite(Number(listing.cleaningFee)) ? Math.max(0, Number(listing.cleaningFee)) : 0;
        const platformFee = Math.round(basePrice * 0.15);
        const access = await transaction.get(adminDb.collection('listing_access').doc(listingId));
        const booking: Booking = {
          timeZone: access.data()?.timeZone || 'Europe/Paris',
          id, listingId, listingTitle: listing.title, roomId, roomName: room.name || 'Chambre', tenantId: req.user!.uid,
          ownerId: listing.ownerId, startDate, endDate, status: 'PENDING', basePrice, cleaningFee,
          platformFee, totalPrice: basePrice + cleaningFee + platformFee, createdAt,
          paymentStatus: 'PENDING', bookingMode: 'INSTANT', cleaningPolicyVersion: CLEANING_POLICY_VERSION, cleaningPolicyAcceptedAt: createdAt,
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

  app.post('/api/booking-series', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      try { assertCleaningPolicyAccepted(req.body?.cleaningPolicyVersion); } catch (error) { return sendApiError(res, 422, (error as Error).message); }
      const created = await recurringSeries.create(req.user!.uid, req.body || {});
      return res.status(201).json(created);
    } catch (error) {
      if (error instanceof SeriesError) return sendApiError(res, error.status, error.message);
      if (error instanceof PaymentConfigurationError) return sendApiError(res, error.status, error.message);
      if (error instanceof Error && error.message === 'VERIFICATION_REQUISE') return sendApiError(res, 403, 'La validation manuelle de votre compte et de votre pièce d’identité est requise pour réserver');
      console.error('Recurring series creation failed', error);
      return sendApiError(res, 500, 'Votre série de séjours n’a pas pu être enregistrée. Réessayez dans quelques instants');
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
        if (booking.tenantId !== req.user!.uid) throw new BookingLifecycleError('Accès refusé.', 403);
        const input = req.body.report as import('./types').InventoryReport;
        const linkedId = input.type === 'IN' ? booking.checkInReportId : input.type === 'OUT' ? booking.checkOutReportId : undefined;
        if (linkedId && linkedId === input.id) {
          const saved = await transaction.get(adminDb.collection('inventory').doc(linkedId));
          if (!saved.exists) throw new BookingLifecycleError('Le document est momentanément indisponible. Contactez Haven.', 503);
          return recoverInventoryReport(booking, req.user!.uid, input, saved.data() as import('./types').InventoryReport);
        }
        const listingSnap = await transaction.get(adminDb.collection('listings').doc(booking.listingId));
        if (!listingSnap.exists) throw new BookingLifecycleError('Logement introuvable', 404);
        const listing = listingSnap.data() as Listing;
        const now = new Date();
        const report = prepareInventoryReport(booking, listing, req.user!.uid, req.body.report, now);
        const tenantSnapshot = await transaction.get(adminDb.collection('users').doc(booking.tenantId));
        const tenant = tenantSnapshot.data() || {};
        report.stay = { listingTitle: booking.listingTitle || listing.title, roomName: booking.roomName || 'Chambre', startDate: booking.startDate, endDate: booking.endDate, tenantName: [tenant.firstName, tenant.lastName].filter(Boolean).join(' ') || 'Locataire', timeZone: booking.timeZone || 'Europe/Paris' };
        let details: any = {};
        try { details = JSON.parse(report.comments) || {}; } catch { /* Older forms use plain text. */ }
        const issues: { category: string; subCategory: string; description: string; photo?: string }[] = [];
        if (report.type === 'OUT' && details.incident?.subCategory) issues.push(details.incident);
        if (report.type === 'IN' && Array.isArray(details.nonConformities)) for (const item of details.nonConformities) {
          issues.push({ category: 'État du logement', subCategory: item.clean === false ? 'Ménage non fait' : 'Non-conformité à l’arrivée', description: `${item.area === 'ROOM' ? 'Chambre' : 'Espaces communs'} : ${String(item.comment || 'Non-conformité signalée à l’arrivée').slice(0, 4500)}`, photo: details.assessments?.[item.area]?.photos?.[0] || item.photos?.[0] || '' });
        }
        if (issues.length > 3) throw new BookingLifecycleError('Trop de problèmes dans cet état des lieux.', 422);
        const routedIssues = issues.map((issue, index) => routeStayIssue({ ...issue, id: `inc-${report.id}-${index}`, bookingId: id, listingId: booking.listingId, ownerId: booking.ownerId, reporterId: booking.tenantId, createdAt: now.toISOString() }));
        transaction.create(adminDb.collection('inventory').doc(report.id), report);
        if (report.type === 'IN') transaction.create(adminDb.collection('owner_arrivals').doc(id), { reportId: report.id, tenantId: booking.tenantId, arrivedAt: now.toISOString() });
        const mailKind = report.type === 'IN' ? 'CHECKIN' : 'CHECKOUT';
        transaction.create(adminDb.collection('reservation_mail_outbox').doc(`${id}-${mailKind}`), reservationMailJob(id, mailKind, report.date, report.id));
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
        if (report.type === 'OUT') {
          const invitation = reviewInvitationMail({ ...booking, status: 'COMPLETED', completedAt: now.toISOString(), checkOutReportId: report.id });
          if (invitation) transaction.create(adminDb.collection('reservation_mail_outbox').doc(`${id}-REVIEW_INVITE`), invitation);
        }
        if (report.type === 'OUT') transaction.set(adminDb.collection('booking_availability').doc(id), {
          id, bookingId: id, listingId: booking.listingId, roomId: booking.roomId,
          startDate: booking.startDate, endDate: booking.endDate, status: 'COMPLETED', updatedAt: now.toISOString()
        });
        return report;
      });
      void deliverReservationMail();
      if (report.type === 'IN') void ownerConnect.releaseArrivedBookings().catch(() => console.error('Arrival transfer queued for retry.'));
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
      let platformFeedback;
      try { platformFeedback = normalizePlatformFeedback(req.body?.platformFeedback); }
      catch (error) { return sendApiError(res, 422, error instanceof Error ? error.message : 'Avis Haven invalide.'); }
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
        if (platformFeedback) transaction.create(adminDb.collection('platform_feedback').doc(reviewRef.id), {
          id: reviewRef.id, bookingId, authorId: req.user!.uid, authorName: tenant.firstName || 'Locataire',
          rating: platformFeedback.rating, comment: platformFeedback.comment, createdAt,
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

  app.get('/api/admin/platform-feedback', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    if (!await requireAdmin(req, res)) return;
    try {
      let query = adminDb.collection('platform_feedback').orderBy('createdAt', 'desc').limit(50);
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : '';
      if (cursor) {
        if (!/^[a-zA-Z0-9_-]{1,200}$/.test(cursor)) return sendApiError(res, 422, 'Pagination invalide.');
        const previous = await adminDb.collection('platform_feedback').doc(cursor).get();
        if (!previous.exists) return sendApiError(res, 422, 'Pagination invalide.');
        query = query.startAfter(previous);
      }
      const snapshot = await query.get();
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ feedback: snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })), nextCursor: snapshot.size === 50 ? snapshot.docs[snapshot.size - 1].id : null });
    } catch { return sendApiError(res, 503, 'Les retours Haven sont indisponibles.'); }
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
        } else {
          transaction.create(ref, record);
          if (routed.destination === 'OWNER') {
            const ownerJob = ownerMailJob('OWNER_INCIDENT', routed.incident.ownerId, routed.incident.createdAt, { incidentId: routed.incident.id });
            transaction.set(adminDb.collection('reservation_mail_outbox').doc(ownerMailId(ownerJob)), ownerJob);
          }
        }
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
        if (type === 'USER' && req.body.mode === 'GRANT' && update.verificationException) {
          const job = accountDecisionMail(id, before, 'ACCOUNT_APPROVED', update.verificationException.grantedAt, auditRef.id);
          if (job) transaction.create(adminDb.collection('reservation_mail_outbox').doc(`${id}-ACCOUNT_APPROVED-${auditRef.id}`), job);
        }
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
      void deliverReservationMail();
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
        const fields = ['id', 'title', 'description', 'city', 'address', 'postalCode', 'country', 'neighborhood', 'arrivalMethod', 'coordinates', 'type', 'totalRooms', 'availableRooms', 'surface', 'amenities', 'mainPhotoUrl', 'galleryUrls', 'rooms', 'bathrooms', 'minStay', 'allowGapStays', 'cleaningFee', 'cleaningPolicyVersion', 'bookingMode', 'checkInTime', 'checkOutTime', 'blockedDates'];
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

  // Money tools of the back office: overview, refunds, payout holds, transfers to review, installments.
  const financeRoute = (handler: (admin: AdminActor, req: AuthenticatedRequest) => Promise<unknown>) => async (req: AuthenticatedRequest, res: Response) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      res.setHeader('Cache-Control', 'no-store');
      return res.json(await handler(admin, req) ?? { success: true });
    } catch (error) {
      if (error instanceof AdminFinanceError) return sendApiError(res, error.status, error.message);
      console.error('Admin finance action failed', error);
      return sendApiError(res, 503, 'L’action n’a pas pu aboutir. Réessayez dans quelques instants.');
    }
  };
  app.get('/api/admin/finances', sensitiveApiLimiter, requireAuth, financeRoute(() => adminFinances.overview()));
  app.post('/api/admin/bookings/:bookingId/refund', sensitiveApiLimiter, requireAuth, financeRoute((admin, req) => adminFinances.refund(admin, String(req.params.bookingId), req.body?.amountCents, req.body?.reason)));
  app.post('/api/admin/settlements/:bookingId/hold', sensitiveApiLimiter, requireAuth, financeRoute((admin, req) => adminFinances.hold(admin, String(req.params.bookingId), req.body?.hold, req.body?.reason)));
  app.post('/api/admin/settlements/:bookingId/retry', sensitiveApiLimiter, requireAuth, financeRoute((admin, req) => adminFinances.retryTransfer(admin, String(req.params.bookingId))));
  app.post('/api/admin/installments/:bookingId', sensitiveApiLimiter, requireAuth, financeRoute((admin, req) => adminFinances.installment(admin, String(req.params.bookingId), req.body?.action, req.body?.dueDate)));

  // Monitoring: background tasks, mail queue (with recipients) and manual re-sending.
  app.get('/api/admin/system', sensitiveApiLimiter, requireAuth, financeRoute(async () => {
    const [health, outbox] = await Promise.all([adminDb.collection('system_health').get(), adminDb.collection('reservation_mail_outbox').get()]);
    const jobs = outbox.docs.map(doc => ({ id: doc.id, ...doc.data() } as Record<string, any>))
      .sort((a, b) => String(b.sentAt || b.nextAttemptAt || b.occurredAt || '').localeCompare(String(a.sentAt || a.nextAttemptAt || a.occurredAt || ''))).slice(0, 200);
    const payloads = jobs.length ? await adminDb.getAll(...jobs.map(job => adminDb.collection('reservation_mail_payloads').doc(job.id))) : [];
    const counts: Record<string, number> = {};
    for (const doc of outbox.docs) counts[doc.data().status || 'INCONNU'] = (counts[doc.data().status || 'INCONNU'] || 0) + 1;
    return {
      tasks: health.docs.map(doc => doc.data()),
      counts,
      mails: jobs.map((job, index) => ({ id: job.id, kind: job.kind, status: job.status, attempts: job.attempts || 0, lastError: job.lastError || '', occurredAt: job.occurredAt || '',
        nextAttemptAt: job.nextAttemptAt || '', sentAt: job.sentAt || '', to: payloads[index]?.data()?.to ? String(payloads[index].data()!.to) : '' })),
      mailConfigured: !('error' in getEmailProvider()), emailFrom, teamRecipient: Boolean(teamMailRecipient(process.env)),
    };
  }));
  // Application errors grouped by fingerprint (browsers and server).
  app.get('/api/admin/errors', sensitiveApiLimiter, requireAuth, financeRoute(async () => ({ errors: await errorTracking.list() })));
  app.post('/api/admin/errors/:errorId/resolve', sensitiveApiLimiter, requireAuth, financeRoute(async (_admin, req) => {
    if (!await errorTracking.setResolved(String(req.params.errorId), req.body?.resolved !== false)) throw new AdminFinanceError('Erreur introuvable.', 404);
  }));
  app.post('/api/admin/mail-outbox/:jobId/retry', sensitiveApiLimiter, requireAuth, financeRoute(async (admin, req) => {
    const id = String(req.params.jobId);
    if (!/^[a-zA-Z0-9_.:-]{1,200}$/.test(id)) throw new AdminFinanceError('Message invalide.', 422);
    const ref = adminDb.collection('reservation_mail_outbox').doc(id);
    await adminDb.runTransaction(async transaction => {
      const current = await transaction.get(ref);
      if (!current.exists) throw new AdminFinanceError('Message introuvable.', 404);
      if (current.data()?.status === 'SENT') throw new AdminFinanceError('Ce message est déjà envoyé.');
      transaction.update(ref, { status: 'PENDING', attempts: 0, nextAttemptAt: new Date().toISOString(), firstSendAttemptAt: FieldValue.delete(), lastError: FieldValue.delete() });
      const auditRef = adminDb.collection('admin_audit').doc();
      transaction.create(auditRef, { id: auditRef.id, actorId: admin.uid, actorName: admin.name, action: 'MAIL_RETRIED', category: 'ADMINISTRATION', targetType: 'MAIL', targetId: id, summary: `Nouvel essai d’envoi du message ${current.data()?.kind}.`, createdAt: new Date().toISOString() });
    });
    void deliverReservationMail();
  }));

  // Member file: everything about one member in a single timeline, and internal notes of the team.
  app.get('/api/admin/users/:userId/file', sensitiveApiLimiter, requireAuth, financeRoute(async (_admin, req) => {
    const id = String(req.params.userId);
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new AdminFinanceError('Membre invalide.', 422);
    const by = (collection: string, field: string) => adminDb.collection(collection).where(field, '==', id).get().then(snap => snap.docs.map(doc => ({ ...doc.data(), id: doc.id }) as any));
    const unique = <T extends { id: string }>(...lists: T[][]) => [...new Map(lists.flat().map(item => [item.id, item])).values()];
    const [tb, ob, tp, op, payouts, rr, rt, ro, ir, io, ra, rtg, mails, audit, notes] = await Promise.all([
      by('bookings', 'tenantId'), by('bookings', 'ownerId'), by('payments', 'tenantId'), by('payments', 'ownerId'), by('owner_payouts', 'ownerId'),
      by('reports', 'reporterId'), by('reports', 'targetId'), by('reports', 'ownerId'), by('incidents', 'reporterId'), by('incidents', 'ownerId'),
      by('reviews', 'authorId'), by('reviews', 'targetId'), by('reservation_mail_outbox', 'userId'), by('admin_audit', 'targetId'), by('admin_notes', 'userId'),
    ]);
    return buildMemberFile({ userId: id, bookings: unique(tb, ob), payments: unique(tp, op), payouts, reports: unique(rr, rt, ro), incidents: unique(ir, io), reviews: unique(ra, rtg), mails, audit, notes });
  }));
  app.post('/api/admin/users/:userId/notes', sensitiveApiLimiter, requireAuth, financeRoute(async (admin, req) => {
    const id = String(req.params.userId);
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new AdminFinanceError('Membre invalide.', 422);
    if (text.length < 2 || text.length > 2000) throw new AdminFinanceError('La note doit faire entre 2 et 2000 caractères.', 422);
    const ref = adminDb.collection('admin_notes').doc();
    const note = { id: ref.id, userId: id, text, authorId: admin.uid, authorName: admin.name, createdAt: new Date().toISOString() };
    await ref.create(note);
    return note;
  }));

  // Moderation: suspend a listing, hide a review, move a stay.
  app.post('/api/admin/listings/:listingId/suspend', sensitiveApiLimiter, requireAuth, financeRoute((admin, req) => adminModeration.suspendListing(admin, String(req.params.listingId), req.body?.suspend, req.body?.reason)));
  app.post('/api/admin/reviews/:reviewId/hide', sensitiveApiLimiter, requireAuth, financeRoute((admin, req) => adminModeration.hideReview(admin, String(req.params.reviewId), req.body?.hide, req.body?.reason)));
  app.post('/api/admin/bookings/:bookingId/move', sensitiveApiLimiter, requireAuth, financeRoute((admin, req) => adminModeration.moveBooking(admin, String(req.params.bookingId), req.body || {})));

  // GDPR: export everything about a member, or erase and anonymise the account (accounting records are kept).
  app.get('/api/admin/users/:userId/export', sensitiveApiLimiter, requireAuth, financeRoute(async (admin, req) => {
    const id = String(req.params.userId);
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new AdminFinanceError('Membre invalide.', 422);
    const by = (collection: string, field: string, op: FirebaseFirestore.WhereFilterOp = '==') => adminDb.collection(collection).where(field, op, id).get().then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    const [profile, tb, ob, tp, op, payouts, reports, incidents, reviews, messages, documents, inventoryT, inventoryO] = await Promise.all([
      adminDb.collection('users').doc(id).get().then(doc => doc.data() || null),
      by('bookings', 'tenantId'), by('bookings', 'ownerId'), by('payments', 'tenantId'), by('payments', 'ownerId'), by('owner_payouts', 'ownerId'),
      by('reports', 'reporterId'), by('incidents', 'reporterId'), by('reviews', 'authorId'), by('messages', 'participants', 'array-contains'),
      by('documents', 'userId'), by('inventory', 'tenantId'), by('inventory', 'ownerId'),
    ]);
    const auditRef = adminDb.collection('admin_audit').doc();
    await auditRef.create({ id: auditRef.id, actorId: admin.uid, actorName: admin.name, action: 'MEMBER_DATA_EXPORTED', category: 'ACCOUNT', targetType: 'USER', targetId: id, summary: 'Export des données personnelles (RGPD).', createdAt: new Date().toISOString() });
    return { exportedAt: new Date().toISOString(), profile, bookings: { asTenant: tb, asOwner: ob }, payments: [...tp, ...op], payouts, reports, incidents, reviews, messages, documents, inventory: [...inventoryT, ...inventoryO] };
  }));
  app.post('/api/admin/users/:userId/erase', sensitiveApiLimiter, requireAuth, financeRoute(async (admin, req) => {
    const id = String(req.params.userId);
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new AdminFinanceError('Membre invalide.', 422);
    if (req.body?.confirm !== 'EFFACER') throw new AdminFinanceError('Tapez EFFACER pour confirmer.', 422);
    if (id === admin.uid) throw new AdminFinanceError('Vous ne pouvez pas effacer votre propre compte.');
    const userRef = adminDb.collection('users').doc(id);
    const user = (await userRef.get()).data();
    if (!user) throw new AdminFinanceError('Membre introuvable.', 404);
    if (user.role === 'ADMIN') throw new AdminFinanceError('Retirez d’abord ce compte de l’équipe d’administration.');
    const today = new Date().toISOString().slice(0, 10);
    const active = (await Promise.all(['tenantId', 'ownerId'].map(field => adminDb.collection('bookings').where(field, '==', id).get())))
      .flatMap(snap => snap.docs.map(doc => doc.data() as Booking))
      .filter(booking => booking.endDate >= today && (booking.status === 'CONFIRMED' || (booking.status === 'PENDING' && booking.seriesScheduled)));
    if (active.length) throw new AdminFinanceError(`Ce membre a ${active.length} séjour(s) à venir ou en cours : annulez-les ou attendez leur fin avant l’effacement.`);
    const online = await adminDb.collection('listings').where('ownerId', '==', id).where('status', '==', 'APPROVED').get();
    if (!online.empty) throw new AdminFinanceError('Ce membre a des annonces en ligne : suspendez-les avant l’effacement.');
    const at = new Date().toISOString();
    // Bookings, payments and invoices stay for accounting obligations; the person behind them is anonymised.
    await userRef.set({ id, role: user.role, status: 'BANNED', firstName: 'Membre', lastName: 'supprimé', email: `supprime-${id}@haven.invalid`, avatarUrl: '', erasedAt: at, createdAt: user.createdAt || at });
    await adminAuth.deleteUser(id).catch(error => { if ((error as { code?: string }).code !== 'auth/user-not-found') throw error; });
    const auditRef = adminDb.collection('admin_audit').doc();
    await auditRef.create({ id: auditRef.id, actorId: admin.uid, actorName: admin.name, action: 'MEMBER_ERASED', category: 'ACCOUNT', targetType: 'USER', targetId: id, summary: 'Compte effacé et anonymisé (RGPD) ; données comptables conservées.', createdAt: at });
  }));

  // Blocking dates changes only the dates: it must work even if the listing is not complete enough to be re-published.
  app.post('/api/listings/:listingId/blocked-dates', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const listingId = String(req.params.listingId);
      const target = String(req.body?.target || '');
      const dates = req.body?.dates;
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(listingId) || !/^[a-zA-Z0-9_-]{1,160}$/.test(target)) return sendApiError(res, 422, 'Demande invalide.');
      if (!Array.isArray(dates) || dates.length > 800 || dates.some(date => typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))) return sendApiError(res, 422, 'Dates invalides.');
      const clean = [...new Set(dates as string[])].sort();
      const ref = adminDb.collection('listings').doc(listingId);
      const admin = await getAdminActor(req);
      await adminDb.runTransaction(async transaction => {
        const listing = (await transaction.get(ref)).data() as Listing | undefined;
        if (!listing) throw new AdminFinanceError('Logement introuvable.', 404);
        if (listing.ownerId !== req.user!.uid && !admin) throw new AdminFinanceError('Accès refusé.', 403);
        if (target === 'LISTING') transaction.update(ref, { blockedDates: clean });
        else {
          if (!listing.rooms?.some(room => room.id === target)) throw new AdminFinanceError('Chambre introuvable.', 404);
          transaction.update(ref, { rooms: listing.rooms.map(room => room.id === target ? { ...room, blockedDates: clean } : room) });
        }
      });
      return res.json({ target, dates: clean });
    } catch (error) {
      if (error instanceof AdminFinanceError) return sendApiError(res, error.status, error.message);
      console.error('Blocked dates update failed', error);
      return sendApiError(res, 503, 'Les dates n’ont pas pu être enregistrées. Réessayez.');
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
      if (req.body?.status === 'APPROVED') {
        const ownerId = (await listingRef.get()).data()?.ownerId;
        if (typeof ownerId === 'string' && ownerId) await assertOwnerPayoutsReady(ownerId);
      }
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
        const before = snapshot.data()!;
        if (before.status === update.status && before.rejectionReason === update.rejectionReason) return { ...update, moderatedAt: before.moderatedAt };
        if (update.status === 'REJECTED') {
          const job = accountDecisionMail(userId, before, 'ACCOUNT_CORRECTION', update.moderatedAt);
          if (job) transaction.create(adminDb.collection('reservation_mail_outbox').doc(`${userId}-ACCOUNT_CORRECTION-${auditRef.id}`), job);
        }
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
      void deliverReservationMail();
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
      if (req.body?.identityReviewed !== true || req.body?.residenceReviewed !== true) return sendApiError(res, 422, 'Examinez la pièce d’identité et le justificatif de domicile avant de valider le profil.');
      const userRef = adminDb.collection('users').doc(userId);
      const auditRef = adminDb.collection('admin_audit').doc();
      const approval = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(userRef);
        if (!snapshot.exists) throw new MemberApprovalError('Profil introuvable.', 404);
        const update = prepareMemberApproval(snapshot.data()!, actor.uid);
        const before = snapshot.data()!;
        if (before.status === 'APPROVED' && before.identityVerified === true && before.isVerified === true && !before.verificationException) return { ...update, approvedAt: before.approvedAt, idVerifiedAt: before.idVerifiedAt };
        const job = accountDecisionMail(userId, before, 'ACCOUNT_APPROVED', update.approvedAt);
        if (job) transaction.create(adminDb.collection('reservation_mail_outbox').doc(`${userId}-ACCOUNT_APPROVED-${auditRef.id}`), job);
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
      void deliverReservationMail();
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

  // Shows only the limited public profiles of confirmed tenants whose stay
  // overlaps the dates requested by a signed-in prospective housemate. Contacts,
  // legal identity and payment information never leave the server here.
  app.patch('/api/users/me/community-profile', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    let fields;
    try { fields = validateCommunityProfile(req.body || {}); }
    catch (error) { return sendApiError(res, 422, error instanceof Error ? error.message : 'Profil invalide.'); }
    try {
      await adminDb.collection('users').doc(req.user!.uid).update(fields);
      return res.json(fields);
    } catch { return sendApiError(res, 500, 'Impossible d’enregistrer votre profil.'); }
  });

  app.get('/api/users/:userId/public-profile', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.userId);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return sendApiError(res, 404, 'Profil indisponible.');
      const snapshot = await adminDb.collection('users').doc(id).get();
      const user = snapshot.exists ? { ...snapshot.data(), id } as import('./types').User : undefined;
      if (!user || user.role === 'ADMIN' || user.status === 'BANNED') return sendApiError(res, 404, 'Profil indisponible.');
      // The full last name is shared only between a tenant and an owner who have a booking together.
      const viewer = req.user!.uid;
      const [asTenant, asOwner] = viewer === id ? [{ empty: false }, { empty: true }] : await Promise.all([
        adminDb.collection('bookings').where('tenantId', '==', viewer).where('ownerId', '==', id).limit(1).get(),
        adminDb.collection('bookings').where('tenantId', '==', id).where('ownerId', '==', viewer).limit(1).get(),
      ]);
      const related = !asTenant.empty || !asOwner.empty;
      const identity = { avatarUrl: user.avatarUrl || '', lastName: related ? user.lastName || '' : '' };
      if (user.role === 'TENANT') return res.json({ ...publicTenantProfile(user), ...identity });
      return res.json({ id, firstName: user.firstName, ...identity, role: user.role, bio: user.bio || '', createdAt: user.createdAt || '', status: user.status || '', rating: user.rating || 0, reviewsCount: user.reviewsCount || 0 });
    } catch { return sendApiError(res, 500, 'Profil indisponible.'); }
  });

  app.get('/api/bookings/:bookingId/housemates', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.bookingId);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return sendApiError(res, 422, 'Réservation invalide.');
      const snapshot = await adminDb.collection('bookings').doc(id).get();
      if (!snapshot.exists) return sendApiError(res, 404, 'Réservation introuvable.');
      const booking = snapshot.data() as Booking;
      if (!canViewBookingHousemates(booking, req.user!.uid, stayLocalDate(new Date(), booking.timeZone || 'Europe/Paris'))) return sendApiError(res, 403, 'Ces profils sont réservés au locataire d’un séjour confirmé à venir ou en cours.');
      const housemates = await getHousematesForStay(booking.listingId, { viewerId: booking.tenantId, roomId: booking.roomId, startDate: booking.startDate, endDate: booking.endDate });
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ housemates });
    } catch { return sendApiError(res, 503, 'Les profils sont momentanément indisponibles.'); }
  });

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

      const stay = { viewerId: req.user!.uid, roomId, startDate, endDate };
      const housemates = await getHousematesForStay(listingId, stay);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ housemates });
    } catch (error) {
      console.error("Housemate preview failed", error);
      return sendApiError(res, 500, "Impossible de charger les futurs colocataires");
    }
  });

  // The signed-in member's own profile over plain HTTPS: fallback when Firestore's live channel
  // is slow to open (seen in Safari after returning from Stripe).
  // Unexpected errors seen in visitors' browsers. Anonymous on purpose (a crash may happen before sign-in); cleaned server-side.
  app.post('/api/client-errors', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }), (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    void errorTracking.record({ source: 'CLIENT', message: body.message, stack: body.stack, context: body.context, path: body.path, userAgent: req.get('user-agent') || '' });
    res.status(204).end();
  });

  app.get('/api/me/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const snapshot = await adminDb.collection('users').doc(req.user!.uid).get();
      res.setHeader('Cache-Control', 'no-store');
      if (!snapshot.exists) return sendApiError(res, 404, 'Profil introuvable.');
      return res.json(snapshot.data());
    } catch { return sendApiError(res, 503, 'Profil momentanément indisponible.'); }
  });

  app.get('/api/users/:userId/residence', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.userId);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return sendApiError(res, 404, 'Domicile introuvable.');
      if (id !== req.user!.uid && !await requireAdmin(req, res)) return;
      const snapshot = await adminDb.collection('user_residences').doc(id).get();
      res.setHeader('Cache-Control', 'no-store');
      return res.json(snapshot.data() || {});
    } catch { return sendApiError(res, 500, 'Impossible de charger le domicile.'); }
  });
  app.get('/api/users/:userId/proof-of-address', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = String(req.params.userId);
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return sendApiError(res, 404, 'Document introuvable.');
      if (id !== req.user!.uid && !await requireAdmin(req, res)) return;
      const snapshot = await adminDb.collection('residence_documents').doc(id).get();
      if (!snapshot.exists) return sendApiError(res, 404, 'Document introuvable.');
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ dataUrl: snapshot.data()!.dataUrl });
    } catch { return sendApiError(res, 500, 'Impossible de charger le justificatif.'); }
  });
  app.put('/api/users/me/residence', sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const residence = normalizeResidence(req.body?.residence);
      const proof = req.body?.documentDataUrl;
      if (proof !== undefined && !validResidenceDocument(proof)) return sendApiError(res, 422, 'Justificatif de domicile invalide ou trop volumineux.');
      const userRef = adminDb.collection('users').doc(req.user!.uid);
      const residenceRef = adminDb.collection('user_residences').doc(req.user!.uid);
      const proofRef = adminDb.collection('residence_documents').doc(req.user!.uid);
      await adminDb.runTransaction(async transaction => {
        const [user, previous] = await Promise.all([transaction.get(userRef), transaction.get(residenceRef)]);
        if (!user.exists || user.data()!.role === 'ADMIN') throw new Error('Profil de membre requis.');
        const changed = Object.entries(residence).some(([key, value]) => previous.data()?.[key] !== value);
        if (!changed && !proof) return;
        transaction.set(residenceRef, { ...residence, updatedAt: new Date().toISOString() });
        if (proof) transaction.set(proofRef, { dataUrl: proof, uploadedAt: new Date().toISOString() });
        else if (changed) transaction.delete(proofRef);
        transaction.update(userRef, { residenceProvided: true, residenceVerified: false, 'documents.proofOfAddress': proof ? `/api/users/${req.user!.uid}/proof-of-address` : '', status: 'PENDING', isVerified: false, verificationException: null, verificationSubmittedAt: null, rejectionReason: null });
      });
      return res.json({ saved: true });
    } catch (error) { return sendApiError(res, 422, error instanceof Error ? error.message : 'Impossible d’enregistrer le domicile.'); }
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

  const authMailLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false,
    handler: (_req, res) => sendApiError(res, 429, 'Trop de demandes. Réessayez dans quelques minutes.') });
  app.post('/api/users/me/request-email-verification', authMailLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const [account, profile] = await Promise.all([adminAuth.getUser(req.user!.uid), adminDb.collection('users').doc(req.user!.uid).get()]);
      const email = normalizeEmail(account.email);
      if (account.disabled) return sendApiError(res, 403, 'Ce compte est désactivé.');
      if (!email || !profile.exists || normalizeEmail(profile.data()?.email) !== email || normalizeEmail(req.user?.email) !== email) return sendApiError(res, 409, 'Votre session ne correspond pas à cette adresse. Reconnectez-vous puis réessayez.');
      if (account.emailVerified) return res.json({ alreadyVerified: true });
      const sent = await deliverAuthAction('EMAIL_VERIFICATION', email, String(profile.data()?.firstName || 'à vous'));
      if (!sent) return sendApiError(res, 429, 'Un lien a déjà été demandé. Réessayez dans quelques minutes ou utilisez le lien reçu.');
      return res.json({ sent: true });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'AUTH_MAIL_DOMAIN') return sendApiError(res, 503, 'L’expéditeur Resend est en mode test. Un domaine validé est nécessaire pour envoyer à cette adresse.');
      return sendApiError(res, 503, 'Impossible d’envoyer le lien pour le moment. Réessayez dans quelques instants.');
    }
  });
  app.post('/api/users/me/request-email-change', authMailLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendApiError(res, 422, 'Adresse e-mail invalide.');
    if (!req.user!.authTime || Date.now() / 1000 - req.user!.authTime > 300) return sendApiError(res, 401, 'Reconnectez-vous puis réessayez pour modifier votre e-mail.');
    try {
      const [account, profile] = await Promise.all([adminAuth.getUser(req.user!.uid), adminDb.collection('users').doc(req.user!.uid).get()]);
      if (!account.email || account.disabled || !profile.exists || normalizeEmail(req.user!.email) !== normalizeEmail(account.email)) return sendApiError(res, 409, 'Reconnectez-vous avant de modifier votre e-mail.');
      if (email === normalizeEmail(account.email)) return sendApiError(res, 422, 'Cette adresse est déjà celle du compte.');
      await adminDb.collection('email_changes').doc(req.user!.uid).set({ previousEmail: normalizeEmail(account.email), email, expiresAt: Date.now() + 86400_000 });
      const sent = await deliverAuthAction('EMAIL_VERIFICATION', email, String(profile.data()!.firstName || 'à vous'), account.email);
      if (!sent) return sendApiError(res, 429, 'Patientez avant de demander un nouveau lien.');
      return res.json({ sent: true });
    } catch (error) {
      return sendApiError(res, 503, error instanceof Error && error.message === 'AUTH_MAIL_DOMAIN' ? 'Resend est en mode test : un domaine validé est nécessaire pour envoyer à cette nouvelle adresse.' : 'Impossible d’envoyer ce lien. Vérifiez l’adresse et réessayez.');
    }
  });

  app.post('/api/auth/request-password-reset', authMailLimiter, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendApiError(res, 422, 'Adresse e-mail invalide.');
    // A public reset response never discloses account existence or delivery status.
    const provider = getEmailProvider();
    if ('error' in provider || !resendTemplatesEnabled(process.env)) return sendApiError(res, 503, 'Le service d’envoi d’e-mails est momentanément indisponible.');
    try {
      if (canSendReservationRecipient(emailFrom, email, process.env.RESEND_TEST_EMAIL_TO)) {
        const account = await adminAuth.getUserByEmail(email);
        if (!account.disabled) await deliverAuthAction('PASSWORD_RESET', email, account.displayName?.split(' ')[0] || 'à vous');
      }
    } catch { /* No tokens, recipient identifiers or account existence in public errors. */ }
    return res.status(202).json({ accepted: true });
  });

  // Complete email ownership verification after Firebase confirms its action link.
  app.post("/api/users/me/confirm-email", sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const email = normalizeEmail(req.user?.email);
      const authUser = await adminAuth.getUser(req.user!.uid);
      if (normalizeEmail(authUser.email) !== email) return sendApiError(res, 403, "L’adresse e-mail du compte ne correspond pas à celle vérifiée.");
      if (!canConfirmEmailOwnership(email, authUser.email, authUser.emailVerified)) {
        return sendApiError(res, 400, "Confirmez votre adresse à l’aide du lien reçu par e-mail.");
      }
      const userRef = adminDb.collection("users").doc(req.user!.uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) return sendApiError(res, 404, "Profil introuvable");
      const profile = userSnap.data()!;
      if (normalizeEmail(profile.email) !== email) {
        const pendingRef = adminDb.collection('email_changes').doc(req.user!.uid);
        await adminDb.runTransaction(async transaction => {
          const [pending, fresh] = await Promise.all([transaction.get(pendingRef), transaction.get(userRef)]);
          const change = pending.data();
          if (!change || change.email !== email || change.previousEmail !== normalizeEmail(fresh.data()?.email) || change.expiresAt < Date.now()) throw new Error('Changement d’e-mail non autorisé ou expiré.');
          transaction.update(userRef, { email, emailVerified: true, emailVerifiedAt: new Date().toISOString() });
          transaction.delete(pendingRef);
        });
      }
      const emailVerifiedAt = new Date().toISOString();
      await userRef.update({
        emailVerified: true,
        emailVerifiedAt,
        isVerified: hasRequiredPhoneNumber(profile) && profile.identityVerified === true
      });
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
      if (!hasRequiredResidence(profile)) return sendApiError(res, 422, 'Renseignez votre adresse de résidence et transmettez un justificatif de domicile dans Mon compte.');
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
      const participant = booking.tenantId === req.user?.uid ? "TENANT" : booking.ownerId === req.user?.uid ? "OWNER" : null;
      // An administrator who is not part of the stay cancels on behalf of Haven (exceptional cases, full refund).
      const admin = participant ? null : await getAdminActor(req);
      const actor = participant || (admin ? "HAVEN" : null);
      if (!actor || (actor === "OWNER" && !isOwnerBookingVisible(booking as Booking))) return sendApiError(res, 403, "Accès refusé");

      const terms = getCancellationTerms(booking as Booking, actor);
      if (!terms.canCancel) return sendApiError(res, 409, terms.detail);

      let refundStatus: "NOT_REQUIRED" | "SIMULATED" | "COMPLETED" | "PENDING" | "FAILED" = "NOT_REQUIRED";
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
          const session = booking.stripeSessionId.startsWith("pi_") ? null : await getStripe().checkout.sessions.retrieve(booking.stripeSessionId);
          const paymentIntent = !session ? booking.stripeSessionId : typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
          if (!paymentIntent) return sendApiError(res, 503, "Le paiement d’origine est introuvable. Contactez HAVEN avec la référence de réservation.");
          const refund = await getStripe().refunds.create({
            payment_intent: paymentIntent,
            amount: Math.round(terms.refundAmount * 100),
            metadata: { bookingId, cancelledBy: actor },
          }, { idempotencyKey: `haven-cancellation-refund-${bookingId}` });
          if (["failed", "canceled"].includes(refund.status || "")) return sendApiError(res, 503, "Le remboursement Stripe a échoué. Votre réservation reste active. Contactez Haven.");
          refundStatus = refund.status === "succeeded" ? "COMPLETED" : "PENDING";
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
        const job = cancellationMail({ ...booking, id: bookingId, status: 'CANCELLED', cancellation } as Booking);
        if (job) transaction.create(adminDb.collection('reservation_mail_outbox').doc(`${bookingId}-CANCELLED`), job);
        // The owner is told when the tenant cancels a stay that was reserved for him (paid, or scheduled in a series).
        if (actor !== 'OWNER' && (booking.paymentStatus === 'PAID' || booking.seriesScheduled === true)) {
          const ownerJob = ownerMailJob('OWNER_CANCELLED', booking.ownerId, cancelledAt, { bookingId });
          transaction.set(adminDb.collection('reservation_mail_outbox').doc(ownerMailId(ownerJob)), ownerJob);
        }
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
            ...(booking.paymentProvider ? { provider: booking.paymentProvider } : {}),
            isTest: booking.paymentIsTest === true || booking.paymentProvider === 'SIMULATION',
            currency: 'EUR',
            status: refundStatus === "PENDING" ? "PENDING" : "REFUNDED",
            type: "REFUND",
            createdAt: cancelledAt,
          });
        }
        const receiverId = actor === "TENANT" ? booking.ownerId : booking.tenantId;
        const refundText = terms.refundAmount > 0
          ? ` Le remboursement prévu est de ${terms.refundAmount} € (${terms.refundPercent} %).`
          : " Aucun remboursement n’est prévu selon les conditions d’annulation.";
        if (admin) {
          const auditRef = adminDb.collection('admin_audit').doc();
          transaction.create(auditRef, { id: auditRef.id, actorId: admin.uid, actorName: admin.name, action: 'BOOKING_CANCELLED_BY_HAVEN', category: 'BOOKING', targetType: 'BOOKING', targetId: bookingId,
            beforeStatus: booking.status, afterStatus: 'CANCELLED', summary: `Réservation annulée par Haven : ${reason}. Remboursement : ${terms.refundAmount} €.`, createdAt: cancelledAt });
        }
        if (booking.paymentStatus === "PAID" && actor !== "HAVEN") transaction.set(adminDb.collection("messages").doc(messageId), {
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

      // Cancelling the unpaid first stay of a series releases the dates held for the other stays.
      if (booking.seriesId && booking.seriesIndex === 0 && booking.paymentStatus !== "PAID") await recurringSeries.releaseInactive(booking.seriesId);
      void deliverReservationMail();
      return res.json({ success: true, cancellation, status: "CANCELLED" });
    } catch (error) {
      if (error instanceof Error && error.message === "BOOKING_STATUS_CHANGED") return sendApiError(res, 409, "Cette réservation vient d’être modifiée. Actualisez la page avant de réessayer.");
      console.error("Booking cancellation failed", error);
      return sendApiError(res, 503, "L’annulation n’a pas pu être finalisée. Vos données n’ont pas été modifiées.");
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
      const guideAvailable = canReleaseArrivalInstructions(booking, receipt.instructionsDueAt);
      const access = guideAvailable ? (await adminDb.collection('listing_access').doc(booking.listingId).get()).data() : undefined;
      const room = guideAvailable ? await adminDb.collection('listing_access').doc(booking.listingId).collection('room_guides').doc(booking.roomId).get() : undefined;
      const guide = releasedStayGuide(booking, receipt.instructionsDueAt, access, Date.now(), room?.exists ? normalizeRoomGuide(room.data()) : undefined);
      return res.json({ ...receipt, bookingStatus: booking.status, ...guide, emailStatus: jobs[0].data()?.status || 'PENDING', arrivalEmailStatus: jobs[1].data()?.status || 'PENDING', emailConfigured: !('error' in getEmailProvider()), reservationEmailsEnabled: reservationEmailConfiguration(process.env).enabled, resendTemplatesEnabled: resendTemplatesEnabled(process.env) });
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
      const rooms = (listing.data()?.rooms || []) as { id: string; name: string }[];
      if (req.method === 'GET') {
        const [saved, guides] = await Promise.all([ref.get(), ref.collection('room_guides').get()]);
        const data = saved.data();
        return res.json({ instructions: data?.instructions || '', timeZone: data?.timeZone || 'Europe/Paris', practicalInfo: normalizePracticalInfo(data?.practicalInfo), rooms: rooms.map(({ id, name }) => ({ id, name })), roomGuides: Object.fromEntries(guides.docs.filter(doc => rooms.some(room => room.id === doc.id)).map(doc => [doc.id, normalizeRoomGuide(doc.data())])) });
      }
      if (req.method !== 'PUT') return sendApiError(res, 405, 'Méthode non autorisée.');
      if (typeof req.body.instructions !== 'string' || req.body.instructions.length > 6000) return sendApiError(res, 422, 'Consignes invalides (6 000 caractères maximum).');
      let practicalInfo;
      let roomGuides;
      try {
        practicalInfo = req.body.practicalInfo === undefined ? undefined : normalizePracticalInfo(req.body.practicalInfo);
        roomGuides = req.body.roomGuides === undefined ? undefined : normalizeRoomGuides(req.body.roomGuides, rooms.map(room => room.id));
      }
      catch (error) { return sendApiError(res, 422, error instanceof Error ? error.message : 'Informations pratiques invalides.'); }
      const timeZone = req.body.timeZone || 'Europe/Paris';
      try { new Intl.DateTimeFormat('fr-FR', { timeZone }).format(); } catch { return sendApiError(res, 422, 'Fuseau horaire invalide.'); }
      const batch = adminDb.batch();
      batch.set(ref, { timeZone, instructions: req.body.instructions.trim(), ...(practicalInfo ? { practicalInfo } : {}), updatedAt: new Date().toISOString(), updatedBy: req.user!.uid }, { merge: true });
      for (const [roomId, guide] of Object.entries(roomGuides || {})) batch.set(ref.collection('room_guides').doc(roomId), guide);
      await batch.commit();
      return res.json({ success: true });
    } catch { return sendApiError(res, 503, 'Impossible d’enregistrer les consignes.'); }
  });

  app.get('/api/owner/connect', requireAuth, async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const account = await ownerConnect.syncAccount(req.user!.uid);
      const snapshot = await adminDb.collection('owner_settlements').where('ownerId', '==', req.user!.uid).get();
      return res.json({ account, deposit: DEPOSIT_POLICY, settlements: snapshot.docs.filter(doc => doc.data().isTest === account.isTest).map(doc => {
        const data = doc.data();
        return { bookingId: doc.id, amountCents: data.amountCents, state: data.state, isTest: data.isTest, updatedAt: data.updatedAt, error: data.error || null };
      }) });
    } catch { return sendApiError(res, 503, 'Impossible de vérifier votre compte Stripe. Réessayez.'); }
  });
  for (const action of ['onboarding', 'dashboard'] as const) app.post(`/api/owner/connect/${action}`, sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      return res.json(action === 'onboarding' ? await ownerConnect.onboarding(req.user!.uid, req.user!.email, new URL(process.env.APP_ORIGIN || '').origin) : await ownerConnect.dashboard(req.user!.uid));
    } catch (error) {
      return sendApiError(res, error instanceof ConnectError ? error.status : 503, error instanceof ConnectError ? error.message : 'Le service de configuration des versements est indisponible.');
    }
  });

  // Only provider/server output belongs here. Clients cannot create or mark payouts paid.
  app.get('/api/owner/payouts', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      await ownerConnect.reconcileOwner(req.user!.uid);
      const snapshot = await adminDb.collection('owner_payouts').where('ownerId', '==', req.user!.uid).get();
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ payouts: snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ownerId: req.user!.uid, amountCents: data.amountCents, currency: data.currency, provider: data.provider, isTest: data.isTest,
          status: data.status, createdAt: data.createdAt, paidAt: data.paidAt, expectedArrivalAt: data.expectedArrivalAt, providerPayoutId: data.providerPayoutId };
      }) });
    } catch { return sendApiError(res, 503, 'Impossible de charger les virements. Réessayez dans un instant.'); }
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
      return res.json({ mode, isTest: mode === 'SIMULATION' || connectConfiguration().isTest, booking, expiresAt: bookingDeadline(booking), listing: { title: booking.listingTitle || listing.data()?.title || 'Votre logement', city: listing.data()?.city || '', image: listing.data()?.mainPhotoUrl || '' }, customer: { name: [profile?.firstName, profile?.lastName].filter(Boolean).join(' '), email: profile?.email || '' } });
    } catch (error) {
      if (error instanceof BookingLifecycleError || error instanceof PaymentConfigurationError || error instanceof ConnectError) return sendApiError(res, error.status, error.message);
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
      if (error instanceof BookingLifecycleError || error instanceof PaymentConfigurationError || error instanceof ConnectError) return sendApiError(res, error.status, error.message);
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
      const ownerAccountId = await ownerConnect.readyAccount(booking.ownerId);
      const laterStay = isLaterSeriesStay(booking);
      const series = booking.seriesId ? (await adminDb.collection('booking_series').doc(booking.seriesId).get()).data() as BookingSeries | undefined : undefined;
      if (laterStay && series?.status !== 'ACTIVE') return sendApiError(res, 409, 'Payez d’abord le premier séjour de votre série.');
      const previousSession = booking.checkoutSessionId || booking.stripeSessionId;
      let checkoutAttempt = 0;
      if (previousSession && laterStay && !previousSession.startsWith('cs_')) checkoutAttempt = 1;
      else if (previousSession) {
        const existing = await stripe.checkout.sessions.retrieve(previousSession);
        if (existing.status === 'open' && existing.url) {
          if (existing.metadata?.connectPolicy !== CONNECT_POLICY_VERSION || existing.metadata.ownerAccountId !== ownerAccountId) return sendApiError(res, 409, 'Recommencez votre réservation pour utiliser les versements sécurisés.');
          return res.json({ mode, id: existing.id, url: existing.url });
        }
        if (existing.payment_status === 'paid') return sendApiError(res, 409, 'Le paiement a déjà été effectué. Sa confirmation est en cours.');
        // An installment stays payable by hand until its deadline: open a fresh session.
        if (!laterStay) return sendApiError(res, 409, 'Cette session de paiement est terminée. Recommencez votre réservation.');
        checkoutAttempt = Math.floor((Date.now() - Date.parse(booking.createdAt)) / 60_000);
      }
      if (laterStay && series?.paymentProvider !== 'STRIPE') return sendApiError(res, 409, 'Cette série appartient au mode simulation.');
      const listingSnap = await adminDb.collection('listings').doc(booking.listingId).get();
      const listing = listingSnap.data();
      if (!listingSnap.exists) return sendApiError(res, 404, 'Logement introuvable.');
      // The tenant is signed in: prefill Stripe's e-mail field with the account address (profile address for phone sign-ins).
      const accountEmail = req.user!.email || (await adminDb.collection('users').doc(req.user!.uid).get()).data()?.email;
      const tenantEmail = typeof accountEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail) ? accountEmail.trim().toLowerCase() : undefined;
      const successUrl = safeReturnUrl(req, `/?booking=pending&id=${encodeURIComponent(bookingId)}#/dashboard`);
      const cancelUrl = safeReturnUrl(req, `/#/payment/${encodeURIComponent(bookingId)}?cancelled=1`);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment', payment_method_types: ['card'], locale: 'fr', client_reference_id: bookingId,
        // Stable across retries with the same idempotency key. The checkout starts within the initial 30-minute hold.
        expires_at: laterStay ? Math.floor(Date.now() / 1000) + 60 * 60 : Math.floor(Date.parse(booking.createdAt) / 1000) + 60 * 60,
        // The first stay of a series saves the card so the next installments are charged automatically.
        ...(booking.seriesId ? laterStay && series?.stripeCustomerId ? { customer: series.stripeCustomerId } : { customer_creation: 'always' as const } : {}),
        // A saved Stripe customer already carries its e-mail; Stripe refuses both at once.
        ...(tenantEmail && !(laterStay && series?.stripeCustomerId) ? { customer_email: tenantEmail } : {}),
        line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: Math.round(booking.totalPrice * 100), product_data: { name: String(booking.listingTitle || listing?.title || 'Séjour HAVEN').slice(0, 200), description: `${booking.roomName || 'Chambre'} · ${booking.startDate} → ${booking.endDate}` } } }],
        success_url: successUrl, cancel_url: cancelUrl,
        payment_intent_data: { transfer_group: `haven_${bookingId}`, ...(booking.seriesId ? { setup_future_usage: 'off_session' as const } : {}), metadata: { bookingId, connectPolicy: CONNECT_POLICY_VERSION, ownerAccountId } },
        metadata: { bookingId, listingId: booking.listingId, tenantId: booking.tenantId, connectPolicy: CONNECT_POLICY_VERSION, ownerAccountId }
      }, { idempotencyKey: checkoutAttempt ? `checkout-${bookingId}-${checkoutAttempt}` : `checkout-${bookingId}` });
      await adminDb.runTransaction(async transaction => {
        const fresh = await transaction.get(bookingRef);
        if (!fresh.exists) throw new BookingLifecycleError('Réservation introuvable.', 404);
        assertBookingPayable(fresh.data() as Booking, req.user!.uid);
        transaction.update(bookingRef, { paymentProvider: 'STRIPE', checkoutSessionId: session.id, stripeSessionId: session.id, checkoutExpiresAt: new Date(session.expires_at * 1000).toISOString() });
      });
      return res.json({ mode, id: session.id, url: session.url });
    } catch (error) {
      if (error instanceof BookingLifecycleError || error instanceof PaymentConfigurationError || error instanceof ConnectError) return sendApiError(res, error.status, error.message);
      console.error('Stripe checkout failed', (error as { type?: string }).type || 'unavailable');
      return sendApiError(res, 503, 'Le paiement est momentanément indisponible. Aucun paiement simulé n’a été effectué.');
    }
  });

  // Last resort for errors no route handled: recorded for the back office, generic answer to the visitor.
  app.use((error: unknown, req: Request, res: Response, next: (error?: unknown) => void) => {
    if (res.headersSent) return next(error);
    const cause = error as { message?: unknown; stack?: unknown; status?: unknown; type?: unknown };
    // Malformed JSON or oversized bodies are the client's doing, not a Haven bug.
    if (typeof cause?.status === 'number' && cause.status >= 400 && cause.status < 500) return sendApiError(res, cause.status, 'Requête invalide.');
    void errorTracking.record({ source: 'SERVER', message: typeof cause?.message === 'string' ? cause.message : String(error), stack: typeof cause?.stack === 'string' ? cause.stack : '', context: `${req.method} ${req.path.replace(/\/[a-zA-Z0-9_-]{12,}/g, '/:id')}` });
    return sendApiError(res, 500, 'Une erreur inattendue est survenue.');
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // Run a catch-up sweep at startup and hourly. The authenticated history read
  // also triggers the same idempotent sweep so downtime never loses a rating.
  void reconcileStripe();
  const connectSweep = setInterval(() => void reconcileStripe(), 5 * 60_000);
  connectSweep.unref();
  const arrivalSweep = setInterval(() => void systemHealth.track('OWNER_TRANSFERS', () => ownerConnect.releaseArrivedBookings()), 30_000);
  arrivalSweep.unref();
  void queueTeamReportMails().then(() => deliverReservationMail());
  const reservationMailSweep = setInterval(() => void queueTeamReportMails().then(() => deliverReservationMail()), 30_000);
  reservationMailSweep.unref();
  void systemHealth.track('INSTALLMENTS', () => recurringSeries.sweep());
  const installmentSweep = setInterval(() => void systemHealth.track('INSTALLMENTS', () => recurringSeries.sweep()), 60_000);
  installmentSweep.unref();
  void expireBookings();
  const bookingSweep = setInterval(() => void expireBookings(), 60_000);
  bookingSweep.unref();
  void finalizeExpiredStayReviews().catch(() => undefined);
  const reviewSweep = setInterval(() => void finalizeExpiredStayReviews().catch(() => undefined), 60 * 60 * 1000);
  reviewSweep.unref();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite middleware...");
    try {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.stripe-local/**'] },
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
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// A brief network loss (Wi-Fi switch, sleep) makes background Firestore/Stripe calls fail.
// Every sweep retries on its next run, so log the failure instead of stopping the whole server.
process.on('unhandledRejection', reason => {
  const error = reason as { code?: unknown; message?: unknown; stack?: unknown } | undefined;
  console.error('Background task failed; it will be retried.', error?.code ?? '', typeof error?.message === 'string' ? error.message.slice(0, 200) : '');
  // Network losses are filtered out by the tracker; anything else is shown in the back office.
  void errorTracking.record({ source: 'SERVER', message: typeof error?.message === 'string' ? error.message : String(reason), stack: typeof error?.stack === 'string' ? error.stack : '', context: 'Tâche de fond' });
});

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
