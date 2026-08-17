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
} from 'lucide-react';
import { OfficialDotSpinner } from './OfficialLoader';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface LoginOtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  maskedEmail: string;
  userId?: string;
  usernameOrEmail: string;
  passwordAttempt: string;
  onSuccess: (userId: string) => void;
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
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric characters
    const numericChar = value.replace(/\D/g, '');
    if (!numericChar) {
      const newDigits = [...digits];
      newDigits[index] = '';
      setDigits(newDigits);
      return;
    }

    // Take the last character typed if multiple were somehow entered
    const singleDigit = numericChar.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = singleDigit;
    setDigits(newDigits);

    // Automatically advance focus to the next input box
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
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
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
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
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: cleanOtp,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid or expired verification code.');
      }

      // Successful verification
      const targetUserId = data.userId || userId;
      onSuccess(targetUserId);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
      setLoading(false);
    }
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#e2ece2] relative my-auto max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#e2ece2] relative bg-[#f7f9f7] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200/60 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1b4332] text-white flex items-center justify-center shadow-md shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#74c69d]" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-lg text-[#1b4332] leading-tight">
                Two-Factor Authorization
              </h3>
              <p className="text-xs text-[#52605d]">
                Security verification for sign-in
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
          <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#f0f9f1] border border-[#74c69d]/40 flex items-start gap-2.5 sm:gap-3">
            <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-[#2d6a4f] shrink-0 mt-0.5" />
            <div className="text-xs text-[#1b4332] space-y-0.5 sm:space-y-1">
              <p className="font-bold">Enter the 6-Digit Code</p>
              <p className="text-[#52605d] leading-relaxed">
                For security purposes, an authorization OTP was sent to{' '}
                <strong className="text-[#1b4332] font-mono">{maskedEmail || email}</strong>.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4 sm:space-y-5">
            <div>
              <label className="text-[#2d3a3a] font-bold text-xs mb-2 block text-center">
                Verification Code (6 Digits)
              </label>

              {/* 6 Individual Digit Input Boxes with responsive sizing */}
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5 max-w-[320px] sm:max-w-sm mx-auto">
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    aria-label={`Digit ${index + 1}`}
                    className={`w-full h-11 sm:h-13 text-center font-mono text-lg sm:text-2xl font-black rounded-xl sm:rounded-2xl border-2 transition-all outline-none ${
                      digit
                        ? 'border-[#1b4332] bg-white text-[#1b4332] shadow-sm'
                        : 'border-[#d6e4d6] bg-[#f7f9f7] text-[#1b4332]'
                    } focus:border-[#1b4332] focus:bg-white focus:ring-4 focus:ring-[#74c69d]/25`}
                  />
                ))}
              </div>

              <p className="text-[11px] text-[#52605d] mt-2 text-center">
                {expiryCountdown > 0 ? (
                  <span>
                    Code expires in{' '}
                    <span className="font-mono font-bold text-[#1b4332]">
                      {formatExpiryTime(expiryCountdown)}
                    </span>
                  </span>
                ) : (
                  <span className="text-rose-600 font-semibold">
                    Code has expired. Please request a new code.
                  </span>
                )}
              </p>
            </div>

            <div className="pt-1 sm:pt-2 flex flex-col gap-2.5">
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </div>
                ) : (
                  <>
                    <span>Authorize Sign-In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-stone-500 hover:text-stone-800 font-semibold cursor-pointer py-1"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={countdown > 0 || resending}
                  className="text-[#2d6a4f] hover:text-[#1b4332] font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 py-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  <span>
                    {resending
                      ? 'Resending...'
                      : countdown > 0
                      ? `Resend Code (${countdown}s)`
                      : 'Resend Code'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="p-3.5 bg-[#fafcfa] border-t border-[#e2ece2] text-center text-[11px] text-[#747d7c] flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[#2d6a4f]" />
          <span>BCC Riders Club 2FA Security System</span>
        </div>
      </motion.div>
    </div>
  );
};
