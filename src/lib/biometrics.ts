/**
 * Utility helpers for Web Authentication (WebAuthn / Passkeys / Fingerprint biometric authentication).
 * Allows users on supported mobile/desktop devices with biometric sensors to enroll their fingerprint
 * and log in directly, completely bypassing the OTP requirement.
 */

// Helper to convert base64/base64url string to Uint8Array
export function base64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Standard = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64Standard);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper to convert ArrayBuffer or Uint8Array to base64url string
export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Check if the current device & browser support WebAuthn and platform biometric authenticators (e.g. fingerprint / Touch ID)
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return isAvailable;
    }
    return true;
  } catch (err) {
    console.warn('Biometric availability check notice:', err);
    return false;
  }
}

/**
 * Register fingerprint/biometric credential for the currently logged in user
 */
export async function registerBiometricCredential(user: { id: string; username: string; name?: string }): Promise<{
  success: boolean;
  credentialId?: string;
  error?: string;
}> {
  try {
    const isSupported = await isBiometricAvailable();
    if (!isSupported) {
      return { success: false, error: 'Fingerprint / Biometric authentication is not supported or not enabled on this device.' };
    }

    // Generate a secure challenge
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userIdBytes = new TextEncoder().encode(user.id || user.username);

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'BCC Riders Club',
        id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
      },
      user: {
        id: userIdBytes,
        name: user.username,
        displayName: user.name || user.username,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Platform = embedded biometric sensor (Fingerprint, Touch ID, Face Unlock)
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: 'Fingerprint registration cancelled or failed.' };
    }

    const rawIdBase64 = bufferToBase64Url(credential.rawId);

    return {
      success: true,
      credentialId: rawIdBase64,
    };
  } catch (err: any) {
    console.error('Biometric enrollment error:', err);
    let errMsg = 'Failed to register fingerprint.';
    const msg = String(err?.message || '');
    if (
      msg.includes('publickey-credentials') ||
      msg.includes('Permissions Policy') ||
      msg.includes('cross-origin') ||
      err.name === 'SecurityError'
    ) {
      errMsg = 'Biometric sensor access is restricted inside embedded browser frames. Please open the app directly or sign in using your username and password.';
    } else if (err.name === 'NotAllowedError') {
      errMsg = 'Fingerprint setup cancelled or permission denied by user.';
    } else if (err.name === 'InvalidStateError') {
      errMsg = 'This fingerprint credential is already registered on this device.';
    } else if (err.name === 'NotSupportedError') {
      errMsg = 'Biometric passkeys are not supported by this browser. Please use standard password sign-in.';
    } else if (msg) {
      errMsg = msg;
    }
    return { success: false, error: errMsg };
  }
}

/**
 * Authenticate using fingerprint/biometric credential
 */
export async function authenticateBiometricCredential(
  allowedCredentialIds?: string[]
): Promise<{
  success: boolean;
  credentialId?: string;
  error?: string;
}> {
  try {
    const isSupported = await isBiometricAvailable();
    if (!isSupported) {
      return { success: false, error: 'Biometric authentication is not supported on this device.' };
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const allowCredentials: PublicKeyCredentialDescriptor[] = (allowedCredentialIds || [])
      .filter(Boolean)
      .map((id) => ({
        id: base64ToUint8Array(id),
        type: 'public-key',
        transports: ['internal'],
      }));

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'required',
      timeout: 60000,
    };

    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return { success: false, error: 'Fingerprint verification cancelled.' };
    }

    const rawIdBase64 = bufferToBase64Url(assertion.rawId);

    return {
      success: true,
      credentialId: rawIdBase64,
    };
  } catch (err: any) {
    console.error('Biometric authentication error:', err);
    let errMsg = 'Fingerprint verification failed.';
    const msg = String(err?.message || '');
    if (
      msg.includes('publickey-credentials') ||
      msg.includes('Permissions Policy') ||
      msg.includes('cross-origin') ||
      err.name === 'SecurityError'
    ) {
      errMsg = 'Biometric sensor access is restricted inside embedded browser frames. Please open the app directly or sign in using your username and password.';
    } else if (err.name === 'NotAllowedError') {
      errMsg = 'Fingerprint scan was cancelled or timed out.';
    } else if (err.name === 'NotSupportedError') {
      errMsg = 'Biometric passkeys are not supported by this browser. Please use standard password sign-in.';
    } else if (msg) {
      errMsg = msg;
    }
    return { success: false, error: errMsg };
  }
}
