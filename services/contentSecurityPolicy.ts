/**
 * Browser allow-list for the built site. Tailwind is compiled and no inline script remains,
 * so scripts only come from Haven and the Google services it uses (Maps, Firebase sign-in).
 * Development keeps CSP off: Vite injects an inline preamble there.
 */
export const CONTENT_SECURITY_POLICY = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", 'https://maps.googleapis.com', 'https://apis.google.com', 'https://www.gstatic.com'],
  // React style attributes and the Google Maps widgets need inline styles.
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
  // Listing photos, avatars and map tiles come from several HTTPS hosts and uploads.
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  connectSrc: ["'self'", 'https://*.googleapis.com', 'https://*.firebaseio.com', 'wss://*.firebaseio.com', 'https://*.firebaseapp.com', 'https://geo.api.gouv.fr', 'https://maps.googleapis.com'],
  frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://apis.google.com', 'https://accounts.google.com'],
  workerSrc: ["'self'", 'blob:'],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'", 'https://checkout.stripe.com'],
  frameAncestors: ["'none'"],
};
