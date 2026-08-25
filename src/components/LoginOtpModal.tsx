import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Mail,
  X,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Lock,
  Fingerprint,
} from 'lucide-react';
import { OfficialDotSpinner } from './OfficialLoader';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { ModalPortal } from './ModalPortal';
import { authenticateBiometricCredential, getBiometricForUser } from '../lib/biometrics';

interface LoginOtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  maskedEmail: string;
  userId?: string;
  usernameOrEmail: string;
  passwordAttempt: string;
  onSuccess: (userId: string, token?: string, user?: any) => void;
}

export const LoginOtpModal: React.FC<LoginOtpModalProps> = ({
  isOpen,
  onClose,
  email,
  maskedEmail,
  userId,
  usernameOrEmail,
  passwordAttempt,
  onSuccess,
}) => {
  useModalDismiss(isOpen, onClose);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [expiryCountdown, setExpiryCountdown] = useState(300);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [bioAuthenticating, setBioAuthenticating] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (userId || usernameOrEmail) {
      const bio = getBiometricForUser(userId || usernameOrEmail);
      setHasBiometrics(Boolean(bio));
    }
  }, [userId, usernameOrEmail]);

  const handleBiometricVerify = async () => {
    setError('');
    setBioAuthenticating(true);
    try {
      const result = await authenticateBiometricCredential(
        userId ? { id: userId, username: usernameOrEmail } : undefined
      );

      if (!result.success) {
        setError(result.error || 'Biometric verification cancelled.');
        setBioAuthenticating(false);
        return;
      }

      // Biometric assertion verified server-side — `token` is the proof, so require it.
      if (!result.token) {
        setError(result.error || 'Biometric sign-in could not be verified. Please enter the code instead.');
        return;
      }

      const targetUserId = result.userId || userId || '';
      onSuccess(targetUserId, result.token);
    } catch (err: any) {
      setError(err?.message || 'Biometric verification failed.');
    } finally {
      setBioAuthenticating(false);
    }
  };

  const otp = digits.join('');

  const formatExpiryTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '', '', '']);
      setError('');
      setLoading(false);
      setResending(false);
      setCountdown(60);
      setExpiryCountdown(300);
      // Auto-focus first input on open
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen, email, maskedEmail]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (expiryCountdown <= 0) return;
    const timer = setInterval(() => {
      setExpiryCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiryCountdown]);

  if (!isOpen) return null;

  const triggerVerification = async (codeToVerify: string) => {
    const cleanOtp = (codeToVerify || '').trim();
    if (!cleanOtp || cleanOtp.length < 6 || loading) {
      if (!cleanOtp || cleanOtp.length < 6) {
        setError('Please enter the complete 6-digit verification code.');
      }
      return;
    }

    const startTime = Date.now();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: (email || '').trim().toLowerCase(),
          username: (usernameOrEmail || '').trim(),
          usernameOrEmail: (usernameOrEmail || '').trim(),
          userId: (userId || '').trim(),
          otp: cleanOtp,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid or expired verification code.');
      }

      // Ensure at least 2 full seconds of loading animation before logging in
      const elapsed = Date.now() - startTime;
      const minLoadingTime = 2000; // 2 seconds minimum loading time
      if (elapsed < minLoadingTime) {
        await new Promise((resolve) => setTimeout(resolve, minLoadingTime - elapsed));
      }

      // Successful verification
      const targetUserId = data.userId || userId;
      onSuccess(targetUserId, data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check your code and try again.');
      setLoading(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    if (loading) return;

    // Only accept numeric characters
    const numericChars = value.replace(/\D/g, '');
    if (!numericChars) {
      const newDigits = [...digits];
      newDigits[index] = '';
      setDigits(newDigits);
      return;
    }

    // If multiple digits pasted/typed into a single input box
    if (numericChars.length > 1) {
      const newDigits = [...digits];
      for (let i = 0; i < 6; i++) {
        if (numericChars[i]) {
          newDigits[i] = numericChars[i];
        }
      }
      setDigits(newDigits);
      const fullOtp = newDigits.join('');
      if (fullOtp.length === 6) {
        triggerVerification(fullOtp);
      } else {
        const nextIdx = Math.min(numericChars.length, 5);
        inputRefs.current[nextIdx]?.focus();
      }
      return;
    }

    const singleDigit = numericChars.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = singleDigit;
    setDigits(newDigits);

    // Automatically advance focus to the next input box
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // If all 6 digits are now filled, immediately trigger verification
    const fullOtp = newDigits.join('');
    if (fullOtp.length === 6 && !newDigits.includes('')) {
      triggerVerification(fullOtp);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (loading) return;

    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // If current is empty, move back and clear previous
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const fullOtp = digits.join('');
      if (fullOtp.length === 6) {
        triggerVerification(fullOtp);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (loading) return;
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    setDigits(newDigits);

    // Focus the box after the last pasted digit or the last box
    const nextFocusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextFocusIndex]?.focus();

    // If complete 6-digit code was pasted, automatically trigger verification
    if (pastedData.length === 6) {
      triggerVerification(pastedData);
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    triggerVerification(digits.join(''));
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameOrEmail,
          usernameOrEmail,
          password: passwordAttempt,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to resend code.');
      }

      setDigits(['', '', '', '', '', '']);
      setCountdown(60);
      setExpiryCountdown(300);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="my-auto max-w-full flex items-center justify-center"
        >
          <form onSubmit={handleVerify} className="otp-Form">
            <button
              type="button"
              onClick={onClose}
              className="exitBtn"
              aria-label="Close"
            >
              ×
            </button>

            <span className="mainHeading">Enter OTP</span>
            <p className="otpSubheading">
              We have sent a verification code to{' '}
              <strong className="text-[#1b4332] font-semibold break-all">
                {maskedEmail || email || 'your email'}
              </strong>
            </p>

            {error && (
              <div className="w-full p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-start gap-1.5 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="inputContainer">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-input${index + 1}`}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  required
                  maxLength={1}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={digit}
                  disabled={loading}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className={`otp-input ${loading ? 'opacity-70 cursor-not-allowed bg-emerald-50/50' : ''}`}
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>

            <div className="text-[11px] text-[#52605d] text-center w-full -mt-1">
              {expiryCountdown > 0 ? (
                <span>
                  Code expires in{' '}
                  <span className="font-mono font-bold text-[#1b4332]">
                    {formatExpiryTime(expiryCountdown)}
                  </span>
                </span>
              ) : (
                <span className="text-rose-600 font-semibold">
                  Code expired. Please resend code.
                </span>
              )}
            </div>

            <button
              className="verifyButton"
              type="submit"
              disabled={loading || otp.length < 6}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying & Signing In...</span>
                </>
              ) : (
                'Verify'
              )}
            </button>

            {hasBiometrics && (
              <button
                type="button"
                onClick={handleBiometricVerify}
                disabled={loading || bioAuthenticating}
                className="w-full py-2.5 px-3 rounded-xl bg-[#e8f5e9] hover:bg-[#d8f3dc] text-[#1b4332] font-extrabold text-xs border border-[#b7e4c7] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-[0.99] -mt-1"
              >
                <Fingerprint className="w-4 h-4 text-[#2d6a4f]" />
                <span>
                  {bioAuthenticating
                    ? 'Scanning Fingerprint / Face ID...'
                    : 'Verify with Biometrics'}
                </span>
              </button>
            )}

            <p className="resendNote">
              Didn't receive the code?{' '}
              <button
                type="button"
                className="resendBtn"
                onClick={handleResend}
                disabled={countdown > 0 || resending}
              >
                {resending ? (
                  'Resending...'
                ) : countdown > 0 ? (
                  `Resend in ${countdown}s`
                ) : (
                  'Resend Code'
                )}
              </button>
            </p>
          </form>
        </motion.div>
      </div>
    </ModalPortal>
  );
};
