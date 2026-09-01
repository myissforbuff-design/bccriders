/**
 * 4-Digit PIN Authentication Module
 * Provides fast, secure 4-digit PIN login for mobile & desktop devices without biometric hardware.
 */

import { formatApiUrl } from './db';
import { getAuthToken } from './storageSecurity';

export interface DevicePinInfo {
  userId: string;
  username: string;
  name: string;
  avatar?: string;
  createdAt: string;
  deviceName: string;
}

const PIN_STORAGE_KEY = 'bcc_device_pin_credentials_v1';

// Helper to get device name
export function getPinDeviceName(): string {
  if (typeof navigator === 'undefined') return 'This Device';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return 'Apple iOS Device';
  if (/Android/.test(ua)) return 'Android Device';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  return 'Mobile / Browser Device';
}

/**
 * Get all users with PIN configured on this local browser device
 */
export function getStoredDevicePins(): DevicePinInfo[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse device PINs:', err);
    return [];
  }
}

/**
 * Get PIN info for a specific user ID or username
 */
export function getDevicePinForUser(userIdOrUsername?: string): DevicePinInfo | null {
  if (!userIdOrUsername) return null;
  const list = getStoredDevicePins();
  const search = String(userIdOrUsername).trim().toLowerCase();
  return (
    list.find(
      (item) =>
        item.userId.toLowerCase() === search ||
        item.username.toLowerCase() === search
    ) || null
  );
}

/**
 * Save device PIN credential metadata locally
 */
export function saveDevicePinCredential(info: DevicePinInfo): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const list = getStoredDevicePins().filter(
      (item) => item.userId !== info.userId && item.username.toLowerCase() !== info.username.toLowerCase()
    );
    list.push(info);
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to save device PIN credential:', err);
  }
}

/**
 * Remove device PIN credential metadata locally
 */
export function removeDevicePinCredential(userIdOrUsername: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const search = String(userIdOrUsername).trim().toLowerCase();
    const list = getStoredDevicePins().filter(
      (item) =>
        item.userId.toLowerCase() !== search &&
        item.username.toLowerCase() !== search
    );
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to remove device PIN credential:', err);
  }
}

/**
 * Register or update 4-digit PIN for current user (Authenticated)
 */
export async function registerUserPin(
  pin: string,
  user: { id: string; username: string; name: string; avatar?: string }
): Promise<{ success: boolean; error?: string; message?: string }> {
  const cleanPin = String(pin || '').trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    return { success: false, error: 'PIN must be exactly 4 digits (0-9).' };
  }

  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-session-token'] = token;
  }

  try {
    const res = await fetch(formatApiUrl('/api/auth/pin/register'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ pin: cleanPin }),
    });

    let data: any = {};
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: 'Failed to process server response.' };
    }

    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to save 4-digit PIN.' };
    }

    // Save local device credential
    saveDevicePinCredential({
      userId: user.id,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
      createdAt: data.enrolledAt || new Date().toISOString(),
      deviceName: getPinDeviceName(),
    });

    return { success: true, message: data.message || '4-Digit PIN configured successfully.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while configuring PIN.' };
  }
}

/**
 * Verify 4-digit PIN and obtain session token
 */
export async function verifyUserPin(
  username: string,
  pin: string
): Promise<{
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
  locked?: boolean;
  attemptsRemaining?: number;
}> {
  const cleanUsername = String(username || '').trim();
  const cleanPin = String(pin || '').trim();

  if (!cleanUsername || !cleanPin) {
    return { success: false, error: 'Username and 4-digit PIN are required.' };
  }

  if (!/^\d{4}$/.test(cleanPin)) {
    return { success: false, error: 'PIN must be exactly 4 digits.' };
  }

  try {
    const res = await fetch(formatApiUrl('/api/auth/pin/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, pin: cleanPin }),
    });

    let data: any = {};
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: 'Received invalid response from server.' };
    }

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Invalid 4-digit PIN.',
        locked: !!data.locked,
        attemptsRemaining: data.attemptsRemaining,
      };
    }

    // Update local device record with latest user info
    if (data.user) {
      saveDevicePinCredential({
        userId: data.user.id,
        username: data.user.username,
        name: data.user.name,
        avatar: data.user.avatar,
        createdAt: new Date().toISOString(),
        deviceName: getPinDeviceName(),
      });
    }

    return {
      success: true,
      token: data.token,
      user: data.user,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error connecting to PIN verification server.' };
  }
}

/**
 * Remove 4-digit PIN (Authenticated)
 */
export async function removeUserPin(
  userId: string,
  username?: string
): Promise<{ success: boolean; error?: string }> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-session-token'] = token;
  }

  try {
    const res = await fetch(formatApiUrl('/api/auth/pin/remove'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId }),
    });

    removeDevicePinCredential(userId);
    if (username) removeDevicePinCredential(username);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.error || 'Failed to remove PIN from server.' };
    }

    return { success: true };
  } catch (err: any) {
    // Also remove locally
    removeDevicePinCredential(userId);
    if (username) removeDevicePinCredential(username);
    return { success: true };
  }
}
