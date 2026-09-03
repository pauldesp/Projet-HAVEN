import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from "resend";
import Stripe from "stripe";
import { GoogleGenAI, Type } from "@google/genai";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

let stripeClient: Stripe | null = null;
const verificationRequests = new Map<string, { hash: string; expiresAt: number; attempts: number; sentAt: number }>();

const normalizeEmail = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
const hashVerificationCode = (email: string, code: string) => {
  const secret = process.env.VERIFICATION_SECRET || process.env.RESEND_API_KEY || "haven-development-only";
  return createHash("sha256").update(`${secret}:${email}:${code}`).digest("hex");
};

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

  app.use(express.json());

  const getAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey === "YOUR_API_KEY") return null;
    return new GoogleGenAI({ apiKey });
  };

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

  app.post("/api/ai/city-coordinates", async (req, res) => {
    const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
    if (!city || city.length > 120) return res.status(400).json({ error: "Ville invalide" });

    const ai = getAiClient();
    if (!ai) return res.status(503).json({ error: "Assistant IA non configuré" });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Donne les coordonnées GPS de la ville suivante : "${city}"`,
        config: {
          systemInstruction: "Tu es un service de géocodage. Retourne uniquement un objet JSON avec lat et lng.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } },
            required: ["lat", "lng"],
          },
        },
      });
      return res.json(JSON.parse(response.text || "null"));
    } catch (error) {
      console.error("AI geocoding failed", error);
      return res.status(502).json({ error: "Géocodage temporairement indisponible" });
    }
  });

  app.post("/api/ai/listing-description", async (req, res) => {
    const data = req.body;
    if (!data || typeof data.title !== "string" || typeof data.city !== "string") {
      return res.status(400).json({ error: "Informations du logement invalides" });
    }

    const ai = getAiClient();
    if (!ai) return res.status(503).json({ error: "Assistant IA non configuré" });

    const amenities = Array.isArray(data.amenities) ? data.amenities.slice(0, 30).join(", ") : "";
    const prompt = `Rédige une annonce de colocation courte durée attractive pour HAVEN.
Type: ${data.type === "APARTMENT" ? "Appartement" : "Maison"}
Titre: ${String(data.title).slice(0, 200)}
Ville: ${String(data.city).slice(0, 120)}
Surface: ${data.surface}m²
Chambres: ${data.totalRooms}
Salles de bain: ${data.bathrooms}
Mixité: ${data.isMixed ? "Mixte" : "Non-mixte"}
Équipements: ${amenities}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: "Tu rédiges en français impeccable pour HAVEN. Ton chaleureux et professionnel, sans hashtags.",
        },
      });
      return res.json({ description: response.text || "" });
    } catch (error) {
      console.error("AI listing description failed", error);
      return res.status(502).json({ error: "Assistant rédactionnel temporairement indisponible" });
    }
  });

  // API route for sending verification email
  app.post("/api/send-verification", async (req, res) => {
    const email = normalizeEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Adresse e-mail invalide" });
    }

    const previousRequest = verificationRequests.get(email);
    if (previousRequest && Date.now() - previousRequest.sentAt < 60_000) {
      return res.status(429).json({ error: "Veuillez patienter une minute avant de demander un nouveau code." });
    }

    const code = randomInt(100000, 1000000).toString();
    verificationRequests.set(email, {
      hash: hashVerificationCode(email, code),
      expiresAt: Date.now() + 10 * 60_000,
      attempts: 0,
      sentAt: Date.now(),
    });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      if (process.env.NODE_ENV === "production") {
        verificationRequests.delete(email);
        return res.status(503).json({ error: "Le service d’envoi d’e-mails n’est pas configuré." });
      }
      console.log(`[VERIFICATION DEV] Email: ${email}, Code: ${code}`);
      return res.json({ success: true, developmentMode: true, email });
    }

    try {
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
        if (process.env.NODE_ENV !== "production" && (error.name === 'validation_error' || error.message.includes('authorized'))) {
          console.log(`[VERIFICATION DEV] Email: ${email}, Code: ${code}`);
          console.warn("⚠️ Resend sandbox limitation detected. Using mock success because verification code was logged above.");
          return res.json({ 
            success: true, 
            email,
            data: { id: "mock_resend_id" }, 
            warning: "Email sent via mock mode (Check server console for code)" 
          });
        }
        
        verificationRequests.delete(email);
        return res.status(500).json({ error: "Impossible d’envoyer le code de vérification." });
      }

      res.json({ success: true, email, data });
    } catch (err: any) {
      console.error("Server error:", err);
      verificationRequests.delete(email);
      res.status(500).json({ error: "Impossible d’envoyer le code de vérification." });
    }
  });

  app.post("/api/verify-code", (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    const request = verificationRequests.get(email);

    if (!isValidEmail(email) || !/^\d{6}$/.test(code) || !request) {
      return res.status(400).json({ error: "Code invalide ou expiré." });
    }
    if (Date.now() > request.expiresAt) {
      verificationRequests.delete(email);
      return res.status(400).json({ error: "Ce code a expiré. Demandez-en un nouveau." });
    }
    if (request.attempts >= 5) {
      verificationRequests.delete(email);
      return res.status(429).json({ error: "Trop de tentatives. Demandez un nouveau code." });
    }

    request.attempts += 1;
    const expected = Buffer.from(request.hash, "hex");
    const received = Buffer.from(hashVerificationCode(email, code), "hex");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return res.status(400).json({ error: "Code incorrect." });
    }

    verificationRequests.delete(email);
    return res.json({ success: true, email });
  });

  // API route for sending booking notification emails
  app.post("/api/send-booking-notification", async (req, res) => {
    const { email, type, details } = req.body;

    if (!email || !type || !details) {
      return res.status(400).json({ error: "Email, type, and details are required" });
    }

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
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { bookingId, amount, listingTitle, roomName, listingId, successUrl, cancelUrl } = req.body;
      
      const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
      
      // Mode simulation si pas de clé API ou si c'est un placeholder/junk
      if (!stripeKey || 
          stripeKey === "" || 
          stripeKey === "YOUR_STRIPE_SECRET_KEY" || 
          stripeKey.startsWith("sk_test_YOUR") ||
          stripeKey.includes("***") ||
          stripeKey.length < 15) {
        if (process.env.NODE_ENV === "production") {
          return res.status(503).json({ error: "Le paiement n’est pas encore configuré." });
        }
        console.log("STRIPE_SECRET_KEY not set or invalid placeholder. Using MOCK mode.");
        // Redirect directly to success URL for testing purposes
        return res.json({ 
          id: "mock_session_id", 
          url: successUrl,
          isMock: true 
        });
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
            listingId,
          },
        });

        return res.json({ id: session.id, url: session.url });
      } catch (stripeErr: any) {
        console.error("Stripe API call failed:", stripeErr);
        
        // If the key is invalid, fallback to mock mode in dev/preview environment
        if (stripeErr.type === 'StripeAuthenticationError' && process.env.NODE_ENV !== "production") {
          console.warn("⚠️ Invalid Stripe API key detected. Falling back to MOCK mode for development.");
          return res.json({ 
            id: "mock_session_id", 
            url: successUrl,
            isMock: true,
            warning: "Clé Stripe invalide, mode simulation activé"
          });
        }
        throw stripeErr; // Re-throw to be caught by outer catch
      }
    } catch (err: any) {
      console.error("Stripe error details:", err);
      
      let errorMessage = err.message;
      if (err.type === 'StripeAuthenticationError') {
        errorMessage = "La clé API Stripe est incorrecte. Veuillez vérifier la variable STRIPE_SECRET_KEY dans vos paramètres.";
      }
      
      res.status(500).json({ error: errorMessage });
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
