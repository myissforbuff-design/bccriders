/**
 * Biometric Authentication Module (WebAuthn / Passkeys)
 * Supports Fingerprint, Touch ID, Face ID on Android and iOS mobile browsers
 *
 * The ceremony is server-driven. The browser no longer decides who signed in:
 *
 *   1. `POST /api/auth/webauthn/challenge` — the server issues a single-use random challenge.
 *      (Previously generated locally with crypto.getRandomValues, which proves nothing to anyone.)
 *   2. `navigator.credentials.get/create` runs the device's fingerprint / Face ID sensor.
 *   3. The assertion is sent to the server, which verifies the signature against the credential's
 *      stored public key and only then returns a session token.
 *
 * The local `bcc_biometric_credentials_v1` list is now just a UI convenience — it decides which
 * credential to *offer*, never who you are.
 */

import { getAuthToken } from './storageSecurity';
import { formatApiUrl } from './db';

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
const BACKUP_KEY = 'bcc_biometric_backup_vault';

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

// Check if device is a mobile phone or tablet
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua);
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  return isMobileUA || (hasTouch && isSmallScreen);
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
    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(BACKUP_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
      if (window.sessionStorage) {
        const sRaw = window.sessionStorage.getItem(STORAGE_KEY);
        if (sRaw) {
          const parsed = JSON.parse(sRaw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Error reading stored biometrics:', err);
  }
  return [];
}

/**
 * Save biometric credentials in storage with redundant persistence.
 */
export function saveStoredBiometrics(list: BiometricCredentialInfo[]): void {
  try {
    if (typeof window !== 'undefined') {
      const serialized = JSON.stringify(list);
      if (window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, serialized);
        window.localStorage.setItem(BACKUP_KEY, serialized);
      }
      if (window.sessionStorage) {
        window.sessionStorage.setItem(STORAGE_KEY, serialized);
      }
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
 * Requests a single-use challenge from the server. Everything downstream is worthless without it —
 * a locally generated challenge can be replayed, and the server has no way to know it issued one.
 */
async function fetchServerChallenge(
  purpose: 'register' | 'authenticate',
  userIdOrUsername?: string
): Promise<{
  ok: boolean;
  challenge?: string;
  allowCredentials?: Array<{ id: string; transports?: string[] }>;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-session-token'] = token;
    }

    const res = await fetch(formatApiUrl('/api/auth/webauthn/challenge'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ purpose, userId: userIdOrUsername || undefined }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.challenge) {
      return { ok: false, error: data?.error || 'Could not start biometric verification with the server.' };
    }
    return { ok: true, challenge: data.challenge, allowCredentials: data.allowCredentials || [] };
  } catch {
    return {
      ok: false,
      error: 'Could not reach the server to start biometric verification. Check your connection.',
    };
  }
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

    const challengeResult = await fetchServerChallenge('register');
    if (!challengeResult.ok || !challengeResult.challenge) {
      return {
        success: false,
        error: challengeResult.error || 'Could not obtain a registration challenge from the server.',
      };
    }
    const challenge = base64UrlToBuffer(challengeResult.challenge);

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
    const attestation = credential.response as AuthenticatorAttestationResponse;

    // The public key is the entire point of this change: without it the server can never verify a
    // future assertion. `getPublicKey()` exists in Chrome 85+ / Safari 15+; anything older gets a
    // clear message instead of a credential that would silently fail to verify at sign-in.
    const publicKeyBuffer =
      typeof attestation.getPublicKey === 'function' ? attestation.getPublicKey() : null;
    if (!publicKeyBuffer) {
      return {
        success: false,
        error:
          'This browser cannot expose the credential key required to verify fingerprint sign-in. ' +
          'Please update your browser, or continue using password sign-in.',
      };
    }

    const newEntry: BiometricCredentialInfo = {
      credentialId,
      userId: user.id,
      username: user.username,
      name: user.name,
      deviceName: getDeviceDescription(),
      createdAt: new Date().toISOString(),
    };

    // Register with the server FIRST. If the server won't store the key, this credential cannot be
    // used to sign in — saving it locally would just produce a button that always fails.
    const token = getAuthToken();
    if (!token) {
      return {
        success: false,
        error: 'Your session has expired. Please sign in again before enabling fingerprint login.',
      };
    }

    try {
      const res = await fetch(formatApiUrl('/api/auth/webauthn/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-session-token': token,
        },
        body: JSON.stringify({
          credentialId,
          publicKey: bufferToBase64Url(publicKeyBuffer),
          clientDataJSON: bufferToBase64Url(attestation.clientDataJSON),
          transports:
            typeof attestation.getTransports === 'function'
              ? attestation.getTransports()
              : ['internal'],
          deviceName: newEntry.deviceName,
          username: user.username,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return {
          success: false,
          error: data?.error || 'The server rejected this biometric credential.',
        };
      }
    } catch {
      return {
        success: false,
        error: 'Could not reach the server to register this credential. Please try again.',
      };
    }

    // Server accepted and stored the key — only now remember it locally, so the sign-in screen
    // knows to offer this credential.
    const currentList = getStoredBiometrics();
    const filtered = currentList.filter(
      (c) => c.userId !== user.id && c.credentialId !== credentialId
    );
    filtered.unshift(newEntry);
    saveStoredBiometrics(filtered);

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
  /** Server-signed session token. Sign-in is only legitimate when this is present. */
  token?: string;
  /** True when the server accepted an unverifiable legacy credential — prompt a re-enrolment. */
  reenrollmentRequired?: boolean;
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

    // Ask the server for the challenge and for the credential IDs it actually has on file. The
    // server list is authoritative: a stale or planted localStorage entry can no longer steer the
    // ceremony toward a credential the server doesn't recognise.
    const lookupHint = targetUser?.username || targetUser?.id || storedList[0]?.username || '';
    const challengeResult = await fetchServerChallenge('authenticate', lookupHint);
    if (!challengeResult.ok || !challengeResult.challenge) {
      return { success: false, error: challengeResult.error || 'Could not start biometric verification.' };
    }

    const serverCreds = challengeResult.allowCredentials || [];
    let allowCredentials: PublicKeyCredentialDescriptor[] | undefined;

    if (serverCreds.length > 0) {
      allowCredentials = serverCreds.map((c) => ({
        id: base64UrlToBuffer(c.id) as any,
        type: 'public-key',
        transports: (c.transports as AuthenticatorTransport[]) || ['internal'],
      }));
    } else if (storedList.length > 0) {
      // No server-side record for this hint (or no username typed). Offer what the device knows and
      // let the server reject it if the credential isn't registered.
      const candidates = targetUser
        ? storedList.filter(
            (c) =>
              c.userId.toLowerCase() === targetUser.id.toLowerCase() ||
              c.username.toLowerCase() === targetUser.username.toLowerCase()
          )
        : storedList;
      const list = candidates.length > 0 ? candidates : storedList;
      allowCredentials = list.map((c) => ({
        id: base64UrlToBuffer(c.credentialId) as any,
        type: 'public-key',
        transports: ['internal'],
      }));
    } else {
      return {
        success: false,
        error:
          'No registered fingerprint or biometric profile found for this account. Please sign in with your password and enable fingerprint login in Settings > Security.',
      };
    }

    const requestOptions: PublicKeyCredentialRequestOptions = {
      challenge: base64UrlToBuffer(challengeResult.challenge),
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

    const response = assertion.response as AuthenticatorAssertionResponse;
    const credentialId = bufferToBase64Url(assertion.rawId);

    // Hand the assertion to the server. It verifies the signature against the stored public key and
    // decides *who this is* — the old code picked `storedList[0]` when nothing matched, which could
    // sign a rider into someone else's account on a shared phone.
    let verifyData: any = {};
    try {
      const res = await fetch(formatApiUrl('/api/auth/webauthn/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId,
          clientDataJSON: bufferToBase64Url(response.clientDataJSON),
          authenticatorData: bufferToBase64Url(response.authenticatorData),
          signature: bufferToBase64Url(response.signature),
        }),
      });
      verifyData = await res.json().catch(() => ({}));
      if (!res.ok || !verifyData?.success || !verifyData?.token) {
        return {
          success: false,
          error: verifyData?.error || 'The server could not verify this fingerprint. Please use password sign-in.',
        };
      }
    } catch {
      return {
        success: false,
        error: 'Could not reach the server to verify your fingerprint. Check your connection and try again.',
      };
    }

    const verifiedUserId = String(verifyData.userId || '');
    const matched =
      storedList.find((c) => c.credentialId === credentialId) ||
      storedList.find((c) => c.userId === verifiedUserId);

    return {
      success: true,
      matchedCredential: matched || undefined,
      userId: verifiedUserId,
      username: matched?.username,
      token: String(verifyData.token),
      reenrollmentRequired: Boolean(verifyData.reenrollmentRequired),
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
