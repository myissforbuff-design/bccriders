import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  KeyRound,
  X,
  AlertCircle,
  ArrowRight,
  User as UserIcon,
  Delete,
  Lock,
  Smartphone,
  ChevronDown,
  CheckCircle2,
} from 'lucide-react';
import { OfficialDotSpinner } from './OfficialLoader';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { ModalPortal } from './ModalPortal';
import {
  verifyUserPin,
  getStoredDevicePins,
  DevicePinInfo,
  getDevicePinForUser,
} from '../lib/pinAuth';
import { store } from '../lib/db';

interface PinLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUsername?: string;
  onSuccess: (user: any, token?: string) => void;
  onFallbackToPassword?: () => void;
}

export const PinLoginModal: React.FC<PinLoginModalProps> = ({
  isOpen,
  onClose,
  initialUsername = '',
  onSuccess,
  onFallbackToPassword,
}) => {
  useModalDismiss(isOpen, onClose);
  const [pin, setPin] = useState<string>('');
  const [username, setUsername] = useState<string>(initialUsername);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [rememberedAccounts, setRememberedAccounts] = useState<DevicePinInfo[]>([]);
  const [activeAccount, setActiveAccount] = useState<DevicePinInfo | null>(null);

  // Load remembered PIN accounts
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      const stored = getStoredDevicePins();
      setRememberedAccounts(stored);

      const targetUsername = initialUsername.trim();
      if (targetUsername) {
        setUsername(targetUsername);
        const match = getDevicePinForUser(targetUsername);
        if (match) {
          setActiveAccount(match);
        } else {
          // Find from store users
          const u = store.getUsers().find(
            (usr) => usr.username.toLowerCase() === targetUsername.toLowerCase()
          );
          if (u) {
            setActiveAccount({
              userId: u.id,
              username: u.username,
              name: u.name || u.username,
              avatar: u.avatar,
              createdAt: '',
              deviceName: 'Device',
            });
          }
        }
      } else if (stored.length > 0) {
        // Default to first remembered account
        setActiveAccount(stored[0]);
        setUsername(stored[0].username);
      }
    }
  }, [isOpen, initialUsername]);

  const triggerErrorShake = (msg: string) => {
    setError(msg);
    setIsShaking(true);
    setPin('');
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleVerify = useCallback(
    async (pinToVerify: string) => {
      const cleanUsername = (username || activeAccount?.username || '').trim();
      if (!cleanUsername) {
        triggerErrorShake('Please enter or select your registered username.');
        return;
      }
      if (pinToVerify.length !== 4) {
        triggerErrorShake('PIN must be 4 digits.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const res = await verifyUserPin(cleanUsername, pinToVerify);
        if (!res.success) {
          triggerErrorShake(res.error || 'Incorrect 4-digit PIN.');
          setLoading(false);
          return;
        }

        // Matched user in db
        const user =
          res.user ||
          store.getUsers().find(
            (u) =>
              u.username.toLowerCase() === cleanUsername.toLowerCase() ||
              (res.user?.id && u.id === res.user.id)
          ) ||
          res.user;

        onSuccess(user, res.token);
      } catch (err: any) {
        triggerErrorShake(err?.message || 'Failed to verify PIN.');
      } finally {
        setLoading(false);
      }
    },
    [username, activeAccount, onSuccess]
  );

  // Keypad inputs
  const handleDigitPress = (digit: string) => {
    if (loading || pin.length >= 4) return;
    setError('');
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === 4) {
      handleVerify(newPin);
    }
  };

  const handleBackspace = () => {
    if (loading || pin.length === 0) return;
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    if (loading) return;
    setPin('');
    setError('');
  };

  // Physical keyboard listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in the username input
      if (document.activeElement?.tagName === 'INPUT') {
        if (e.key === 'Enter') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, loading, username, activeAccount, handleVerify, onClose]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{
            scale: 1,
            opacity: 1,
            y: 0,
            x: isShaking ? [-8, 8, -6, 6, -3, 3, 0] : 0,
          }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-[#e2ece2] p-5 sm:p-6 overflow-hidden z-10"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-[#52605d] hover:text-[#1b4332] hover:bg-[#f0f9f1] rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="text-center space-y-2 mb-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[#1b4332] text-white flex items-center justify-center shadow-md">
              <KeyRound className="w-6 h-6 text-[#74c69d]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-heading font-black text-[#1b4332] tracking-tight">
                4-Digit PIN Sign In
              </h2>
              <p className="text-xs text-[#52605d] mt-0.5">
                Quick, secure access for your rider account
              </p>
            </div>
          </div>

          {/* Account Selector / Profile display */}
          <div className="mb-4 relative">
            {activeAccount ? (
              <div className="p-3 bg-[#f7f9f7] rounded-2xl border border-[#d8f3dc] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#1b4332] text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden border border-[#b7e4c7]">
                    {activeAccount.avatar ? (
                      <img
                        src={activeAccount.avatar}
                        alt={activeAccount.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      activeAccount.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="font-extrabold text-xs text-[#1b4332] truncate">
                      {activeAccount.name}
                    </div>
                    <div className="text-[10px] text-[#52605d] truncate">
                      @{activeAccount.username}
                    </div>
                  </div>
                </div>

                {rememberedAccounts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                    className="px-2 py-1 text-[11px] font-bold text-[#1b4332] bg-white border border-[#b7e4c7] rounded-xl hover:bg-[#d8f3dc] transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>Switch</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[#1b4332] uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter your registered username"
                    className="w-full px-3.5 py-2.5 bg-[#f7f9f7] border border-[#e2ece2] rounded-xl text-xs text-[#1b4332] focus:outline-none focus:border-[#2d6a4f] focus:bg-white transition-all font-semibold"
                  />
                  <UserIcon className="w-4 h-4 text-[#52605d] absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Account dropdown switcher */}
            <AnimatePresence>
              {showAccountDropdown && rememberedAccounts.length > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#b7e4c7] rounded-2xl shadow-xl z-30 p-1.5 space-y-1 max-h-48 overflow-y-auto"
                >
                  <div className="px-2 py-1 text-[10px] font-extrabold text-[#52605d] uppercase tracking-wider">
                    Select Enrolled Account
                  </div>
                  {rememberedAccounts.map((acc) => (
                    <button
                      key={acc.userId}
                      type="button"
                      onClick={() => {
                        setActiveAccount(acc);
                        setUsername(acc.username);
                        setShowAccountDropdown(false);
                        setPin('');
                        setError('');
                      }}
                      className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                        activeAccount?.userId === acc.userId
                          ? 'bg-[#d8f3dc] text-[#1b4332]'
                          : 'hover:bg-[#f0f9f1] text-[#1b4332]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-[#1b4332] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          {acc.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-xs block truncate">{acc.name}</span>
                          <span className="text-[10px] text-[#52605d] block">@{acc.username}</span>
                        </div>
                      </div>
                      {activeAccount?.userId === acc.userId && (
                        <CheckCircle2 className="w-4 h-4 text-[#2d6a4f] shrink-0" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* PIN Indicators: 4 Dots */}
          <div className="my-5 flex items-center justify-center gap-4">
            {[0, 1, 2, 3].map((index) => {
              const isFilled = pin.length > index;
              const isCurrent = pin.length === index;
              return (
                <motion.div
                  key={index}
                  animate={{
                    scale: isFilled ? [1, 1.2, 1] : 1,
                  }}
                  transition={{ duration: 0.15 }}
                  className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                    isFilled
                      ? 'bg-[#1b4332] border-[#1b4332] shadow-sm shadow-[#1b4332]/30'
                      : isCurrent
                      ? 'border-[#2d6a4f] bg-[#f0f9f1] ring-4 ring-[#d8f3dc]'
                      : 'border-[#cbd5e1] bg-white'
                  }`}
                />
              );
            })}
          </div>

          {/* Error Banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="leading-tight">{error}</span>
            </motion.div>
          )}

          {/* Keypad Grid (1-9, Clear, 0, Backspace) */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigitPress(digit)}
                disabled={loading}
                className="h-12 sm:h-13 rounded-2xl bg-[#f7f9f7] hover:bg-[#d8f3dc] active:bg-[#b7e4c7] text-[#1b4332] font-black text-lg sm:text-xl border border-[#e2ece2] hover:border-[#74c69d] shadow-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                {digit}
              </button>
            ))}

            {/* Clear Button */}
            <button
              type="button"
              onClick={handleClear}
              disabled={loading || pin.length === 0}
              className="h-12 sm:h-13 rounded-2xl bg-white hover:bg-stone-100 active:bg-stone-200 text-[#52605d] font-bold text-xs border border-[#e2ece2] shadow-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30"
            >
              Clear
            </button>

            {/* Zero Button */}
            <button
              type="button"
              onClick={() => handleDigitPress('0')}
              disabled={loading}
              className="h-12 sm:h-13 rounded-2xl bg-[#f7f9f7] hover:bg-[#d8f3dc] active:bg-[#b7e4c7] text-[#1b4332] font-black text-lg sm:text-xl border border-[#e2ece2] hover:border-[#74c69d] shadow-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              0
            </button>

            {/* Backspace Button */}
            <button
              type="button"
              onClick={handleBackspace}
              disabled={loading || pin.length === 0}
              className="h-12 sm:h-13 rounded-2xl bg-white hover:bg-rose-50 active:bg-rose-100 text-[#52605d] hover:text-rose-700 border border-[#e2ece2] hover:border-rose-200 shadow-xs active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30"
              aria-label="Backspace"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="py-2 flex items-center justify-center gap-2 text-xs font-extrabold text-[#1b4332] animate-pulse">
              <OfficialDotSpinner size="sm" />
              <span>Verifying PIN...</span>
            </div>
          )}

          {/* Footer fallback options */}
          <div className="pt-2 border-t border-[#f0f4f0] flex flex-col items-center gap-1.5 text-center">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onFallbackToPassword) onFallbackToPassword();
              }}
              className="text-xs font-extrabold text-[#1b4332] hover:text-[#2d6a4f] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Sign in with Password instead</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-[#52605d]">
              Don't have a PIN? Sign in with your password and set one up in Settings &gt; Security.
            </span>
          </div>
        </motion.div>
      </div>
    </ModalPortal>
  );
};
