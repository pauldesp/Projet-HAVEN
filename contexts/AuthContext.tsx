import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, UserRole, UserStatus } from '../types';
import { auth, db, googleProvider, seedFirestore } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, query, where, collection, getDocs } from 'firebase/firestore';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  register: (userData: User, password?: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => void;
  updateUserRole: (role: UserRole) => void;
  refreshUser: () => Promise<void>;
  checkUserExists: (identifier: string) => Promise<{ exists: boolean; email?: string; phone?: string }>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Vérifier la session au chargement
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Attempt seeding after login in background
        seedFirestore().catch(console.error);
        
        try {
          // Listen for real-time updates to the user document
          if (unsubscribeSnapshot) unsubscribeSnapshot();
          
          unsubscribeSnapshot = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
              let userData = docSnapshot.data() as User;
              
              setCurrentUser(userData);
            } else {
              setCurrentUser(null);
            }
            setIsLoading(false);
          }, (error) => {
            console.error("User snapshot error", error);
            setIsLoading(false);
          });
        } catch (e) {
          console.error("Auth init error", e);
          setCurrentUser(null);
          setIsLoading(false);
        }
      } else {
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        setCurrentUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const login = async (email: string, password?: string): Promise<boolean> => {
    if (!password) return false;
    setIsLoading(true);
    console.log("Attempting login for", email);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Firebase auth success", userCredential.user.uid);
      seedFirestore().catch(console.error);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      console.log("User doc fetch result", userDoc.exists());
      
      let userData: User;
      
      if (userDoc.exists()) {
        userData = userDoc.data() as User;
      } else {
        // Auto-bootstrap Firestore profile if user exists in Firebase Auth but document is missing
        console.log("Firestore profile missing. Self-bootstrapping profile document.");
        userData = {
          id: userCredential.user.uid,
          firstName: userCredential.user.displayName?.split(' ')[0] || 'User',
          lastName: userCredential.user.displayName?.split(' ').slice(1).join(' ') || '',
          email: email,
          role: UserRole.TENANT,
          status: 'PENDING',
          isVerified: userCredential.user.emailVerified,
          avatarUrl: `https://ui-avatars.com/api/?name=User&background=1E293B&color=fff`,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      }
      
      setCurrentUser(userData);
      setIsLoading(false);
      return true;
    } catch (e: any) {
      console.error("Login error", e);
      if (e.code === 'auth/operation-not-allowed') {
        throw new Error("La connexion par email n'est pas activée dans la console Firebase. Veuillez l'activer dans Authentication > Sign-in method.");
      }
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: User, password?: string): Promise<boolean> => {
    if (!password) return false;
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, password);
      const newUser = { 
        ...userData, 
        id: userCredential.user.uid, 
        role: UserRole.TENANT,
        status: 'PENDING' as UserStatus,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      seedFirestore().catch(console.error);
      setCurrentUser(newUser);
      setIsLoading(false);
      return true;
    } catch (e: any) {
      console.error("Register error", e);
      if (e.code === 'auth/operation-not-allowed') {
        throw new Error("L'inscription par email n'est pas activée dans la console Firebase. Veuillez l'activer dans Authentication > Sign-in method.");
      }
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      
      if (userDoc.exists()) {
        setCurrentUser(userDoc.data() as User);
      } else {
        // Create new user profile for Google login
        const newUser: User = {
          id: result.user.uid,
          firstName: result.user.displayName?.split(' ')[0] || 'User',
          lastName: result.user.displayName?.split(' ').slice(1).join(' ') || '',
          email: result.user.email || '',
          role: UserRole.TENANT,
          status: 'PENDING',
          avatarUrl: result.user.photoURL || `https://ui-avatars.com/api/?name=${result.user.displayName}&background=1E293B&color=fff`,
          isVerified: true
        };
        await setDoc(doc(db, 'users', result.user.uid), newUser);
        seedFirestore().catch(console.error);
        setCurrentUser(newUser);
      }
      setIsLoading(false);
      return true;
    } catch (e) {
      console.error("Google Login error", e);
    }
    setIsLoading(false);
    return false;
  };

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  const updateUserRole = async (role: UserRole) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, role };
      await updateDoc(doc(db, 'users', currentUser.id), { role });
      setCurrentUser(updatedUser);
    }
  };

  const refreshUser = async () => {
    if (!auth.currentUser) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setCurrentUser(userDoc.data() as User);
      }
    } catch (e) {
      console.error("Error refreshing user profile", e);
    }
  };

  const checkUserExists = async (identifier: string): Promise<{ exists: boolean; email?: string; phone?: string }> => {
    console.log("Checking if user exists:", identifier);
    const isEmail = identifier.includes('@');
    const field = isEmail ? 'email' : 'phone';
    
    try {
      const q = query(collection(db, 'users'), where(field, '==', identifier));
      const querySnapshot = await getDocs(q);
      console.log("User exists check result:", !querySnapshot.empty);
      
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data() as User;
        return { 
          exists: true, 
          email: userData.email, 
          phone: userData.phone 
        };
      }
    } catch (e) {
      console.error("Error checking user existence:", e);
    }
    
    return { exists: false };
  };

  const resetPassword = async (email: string) => {
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e) {
      console.error("Reset password error", e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      isLoading, 
      login, 
      register,
      loginWithGoogle,
      logout, 
      updateUserRole,
      refreshUser,
      checkUserExists,
      resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
