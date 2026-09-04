import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure safe persistence
setPersistence(auth, browserLocalPersistence).catch(() => {});

/**
 * Sign in with Google using Firebase Auth
 */
export async function authenticateWithGoogle(): Promise<{
  accessToken?: string;
  email?: string | null;
  displayName?: string | null;
}> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    return {
      accessToken: credential?.accessToken,
      email: result.user.email,
      displayName: result.user.displayName,
    };
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked by your browser. Please allow popups or open the app in a new tab.');
    }
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in window was closed before completing authorization.');
    }
    throw new Error(error.message || 'Failed to authenticate with Google.');
  }
}
