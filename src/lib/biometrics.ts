/**
 * Biometric Authentication Module (WebAuthn / Passkeys)
 * Supports Fingerprint, Touch ID, Face ID on Android and iOS mobile browsers
 */

export interface BiometricCredentialInfo {
  credentialId: string;
  userId: string;
  username: string;
  name: string;
  deviceName: string;
  createdAt: string;
  transports?: string[];
}

const STORAGE_KEY = 'bcc_biometric_credentials_v1';

// Helper: Convert ArrayBuffer to Base64URL string
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Helper: Convert Base64URL string to Uint8Array
export function base64UrlToBuffer(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Generate human-friendly device name
export function getDeviceDescription(): string {
  if (typeof navigator === 'undefined') return 'Mobile Device';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return 'iPhone / iPad (Touch ID / Face ID)';
  if (/Android/.test(ua)) return 'Android Device (Fingerprint)';
  if (/Macintosh/.test(ua)) return 'Mac (Touch ID)';
  if (/Windows/.test(ua)) return 'Windows PC (Windows Hello / Fingerprint)';
  return 'Mobile Biometrics';
}

/**
 * Checks if Biometric / Platform Authenticator is supported by the device and browser.
 */
export async function isBiometricsSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;
  if (!navigator.credentials || !navigator.credentials.create || !navigator.credentials.get) {
    return false;
  }
  try {
    const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return Boolean(isAvailable);
  } catch {
    return false;
  }
}

/**
 * Get all biometric credentials registered in this browser.
 */
export function getStoredBiometrics(): BiometricCredentialInfo[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading stored biometrics:', err);
  }
  return [];
}

/**
 * Save biometric credentials in storage.
 */
export function saveStoredBiometrics(list: BiometricCredentialInfo[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.warn('Error saving biometrics:', err);
  }
}

/**
 * Get registered biometric credential for a specific user ID or username.
 */
export function getBiometricForUser(userIdOrUsername: string): BiometricCredentialInfo | null {
  if (!userIdOrUsername) return null;
  const list = getStoredBiometrics();
  const search = userIdOrUsername.trim().toLowerCase();
  return (
    list.find(
      (c) =>
        c.userId.toLowerCase() === search ||
        c.username.toLowerCase() === search
    ) || null
  );
}

/**
 * Register Biometrics (Fingerprint / Touch ID / Face ID) for the logged-in user.
 */
export async function registerBiometricCredential(user: {
  id: string;
  username: string;
  name: string;
}): Promise<{ success: boolean; error?: string; credential?: BiometricCredentialInfo }> {
  try {
    const supported = await isBiometricsSupported();
    if (!supported) {
      return {
        success: false,
        error: 'Biometric authentication is not supported or enabled on this device/browser. Please check your device security settings.',
      };
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Convert user ID to Uint8Array
    const enc = new TextEncoder();
    const userIdBuffer = enc.encode(user.id);

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'BCC Riders Club',
        id: window.location.hostname || undefined,
      },
      user: {
        id: userIdBuffer,
        name: user.username,
        displayName: user.name || user.username,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Enforce local fingerprint/Face ID sensor
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
      return { success: false, error: 'Registration cancelled or no biometric credential created.' };
    }

    const credentialId = bufferToBase64Url(credential.rawId);
    const newEntry: BiometricCredentialInfo = {
      credentialId,
      userId: user.id,
      username: user.username,
      name: user.name,
      deviceName: getDeviceDescription(),
      createdAt: new Date().toISOString(),
    };

    // Save locally
    const currentList = getStoredBiometrics();
    const filtered = currentList.filter(
      (c) => c.userId !== user.id && c.credentialId !== credentialId
    );
    filtered.unshift(newEntry);
    saveStoredBiometrics(filtered);

    // Also sync to server database if available
    try {
      fetch('/api/mongodb/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `bio_${user.id}`,
          category: 'biometrics',
          userId: user.id,
          username: user.username,
          credentialId,
          deviceName: newEntry.deviceName,
          createdAt: newEntry.createdAt,
        }),
      }).catch(() => {});
    } catch {}

    return { success: true, credential: newEntry };
  } catch (err: any) {
    console.error('Biometric registration error:', err);
    let msg = err?.message || 'Failed to register biometric credential.';
    if (err?.name === 'NotAllowedError') {
      msg = 'Biometric prompt was cancelled or permission was denied.';
    } else if (err?.name === 'InvalidStateError') {
      msg = 'This biometric credential is already registered on this device.';
    }
    return { success: false, error: msg };
  }
}

/**
 * Authenticate using Biometrics (Fingerprint / Touch ID / Face ID).
 */
export async function authenticateBiometricCredential(
  targetUser?: { id: string; username: string }
): Promise<{
  success: boolean;
  error?: string;
  matchedCredential?: BiometricCredentialInfo;
  userId?: string;
  username?: string;
}> {
  try {
    const supported = await isBiometricsSupported();
    if (!supported) {
      return {
        success: false,
        error: 'Biometrics is not supported on this device/browser.',
      };
    }

    const storedList = getStoredBiometrics();
    if (storedList.length === 0) {
      return {
        success: false,
        error: 'No registered fingerprint or biometric profile found on this device. Please sign in with your password and enable fingerprint login in Settings > Security.',
      };
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Filter allowed credentials if a specific user was requested
    let allowCredentials: PublicKeyCredentialDescriptor[] | undefined = undefined;
    if (targetUser) {
      const userCreds = storedList.filter(
        (c) =>
          c.userId.toLowerCase() === targetUser.id.toLowerCase() ||
          c.username.toLowerCase() === targetUser.username.toLowerCase()
      );
      if (userCreds.length > 0) {
        allowCredentials = userCreds.map((c) => ({
          id: base64UrlToBuffer(c.credentialId) as any,
          type: 'public-key',
          transports: ['internal'],
        }));
      }
    } else if (storedList.length > 0) {
      allowCredentials = storedList.map((c) => ({
        id: base64UrlToBuffer(c.credentialId) as any,
        type: 'public-key',
        transports: ['internal'],
      }));
    }

    const requestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: window.location.hostname || undefined,
      allowCredentials,
      userVerification: 'required',
      timeout: 60000,
    };

    const assertion = (await navigator.credentials.get({
      publicKey: requestOptions,
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return { success: false, error: 'Biometric verification cancelled.' };
    }

    const rawIdStr = bufferToBase64Url(assertion.rawId);
    // Match the raw ID to stored credential
    const matched = storedList.find((c) => c.credentialId === rawIdStr) || storedList[0];

    if (!matched) {
      return { success: false, error: 'Unrecognized biometric credential.' };
    }

    return {
      success: true,
      matchedCredential: matched,
      userId: matched.userId,
      username: matched.username,
    };
  } catch (err: any) {
    console.error('Biometric authentication error:', err);
    let msg = err?.message || 'Biometric authentication failed.';
    if (err?.name === 'NotAllowedError') {
      msg = 'Biometric scan was cancelled or timed out.';
    }
    return { success: false, error: msg };
  }
}

/**
 * Remove / unregister a biometric credential for a user.
 */
export function removeBiometricCredential(userId: string): void {
  const list = getStoredBiometrics();
  const filtered = list.filter((c) => c.userId !== userId);
  saveStoredBiometrics(filtered);
}
