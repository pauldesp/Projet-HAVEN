export const GOOGLE_MAPS_KEY =
  (typeof process !== 'undefined' && process.env?.GOOGLE_MAPS_PLATFORM_KEY) || '';

export const hasGoogleMaps =
  Boolean(GOOGLE_MAPS_KEY) && GOOGLE_MAPS_KEY !== 'YOUR_API_KEY';
