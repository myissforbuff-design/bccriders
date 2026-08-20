import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Mail,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  ArrowRight,
} from 'lucide-react';
import { store } from '../lib/db';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { ModalPortal } from './ModalPortal';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  useModalDismiss(isOpen, onClose);
  const [step, setStep] = useState<'request' | 'verify' | 'new-password' | 'success'>('request');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [expiryCountdown, setExpiryCountdown] = useState(300);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const otp = digits.join('');

  const formatExpiryTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep('request');
      setDigits(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setLoading(false);
      setResending(false);
      setExpiryCountdown(300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 'verify') {
      setExpiryCountdown(300);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  const handleDigitChange = (index: number, value: string) => {
    const numericChar = value.replace(/\D/g, '');
    if (!numericChar) {
      const newDigits = [...digits];
      newDigits[index] = '';
      setDigits(newDigits);
      return;
    }

    const singleDigit = numericChar.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = singleDigit;
    setDigits(newDigits);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
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

    const nextFocusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextFocusIndex]?.focus();
  };

  // Resend countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Expiry countdown timer (5 minutes = 300s)
  useEffect(() => {
    if (expiryCountdown <= 0) return;
    const timer = setInterval(() => {
      setExpiryCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiryCountdown]);

  if (!isOpen) return null;

  // Handle Step 1: Send OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send OTP code. Please check your email.');
      }

      setStep('verify');
      setCountdown(60);
      setExpiryCountdown(300);
    } catch (err: any) {
      setError(err.message || 'An error occurred while requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return;
    const cleanEmail = email.trim().toLowerCase();
    setResending(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to resend code.');
      }

      setCountdown(60);
      setExpiryCountdown(300);
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setResending(false);
    }
  };

  // Handle Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length < 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, otp: cleanOtp }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid or expired verification code.');
      }

      setStep('new-password');
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please re-enter.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp: cleanOtp,
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update password.');
      }

      // Update local storage store so user can sign in immediately
      store.updateUserPassword(cleanEmail, newPassword.trim());

      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="my-auto max-w-full flex items-center justify-center"
        >
        {/* STEP 1: REQUEST OTP */}
        {step === 'request' && (
          <form onSubmit={handleRequestOtp} className="otp-Form">
            <button
              type="button"
              onClick={onClose}
              className="exitBtn"
              aria-label="Close"
            >
              ×
            </button>

            <span className="mainHeading">Forgot Password</span>
            <p className="otpSubheading">
              Enter your registered email address to receive a 6-digit verification code
            </p>

            {error && (
              <div className="w-full p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-start gap-1.5 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="w-full relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@bccriders.cc"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#f1f5f1] border border-[#d6e4d6] text-xs font-semibold text-[#1b4332] focus:outline-none focus:border-[#1b4332] focus:ring-2 focus:ring-[#74c69d]/20 transition-all"
                autoFocus
              />
              <Mail className="w-4 h-4 text-[#52605d] absolute left-3 top-3 pointer-events-none" />
            </div>

            <button
              className="verifyButton"
              type="submit"
              disabled={loading || !email.trim()}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sending Code...</span>
                </>
              ) : (
                <>
                  <span>Send OTP</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <p className="resendNote">
              Remember your password?{' '}
              <button
                type="button"
                className="resendBtn"
                onClick={onClose}
              >
                Sign In
              </button>
            </p>
          </form>
        )}

        {/* STEP 2: OFFICIAL 6-DIGIT OTP VERIFICATION FORM */}
        {step === 'verify' && (
          <form onSubmit={handleVerifyOtp} className="otp-Form">
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
              <strong className="text-[#1b4332] font-semibold break-all">{email}</strong>
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
                onClick={handleResendOtp}
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
        )}

        {/* STEP 3: SET NEW PASSWORD */}
        {step === 'new-password' && (
          <form onSubmit={handleResetPassword} className="otp-Form">
            <button
              type="button"
              onClick={onClose}
              className="exitBtn"
              aria-label="Close"
            >
              ×
            </button>

            <span className="mainHeading">Set New Password</span>
            <p className="otpSubheading">
              Create a secure new password for{' '}
              <strong className="text-[#1b4332] font-semibold break-all">{email}</strong>
            </p>

            {error && (
              <div className="w-full p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-start gap-1.5 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="w-full space-y-2.5">
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min. 6 chars)"
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[#f1f5f1] border border-[#d6e4d6] text-xs font-semibold text-[#1b4332] focus:outline-none focus:border-[#1b4332] focus:ring-2 focus:ring-[#74c69d]/20 transition-all"
                />
                <Key className="w-4 h-4 text-[#52605d] absolute left-3 top-3 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="text-[#52605d] hover:text-[#1b4332] absolute right-3 top-3 focus:outline-none cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[#f1f5f1] border border-[#d6e4d6] text-xs font-semibold text-[#1b4332] focus:outline-none focus:border-[#1b4332] focus:ring-2 focus:ring-[#74c69d]/20 transition-all"
                />
                <Key className="w-4 h-4 text-[#52605d] absolute left-3 top-3 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-[#52605d] hover:text-[#1b4332] absolute right-3 top-3 focus:outline-none cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              className="verifyButton"
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Update Password</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <p className="resendNote">
              Entered wrong code?{' '}
              <button
                type="button"
                className="resendBtn"
                onClick={() => setStep('verify')}
              >
                Back to OTP
              </button>
            </p>
          </form>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 'success' && (
          <div className="otp-Form">
            <button
              type="button"
              onClick={() => {
                onSuccess(email);
                onClose();
              }}
              className="exitBtn"
              aria-label="Close"
            >
              ×
            </button>

            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-7 h-7 text-[#2d6a4f]" />
            </div>

            <span className="mainHeading">Password Updated!</span>
            <p className="otpSubheading">
              Your password has been changed successfully. You can now use your new credentials to sign in.
            </p>

            <button
              type="button"
              onClick={() => {
                onSuccess(email);
                onClose();
              }}
              className="verifyButton"
            >
              Proceed to Sign In
            </button>
          </div>
        )}
      </motion.div>
    </div>
  </ModalPortal>
);
};
