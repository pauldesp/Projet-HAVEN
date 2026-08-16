import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, getDocs, setDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { MOCK_USERS_DB, MOCK_LISTINGS, SEED_BOOKINGS } from './services/mockData';
import { User, UserRole } from './types';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the named database from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Detail:', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}

// Seed Firestore if empty or forced
export async function seedFirestore(force = false) {
  if (!auth.currentUser) {
    console.log("Seeding deferred: User not authenticated.");
    return;
  }

  const isAdminUser = auth.currentUser.email?.toLowerCase() === "paul.desplanques@gmail.com";
  
  console.log(`DEBUG: Seeding check for user: ${auth.currentUser.email} (isAdmin: ${isAdminUser}, force: ${force})`);

  try {
    // Check listings first as they are public-readable
    const listingsSnap = await getDocs(collection(db, 'listings'));
    
    if (listingsSnap.empty || force) {
      if (!isAdminUser) {
        console.log("Database is empty or force seed requested. Please log in as paul.desplanques@gmail.com to initialize the mock data.");
        return;
      }

      console.log("Seeding database...");
      
      // Ensure current admin user is in Firestore with ADMIN role
      const adminProfile: User = {
        id: auth.currentUser.uid,
        firstName: auth.currentUser.displayName?.split(' ')[0] || 'Admin',
        lastName: auth.currentUser.displayName?.split(' ').slice(1).join(' ') || 'Haven',
        email: auth.currentUser.email || '',
        role: UserRole.ADMIN,
        status: 'APPROVED',
        isVerified: true,
        avatarUrl: auth.currentUser.photoURL || `https://ui-avatars.com/api/?name=Admin&background=1E293B&color=fff`,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', auth.currentUser.uid), adminProfile);

      // Seed users
      for (const user of MOCK_USERS_DB) {
        try {
          await setDoc(doc(db, 'users', user.id), {
            ...user,
            createdAt: user.createdAt || new Date().toISOString()
          });
          console.log(`Seeded user ${user.id}`);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `users/${user.id}`);
        }
      }

      // Seed listings
      for (const listing of MOCK_LISTINGS) {
        try {
          await setDoc(doc(db, 'listings', listing.id), listing);
          console.log(`Seeded listing ${listing.id}`);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `listings/${listing.id}`);
        }
      }

      // Seed bookings
      for (const booking of SEED_BOOKINGS) {
        try {
          await setDoc(doc(db, 'bookings', booking.id), booking);
          console.log(`Seeded booking ${booking.id}`);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `bookings/${booking.id}`);
        }
      }
      console.log("Seeding completed successfully.");
    }
  } catch (e) {
    console.error("Seeding error (top level):", e);
  }
}

// Validate Connection to Firestore
async function testConnection() {
  try {
    // Attempt to read a dummy document to verify connection
    await getDocFromServer(doc(db, 'test', 'connection'));
    // We don't call seedFirestore here anymore, it will be called after login
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}

testConnection();
