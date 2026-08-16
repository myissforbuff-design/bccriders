import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  X,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { store } from '../lib/db';

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
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep('request');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setInfoMessage('');
      setLoading(false);
      setResending(false);
    }
  }, [isOpen]);

  // Resend countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

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
    setInfoMessage('');
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

      setInfoMessage(data.message || `Verification code sent to ${cleanEmail}`);
      setStep('verify');
      setCountdown(60);
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

      setInfoMessage(`A fresh verification code was sent to ${cleanEmail}`);
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setResending(false);
    }
  };

  // Handle Step 2: Verify OTP and Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length < 6) {
      setError('Please enter the complete 6-digit OTP verification code.');
      return;
    }

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
        throw new Error(data.error || 'Verification failed. Please check the code.');
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#e2ece2] relative my-auto max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#e2ece2] relative bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 pr-8">
            <div className="w-10 h-10 rounded-2xl bg-[#d8f3dc] text-[#1b4332] flex items-center justify-center shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-heading font-extrabold text-[#1b4332] text-base sm:text-lg leading-tight">
                {step === 'request' && 'Forgot Password'}
                {step === 'verify' && 'Verify Code & Set Password'}
                {step === 'success' && 'Password Updated'}
              </h3>
              <p className="text-[11px] sm:text-xs text-[#52605d] mt-0.5">
                {step === 'request' && 'Enter your email to receive an OTP code'}
                {step === 'verify' && 'Enter the 6-digit code sent via Resend'}
                {step === 'success' && 'Your account password has been changed'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Info Message */}
          {infoMessage && !error && (
            <div className="p-3 rounded-xl bg-[#f0f9f1] border border-[#c8e6c9] text-[#1b4332] text-xs font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#2d6a4f]" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* STEP 1: REQUEST OTP */}
          {step === 'request' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="p-3.5 bg-[#f7f9f7] rounded-2xl border border-[#e2ece2] space-y-1.5">
                <div className="flex items-center gap-2 text-[#1b4332] font-bold text-xs">
                  <Mail className="w-4 h-4 text-[#2d6a4f]" />
                  <span>Email Verification</span>
                </div>
                <p className="text-[11px] text-[#52605d] leading-relaxed">
                  We will send a 6-digit One-Time Password (OTP) from{' '}
                  <strong className="text-[#1b4332]">noreply@bccriders.cc</strong> to verify your account identity.
                </p>
              </div>

              <div>
                <label className="text-[#2d3a3a] font-bold mb-1.5 block">
                  Registered Email Address <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. member@bccriders.cc"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-sm text-[#2d3a3a] font-medium focus:outline-none focus:border-[#2d6a4f]"
                    autoFocus
                  />
                  <Mail className="w-4 h-4 text-[#52605d] absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] disabled:opacity-50 text-white font-extrabold text-xs shadow-md cursor-pointer transition-all flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#74c69d]" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-[#74c69d]" />
                      <span>Send OTP Code</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: ENTER OTP & NEW PASSWORD */}
          {step === 'verify' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="p-3 bg-[#f0f9f1] rounded-2xl border border-[#c8e6c9] flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-[#2d6a4f] block">
                    Sent to Email
                  </span>
                  <span className="font-bold text-[#1b4332] text-xs truncate block">
                    {email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setError('');
                  }}
                  className="text-[11px] text-[#2d6a4f] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change</span>
                </button>
              </div>

              {/* 6-Digit OTP Input */}
              <div>
                <label className="text-[#2d3a3a] font-bold mb-1.5 block">
                  6-Digit OTP Verification Code <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full text-center py-3 rounded-xl bg-[#f7f9f7] border-2 border-[#74c69d] text-lg font-black text-[#1b4332] tracking-[8px] font-mono focus:outline-none focus:border-[#1b4332]"
                    autoFocus
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-[#52605d]">
                  <span>Code expires in 5 minutes</span>
                  {countdown > 0 ? (
                    <span className="text-[#52605d] font-semibold">Resend in {countdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resending}
                      className="text-[#1b4332] hover:text-[#2d6a4f] font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                      <span>Resend Code</span>
                    </button>
                  )}
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="text-[#2d3a3a] font-bold mb-1.5 block">
                  New Password <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 6 chars)"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs font-semibold text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                  />
                  <Key className="w-4 h-4 text-[#52605d] absolute left-3.5 top-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="text-[#52605d] hover:text-[#1b4332] absolute right-3.5 top-3 focus:outline-none cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="text-[#2d3a3a] font-bold mb-1.5 block">
                  Confirm New Password <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-xs font-semibold text-[#2d3a3a] focus:outline-none focus:border-[#2d6a4f]"
                  />
                  <Key className="w-4 h-4 text-[#52605d] absolute left-3.5 top-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-[#52605d] hover:text-[#1b4332] absolute right-3.5 top-3 focus:outline-none cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || otp.length < 6 || !newPassword || !confirmPassword}
                  className="px-5 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] disabled:opacity-50 text-white font-extrabold text-xs shadow-md cursor-pointer transition-all flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#74c69d]" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#74c69d]" />
                      <span>Reset Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 'success' && (
            <div className="py-4 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#d8f3dc] text-[#1b4332] mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-9 h-9 text-[#2d6a4f]" />
              </div>

              <div className="space-y-1.5">
                <h4 className="font-heading font-extrabold text-lg text-[#1b4332]">
                  Password Reset Successfully!
                </h4>
                <p className="text-xs text-[#52605d] leading-relaxed max-w-xs mx-auto">
                  Your password has been changed. You can now use your new password to sign in.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onSuccess(email);
                    onClose();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#74c69d]" />
                  <span>Proceed to Sign In</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
