import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Mail,
  Key,
  CheckCircle2,
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
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (isOpen) {
      setOtp('');
      setError('');
      setInfoMessage(`A 6-digit authorization code was sent to ${maskedEmail || email}`);
      setLoading(false);
      setResending(false);
      setCountdown(60);
    }
  }, [isOpen, email, maskedEmail]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setError('Please enter the complete 6-digit OTP code.');
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

      setInfoMessage(`A fresh verification code was sent to ${maskedEmail || email}`);
      setCountdown(60);
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
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          <div className="p-3.5 rounded-2xl bg-[#f0f9f1] border border-[#74c69d]/40 flex items-start gap-3">
            <Mail className="w-5 h-5 text-[#2d6a4f] shrink-0 mt-0.5" />
            <div className="text-xs text-[#1b4332] space-y-1">
              <p className="font-bold">Enter the 6-Digit Code</p>
              <p className="text-[#52605d] leading-relaxed">
                For security purposes, an authorization OTP was sent to{' '}
                <strong className="text-[#1b4332] font-mono">{maskedEmail || email}</strong> via{' '}
                <span className="font-mono text-[#2d6a4f] font-semibold">noreply@bccriders.cc</span>.
              </p>
            </div>
          </div>

          {infoMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{infoMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="text-[#2d3a3a] font-bold text-xs mb-1.5 block">
                Verification Code (6 Digits)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="• • • • • •"
                  required
                  autoFocus
                  className="w-full text-center tracking-[12px] font-mono text-2xl py-3.5 rounded-2xl bg-[#f7f9f7] border-2 border-[#e2ece2] focus:border-[#2d6a4f] text-[#1b4332] font-black focus:outline-none transition-all placeholder:tracking-widest"
                />
                <Key className="w-4 h-4 text-[#52605d] absolute left-4 top-4.5 pointer-events-none" />
              </div>
              <p className="text-[11px] text-[#52605d] mt-1.5 text-center">
                Code expires in 5 minutes.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-3.5 rounded-2xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-stone-500 hover:text-stone-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={countdown > 0 || resending}
                  className="text-[#2d6a4f] hover:text-[#1b4332] font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
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
