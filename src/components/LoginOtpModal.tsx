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
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
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
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="otp-input"
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
                <span>Verifying...</span>
              </>
            ) : (
              'Verify'
            )}
          </button>

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
  );
};
