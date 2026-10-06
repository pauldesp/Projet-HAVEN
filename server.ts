import { countNights, isBookableStay } from './services/stay';
import { getCancellationTerms } from './services/cancellationPolicy';
import { isStayReviewWindowOpen } from './services/reviewPolicy';
import type { Booking, BookingAvailability, Listing, Room } from './types';
import { isRoomAvailableForStay } from './services/availability';
import { minimumNights } from './services/minimumStay';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from "resend";
import Stripe from "stripe";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
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
  await ref.set({ id: ref.id, actorId: actor.uid, actorName: actor.name, ...input, createdAt: new Date().toISOString() });
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

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = 3000;

  // The current UI still uses an inline Tailwind configuration. Keep CSP disabled
  // until Tailwind is bundled, while enabling Helmet's other security headers.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(503).json({ error: "Webhook Stripe non configuré" });
    try {
      const event = getStripe().webhooks.constructEvent(req.body, req.headers["stripe-signature"] as string, webhookSecret);
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const bookingId = session.metadata?.bookingId;
        if (bookingId && session.payment_status === "paid") {
          await adminDb.runTransaction(async transaction => {
            const bookingRef = adminDb.collection("bookings").doc(bookingId);
            const bookingSnap = await transaction.get(bookingRef);
            if (!bookingSnap.exists) throw new Error("Booking not found");
            const booking = bookingSnap.data()!;
            if (booking.stripeSessionId !== session.id) throw new Error("Stripe session mismatch");
            transaction.update(bookingRef, { status: "CONFIRMED", paymentStatus: "PAID", paidAt: new Date().toISOString() });
            transaction.set(adminDb.collection("payments").doc(session.id), {
              id: session.id, bookingId, listingId: booking.listingId, ownerId: booking.ownerId,
              tenantId: booking.tenantId, amount: (session.amount_total || 0) / 100,
              status: "COMPLETED", type: "RENT", createdAt: new Date().toISOString()
            });
            transaction.set(adminDb.collection("booking_availability").doc(bookingId), {
              id: bookingId, bookingId, listingId: booking.listingId, roomId: booking.roomId,
              startDate: booking.startDate, endDate: booking.endDate, status: "CONFIRMED", updatedAt: new Date().toISOString()
            });
          });
        }
      }
      return res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook rejected", error);
      return res.status(400).json({ error: "Webhook invalide" });
    }
  });

  app.use(express.json({ limit: "100kb" }));

  // Health check
  app.get("/api/health", (req, res) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const stripeConfigured = !!stripeKey && stripeKey !== "" && stripeKey !== "YOUR_STRIPE_SECRET_KEY";
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      stripe: stripeConfigured ? "configured" : "mock_mode"
    });
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
      const messageRef = adminDb.collection('messages').doc(`m-${randomInt(1, 2 ** 32).toString(16)}-${Date.now().toString(16)}`);
      const createdAt = new Date().toISOString();
      let createdBooking: Record<string, unknown> | null = null;

      await adminDb.runTransaction(async transaction => {
        const [userSnap, listingSnap, existingBooking, existingAvailability, availabilityQuery] = await Promise.all([
          transaction.get(userRef), transaction.get(listingRef), transaction.get(bookingRef), transaction.get(availabilityRef),
          transaction.get(adminDb.collection('booking_availability').where('listingId', '==', listingId))
        ]);
        if (!userSnap.exists) throw new Error('COMPTE_INTRouvable');
        const user = userSnap.data()!;
        const isAdminAccount = user.role === 'ADMIN';
        const identityDocument = typeof user.documents?.idCard === 'string' && user.documents.idCard.length > 0;
        if (!isAdminAccount && (user.status !== 'APPROVED' || user.emailVerified !== true || user.phoneVerified !== true || user.identityVerified !== true || !identityDocument)) {
          throw new Error('VERIFICATION_REQUISE');
        }
        if (!listingSnap.exists || listingSnap.data()?.status !== 'APPROVED') throw new Error('LOGEMENT_INDISPONIBLE');
        const listing = listingSnap.data() as Listing;
        if (listing.ownerId === req.user!.uid) throw new Error('PROPRE_LOGEMENT');
        const room = listing.rooms?.find((item: Room) => item.id === roomId);
        if (!room || typeof room.pricePerDay !== 'number') throw new Error('CHAMBRE_INVALIDE');
        const nights = countNights(startDate, endDate);
        if (nights < minimumNights(listing.minStay) || nights > 366) throw new Error('DATES_INVALIDES');
        const availability = availabilityQuery.docs.map(item => item.data() as BookingAvailability);
        if (!isRoomAvailableForStay(room, listing, availability, startDate, endDate)) throw new Error('DATES_INDISPONIBLES');
        if (existingBooking.exists || existingAvailability.exists) throw new Error('RESERVATION_EXISTANTE');

        const basePrice = room.pricePerDay * nights;
        const cleaningFee = Number(listing.cleaningFee) || 0;
        const platformFee = Math.round(basePrice * 0.15);
        const booking: Booking = {
          id, listingId, roomId, roomName: room.name || 'Chambre', tenantId: req.user!.uid,
          ownerId: listing.ownerId, startDate, endDate, status: 'PENDING', basePrice, cleaningFee,
          platformFee, totalPrice: basePrice + cleaningFee + platformFee, createdAt,
          paymentStatus: 'PENDING', bookingMode: listing.bookingMode === 'MANUAL' ? 'MANUAL' : 'INSTANT',
          checkInTime: listing.checkInTime || '15:00', checkOutTime: listing.checkOutTime || '11:00',
        };
        transaction.create(bookingRef, booking);
        transaction.create(availabilityRef, {
          id, bookingId: id, listingId, roomId, startDate, endDate, status: 'PENDING', updatedAt: createdAt,
        });
        transaction.create(messageRef, {
          id: messageRef.id, senderId: req.user!.uid, receiverId: listing.ownerId, bookingId: id,
          content: booking.bookingMode === 'MANUAL'
            ? `Bonjour, je souhaite réserver ${room.name || 'cette chambre'} du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}. Arrivée à partir de ${booking.checkInTime}, départ avant ${booking.checkOutTime}. Merci de valider ma demande.`
            : `Bonjour, je souhaite réserver ${room.name || 'cette chambre'} du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}. Arrivée à partir de ${booking.checkInTime}, départ avant ${booking.checkOutTime}.`,
          timestamp: createdAt, isRead: false, participants: [req.user!.uid, listing.ownerId],
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
  // overlaps the dates requested by a signed-in future housemate. Contacts,
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

      const bookingsSnapshot = await adminDb.collection("bookings").where("listingId", "==", listingId).get();
      const candidates = bookingsSnapshot.docs
        .map(item => item.data())
        .filter(booking =>
          booking.status === "CONFIRMED" &&
          booking.tenantId !== req.user?.uid &&
          booking.roomId !== roomId &&
          typeof booking.startDate === "string" &&
          typeof booking.endDate === "string" &&
          booking.startDate < endDate && booking.endDate > startDate
        );

      const uniqueTenantIds = [...new Set(candidates.map(booking => String(booking.tenantId)))];
      const profiles = await Promise.all(uniqueTenantIds.map(async (tenantId): Promise<Record<string, any> | null> => {
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
      const profilesById = new Map<string, Record<string, any>>(profiles.filter((profile): profile is Record<string, any> => Boolean(profile))
        .map(profile => [profile.id, profile]));

      const ageOf = (birthDate: unknown) => {
        if (typeof birthDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return undefined;
        const date = new Date(`${birthDate}T12:00:00`);
        if (Number.isNaN(date.getTime())) return undefined;
        const today = new Date();
        let age = today.getFullYear() - date.getFullYear();
        const birthdayThisYear = new Date(today.getFullYear(), date.getMonth(), date.getDate());
        if (birthdayThisYear > today) age -= 1;
        return age >= 18 && age <= 120 ? age : undefined;
      };

      const housemates = candidates.flatMap(booking => {
        const profile = profilesById.get(String(booking.tenantId));
        if (!profile?.shareProfileWithHousemates) return [];
        return [{
          id: String(profile.id),
          firstName: String(profile.firstName || "Membre HAVEN").slice(0, 100),
          avatarUrl: typeof profile.avatarUrl === "string" ? profile.avatarUrl : "",
          age: ageOf(profile.birthDate),
          activity: typeof profile.job === "string" && profile.job.trim()
            ? profile.job.trim().slice(0, 120)
            : typeof profile.school === "string" && profile.school.trim()
              ? `Étudie à ${profile.school.trim().slice(0, 100)}`
              : undefined,
          startDate: booking.startDate,
          endDate: booking.endDate,
          overlapStart: booking.startDate > startDate ? booking.startDate : startDate,
          overlapEnd: booking.endDate < endDate ? booking.endDate : endDate,
        }];
      }).sort((a, b) => a.overlapStart.localeCompare(b.overlapStart));

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

  // Complete email ownership verification only after the one-time code was
  // validated. The ticket is short-lived and tied to the authenticated email.
  app.post("/api/users/me/confirm-email", sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const email = normalizeEmail(req.user?.email);
      const expiresAt = verifiedEmailTickets.get(email) || 0;
      if (!email || expiresAt < Date.now()) return sendApiError(res, 400, "Le code de validation a expiré. Recommencez la validation de l’adresse e-mail.");
      const authUser = await adminAuth.getUser(req.user!.uid);
      if (normalizeEmail(authUser.email) !== email) return sendApiError(res, 403, "L’adresse e-mail du compte ne correspond pas à celle vérifiée.");
      await adminAuth.updateUser(req.user!.uid, { emailVerified: true });
      const userRef = adminDb.collection("users").doc(req.user!.uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) return sendApiError(res, 404, "Profil introuvable");
      const profile = userSnap.data()!;
      const emailVerifiedAt = new Date().toISOString();
      await userRef.update({
        emailVerified: true,
        emailVerifiedAt,
        isVerified: profile.phoneVerified === true && profile.identityVerified === true
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
      const normalizePhone = (value: unknown) => typeof value === "string" ? value.replace(/[\\s().-]/g, "") : "";
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
        isVerified: false,
        idVerifiedAt: null,
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

      const documents = userSnap.data()?.documents || {};
      const profile = userSnap.data()!;
      if (profile.emailVerified !== true || profile.phoneVerified !== true) {
        return sendApiError(res, 422, "Confirmez votre adresse e-mail et votre numéro de téléphone avant d’envoyer le dossier.");
      }
      if (![profile.firstName, profile.lastName, profile.birthDate, profile.phone].every(value => typeof value === "string" && value.trim())) {
        return sendApiError(res, 422, "Complétez votre prénom, votre nom, votre date de naissance et votre téléphone avant d’envoyer le dossier.");
      }
      const requiredDocuments = ["idCard"];
      const missing = requiredDocuments.some(key => typeof documents[key] !== "string" || documents[key].length === 0);
      if (missing) return sendApiError(res, 422, "La pièce d’identité doit être transmise");

      await userRef.update({ status: "PENDING", rejectionReason: null });
      return res.json({ status: "PENDING" });
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
    const previous = verificationCodes.get(email);
    if (previous && Date.now() - previous.lastSentAt < 60_000) return res.status(429).json({ error: "Veuillez attendre avant de renvoyer un code" });
    const code = randomInt(1000, 10000).toString();
    verificationCodes.set(email, { hash: hashCode(email, code), expiresAt: Date.now() + 10 * 60_000, attempts: 0, lastSentAt: Date.now() });

    const provider = getEmailProvider();
    if ("error" in provider) return sendApiError(res, 503, provider.error);

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
      if (!actor) return sendApiError(res, 403, "Accès refusé");

      const terms = getCancellationTerms(booking as Pick<Booking, 'status' | 'startDate' | 'totalPrice' | 'paymentStatus'>, actor);
      if (!terms.canCancel) return sendApiError(res, 409, terms.detail);

      let refundStatus: "NOT_REQUIRED" | "SIMULATED" | "COMPLETED" = "NOT_REQUIRED";
      let refundId: string | undefined;
      const shouldRefund = booking.paymentStatus === "PAID" && terms.refundAmount > 0;
      if (shouldRefund) {
        const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
        const isStripeConfigured = Boolean(stripeKey && stripeKey !== "YOUR_STRIPE_SECRET_KEY" && !stripeKey.includes("***") && stripeKey.length >= 15);
        if (!isStripeConfigured) {
          if (process.env.NODE_ENV === "production") return sendApiError(res, 503, "Le remboursement est momentanément indisponible. Votre réservation reste active.");
          refundStatus = "SIMULATED";
          refundId = `mock_refund_${bookingId}_${Date.now()}`;
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
        transaction.set(adminDb.collection("messages").doc(messageId), {
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

    if (!email || !type || !details) {
      return res.status(400).json({ error: "Email, type, and details are required" });
    }

    const bookingId = typeof details.bookingId === "string" ? details.bookingId : "";
    const bookingSnap = bookingId ? await adminDb.collection("bookings").doc(bookingId).get() : null;
    if (!bookingSnap?.exists) return res.status(404).json({ error: "Réservation introuvable" });
    const booking = bookingSnap.data()!;
    const callerId = (req as AuthenticatedRequest).user?.uid;
    if (callerId !== booking.tenantId && callerId !== booking.ownerId) return res.status(403).json({ error: "Accès refusé" });
    const [tenantSnap, ownerSnap] = await Promise.all([
      adminDb.collection("users").doc(booking.tenantId).get(),
      adminDb.collection("users").doc(booking.ownerId).get()
    ]);
    const allowedEmails = [tenantSnap.data()?.email, ownerSnap.data()?.email].filter(Boolean);
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
              ⚠️ Vous disposez de <strong>48 heures</strong> pour accepter ou refuser cette demande à partir de votre tableau de bord. Passé ce délai, la demande expirera automatiquement.
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
              ⏳ Vous disposez de <strong>72 heures</strong> pour finaliser le paiement sur votre tableau de bord afin de bloquer définitivement votre place. Passé ce délai, votre place sera libérée.
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

  // Stripe Checkout Endpoint
  app.post("/api/create-checkout-session", sensitiveApiLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { bookingId, successPath, cancelPath } = req.body;
      if (typeof bookingId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(bookingId)) {
        return res.status(400).json({ error: "Réservation invalide" });
      }
      const bookingRef = adminDb.collection("bookings").doc(bookingId);
      const bookingSnap = await bookingRef.get();
      if (!bookingSnap.exists) return res.status(404).json({ error: "Réservation introuvable" });
      const booking = bookingSnap.data()!;
      if (booking.tenantId !== req.user?.uid) return res.status(403).json({ error: "Accès refusé" });
      if (!["PENDING", "APPROVED"].includes(booking.status)) return res.status(409).json({ error: "Cette réservation ne peut pas être payée" });
      if (!isBookableStay(booking.startDate, booking.endDate)) return res.status(422).json({ error: "La date d’arrivée ne peut pas être antérieure à aujourd’hui", code: "422" });

      const listingSnap = await adminDb.collection("listings").doc(booking.listingId).get();
      if (!listingSnap.exists) return res.status(404).json({ error: "Logement introuvable" });
      const listing = listingSnap.data()!;
      const room = Array.isArray(listing.rooms) ? listing.rooms.find((item: any) => item.id === booking.roomId) : undefined;
      if (!room || typeof room.pricePerDay !== "number") return res.status(400).json({ error: "Chambre invalide" });
      const nights = countNights(booking.startDate, booking.endDate);
      if (nights < Math.max(1, Number(listing.minStay) || 1) || nights > 366) return res.status(400).json({ error: "Dates invalides" });
      const basePrice = room.pricePerDay * nights;
      const amount = basePrice + (Number(listing.cleaningFee) || 0) + Math.round(basePrice * 0.15);
      const listingTitle = String(listing.title || "Logement HAVEN").slice(0, 200);
      const roomName = String(room.name || "Chambre").slice(0, 200);
      const successUrl = safeReturnUrl(req, successPath);
      const cancelUrl = safeReturnUrl(req, cancelPath);
      const completeMockCheckout = async () => {
        const paidAt = new Date().toISOString();
        const mockSessionId = `mock_session_${bookingId}`;
        const mockPaymentId = `mock_payment_${bookingId}`;

        await adminDb.runTransaction(async transaction => {
          const freshBookingSnap = await transaction.get(bookingRef);
          if (!freshBookingSnap.exists) throw new Error("Booking not found");
          const freshBooking = freshBookingSnap.data()!;
          if (freshBooking.tenantId !== req.user?.uid || !["PENDING", "APPROVED"].includes(freshBooking.status)) {
            throw new Error("Booking status changed");
          }

          transaction.update(bookingRef, {
            status: "CONFIRMED",
            paymentStatus: "PAID",
            paidAt,
            stripeSessionId: mockSessionId,
            basePrice,
            cleaningFee: Number(listing.cleaningFee) || 0,
            platformFee: Math.round(basePrice * 0.15),
            totalPrice: amount,
          });
          transaction.set(adminDb.collection("payments").doc(mockPaymentId), {
            id: mockPaymentId,
            bookingId,
            listingId: booking.listingId,
            ownerId: booking.ownerId,
            tenantId: booking.tenantId,
            amount,
            status: "COMPLETED",
            type: "RENT",
            createdAt: paidAt,
          });
          transaction.set(adminDb.collection("booking_availability").doc(bookingId), {
            id: bookingId,
            bookingId,
            listingId: booking.listingId,
            roomId: booking.roomId,
            startDate: booking.startDate,
            endDate: booking.endDate,
            status: "CONFIRMED",
            updatedAt: paidAt,
          });
        });

        return res.json({ id: mockSessionId, url: successUrl, isMock: true });
      };
      
      const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
      
      // Mode simulation si pas de clé API ou si c'est un placeholder/junk
      if (!stripeKey || 
          stripeKey === "" || 
          stripeKey === "YOUR_STRIPE_SECRET_KEY" || 
          stripeKey.startsWith("sk_test_YOUR") ||
          stripeKey.includes("***") ||
          stripeKey.length < 15) {
        console.log("STRIPE_SECRET_KEY not set or invalid placeholder. Using MOCK mode.");
        if (process.env.NODE_ENV === "production") return res.status(503).json({ error: "Stripe non configuré" });
        return completeMockCheckout();
      }

      const stripe = getStripe();

      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "eur",
                product_data: {
                  name: `Réservation: ${listingTitle}`,
                  description: roomName,
                },
                unit_amount: Math.round(amount * 100), // Stripe uses cents
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            bookingId,
            listingId: booking.listingId,
            tenantId: booking.tenantId,
          },
        });

        await bookingRef.update({
          stripeSessionId: session.id, basePrice, cleaningFee: Number(listing.cleaningFee) || 0,
          platformFee: Math.round(basePrice * 0.15), totalPrice: amount
        });

        return res.json({ id: session.id, url: session.url });
      } catch (stripeErr: any) {
        console.error("Stripe API call failed:", stripeErr);
        
        // If the key is invalid, fallback to mock mode in dev/preview environment
        if (stripeErr.type === 'StripeAuthenticationError' && process.env.NODE_ENV !== "production") {
          console.warn("⚠️ Invalid Stripe API key detected. Falling back to MOCK mode for development.");
          return completeMockCheckout();
        }
        throw stripeErr; // Re-throw to be caught by outer catch
      }
    } catch (err: any) {
      console.error("Stripe error details:", err);
      sendApiError(res, 451, "Le paiement est momentanément indisponible.");
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // Run a catch-up sweep at startup and hourly. The authenticated history read
  // also triggers the same idempotent sweep so downtime never loses a rating.
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
