import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Safari and some local Wi-Fi networks can interrupt Firestore's streaming
// transport. Auto-detection lets the SDK fall back to long polling when needed.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);
// Firebase's transactional templates use this locale whenever one is available.
auth.languageCode = 'fr';

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
// Always let the visitor choose the Google account used for HAVEN. This avoids
// silently reusing the account that happens to be active in the browser.
googleProvider.setCustomParameters({ prompt: 'select_account' });
