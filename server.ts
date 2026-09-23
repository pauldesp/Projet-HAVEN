import { countNights, isBookableStay } from './services/stay';
import { getCancellationTerms } from './services/cancellationPolicy';
import type { Booking } from './types';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from "resend";
import Stripe from "stripe";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
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
const normalizeEmail = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
const hashCode = (email: string, code: string) => createHash("sha256").update(`${email}:${code}`).digest();
const verificationLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const sensitiveApiLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

interface AuthenticatedRequest extends Request { user?: { uid: string; email?: string } }

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
      const profiles = await Promise.all(uniqueTenantIds.map(async tenantId => {
        const profile = await adminDb.collection("users").doc(tenantId).get();
        return profile.exists ? profile.data() : undefined;
      }));
      const profilesById = new Map(profiles.filter(Boolean).map(profile => [String(profile!.id), profile!]));

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

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("RESEND_API_KEY is missing");
      return res.status(500).json({ error: "Le service d'envoi d'emails n'est pas configuré." });
    }

    try {
      console.log(`[VERIFICATION] Email: ${email}, Code: ${code}`);
      
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: "HAVEN <onboarding@resend.dev>",
        to: [email],
        subject: "Votre code de vérification HAVEN",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1E293B;">
            <h1 style="color: #A34343;">Bienvenue sur HAVEN</h1>
            <p>Voici votre code de vérification pour finaliser votre inscription :</p>
            <div style="background-color: #F1F5F9; padding: 20px; border-radius: 12px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
              ${code}
            </div>
            <p style="font-size: 14px; color: #78716C;">Si vous n'avez pas demandé ce code, vous pouvez ignorer cet e-mail.</p>
          </div>
        `,
      });
      
      if (error) {
        console.error("Resend error:", error);
        
        // Handle Resend trial limitations gracefully for development
        if (error.name === 'validation_error' || error.message.includes('authorized')) {
          console.warn("⚠️ Resend sandbox limitation detected. Using mock success because verification code was logged above.");
          return res.json({ 
            success: true, 
            data: { id: "mock_resend_id" }, 
            warning: "Email sent via mock mode (Check server console for code)" 
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

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === "" || apiKey === "YOUR_RESEND_API_KEY" || apiKey.includes("***")) {
      console.log(`[EMAIL MOCK - RESEND NOT CONFIGURED]
To: ${email}
Type: ${type}
Details:`, JSON.stringify(details, null, 2));
      return res.json({ 
        success: true, 
        mocked: true, 
        message: "Email logged to console (mock mode)." 
      });
    }

    try {
      const resend = new Resend(apiKey);
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

      await resend.emails.send({
        from: "HAVEN <onboarding@resend.dev>",
        to: [email],
        subject: subject,
        html: htmlContent
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Booking email send failed:", err);
      // Suppress hard errors on development Resend sandboxes and fallback to simulated success
      res.json({ success: true, warned: true, error: err.message });
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
      
      const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
      
      // Mode simulation si pas de clé API ou si c'est un placeholder/junk
      if (!stripeKey || 
          stripeKey === "" || 
          stripeKey === "YOUR_STRIPE_SECRET_KEY" || 
          stripeKey.startsWith("sk_test_YOUR") ||
          stripeKey.includes("***") ||
          stripeKey.length < 15) {
        console.log("STRIPE_SECRET_KEY not set or invalid placeholder. Using MOCK mode.");
        // Redirect directly to success URL for testing purposes
        if (process.env.NODE_ENV === "production") return res.status(503).json({ error: "Stripe non configuré" });
        return res.json({ id: "mock_session_id", url: successUrl, isMock: true });
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
          return res.json({ 
            id: "mock_session_id", 
            url: cancelUrl,
            isMock: true,
            warning: "Clé Stripe invalide, mode simulation activé"
          });
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
