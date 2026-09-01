import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  KeyRound,
  X,
  AlertCircle,
  CheckCircle2,
  Delete,
  ShieldCheck,
  Smartphone,
  ArrowRight,
} from 'lucide-react';
import { OfficialDotSpinner } from './OfficialLoader';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { ModalPortal } from './ModalPortal';
import { registerUserPin, removeUserPin, getPinDeviceName } from '../lib/pinAuth';

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    username: string;
    name: string;
    avatar?: string;
  };
  hasExistingPin?: boolean;
  onSuccess: (message: string) => void;
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  hasExistingPin,
  onSuccess,
}) => {
  useModalDismiss(isOpen, onClose);
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('create');
      setFirstPin('');
      setConfirmPin('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  const triggerErrorShake = (msg: string) => {
    setError(msg);
    setIsShaking(true);
    if (step === 'confirm') {
      setConfirmPin('');
    } else {
      setFirstPin('');
    }
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleSavePin = useCallback(
    async (pinToSave: string) => {
      setLoading(true);
      setError('');
      try {
        const res = await registerUserPin(pinToSave, currentUser);
        if (!res.success) {
          triggerErrorShake(res.error || 'Failed to save PIN.');
          setLoading(false);
          return;
        }
        onSuccess(res.message || '4-Digit PIN configured successfully for this account.');
        onClose();
      } catch (err: any) {
        triggerErrorShake(err?.message || 'Error saving PIN.');
      } finally {
        setLoading(false);
      }
    },
    [currentUser, onSuccess, onClose]
  );

  const handleDigitPress = (digit: string) => {
    if (loading) return;
    setError('');

    if (step === 'create') {
      if (firstPin.length >= 4) return;
      const next = firstPin + digit;
      setFirstPin(next);
      if (next.length === 4) {
        // Move to confirm step smoothly
        setTimeout(() => {
          setStep('confirm');
          setConfirmPin('');
        }, 150);
      }
    } else {
      if (confirmPin.length >= 4) return;
      const next = confirmPin + digit;
      setConfirmPin(next);
      if (next.length === 4) {
        if (next !== firstPin) {
          triggerErrorShake('PINs do not match. Please try again.');
          setTimeout(() => {
            setStep('create');
            setFirstPin('');
            setConfirmPin('');
          }, 600);
        } else {
          handleSavePin(next);
        }
      }
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setError('');
    if (step === 'create') {
      setFirstPin((prev) => prev.slice(0, -1));
    } else {
      if (confirmPin.length === 0) {
        setStep('create');
      } else {
        setConfirmPin((prev) => prev.slice(0, -1));
      }
    }
  };

  const handleClear = () => {
    if (loading) return;
    setError('');
    if (step === 'create') {
      setFirstPin('');
    } else {
      setConfirmPin('');
    }
  };

  // Keyboard support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [isOpen, step, firstPin, confirmPin, loading, handleSavePin, onClose]);

  if (!isOpen) return null;

  const currentPinString = step === 'create' ? firstPin : confirmPin;

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
                {hasExistingPin ? 'Change 4-Digit PIN' : 'Set Up 4-Digit PIN'}
              </h2>
              <p className="text-xs text-[#52605d] mt-0.5">
                {step === 'create'
                  ? 'Enter a 4-digit PIN for quick login'
                  : 'Re-enter your 4-digit PIN to confirm'}
              </p>
            </div>
          </div>

          {/* Step Breadcrumb indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div
              className={`px-3 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 transition-colors ${
                step === 'create'
                  ? 'bg-[#1b4332] text-white'
                  : 'bg-[#d8f3dc] text-[#1b4332]'
              }`}
            >
              <span>1. Enter PIN</span>
            </div>
            <ArrowRight className="w-3 h-3 text-[#52605d]" />
            <div
              className={`px-3 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1 transition-colors ${
                step === 'confirm'
                  ? 'bg-[#1b4332] text-white'
                  : 'bg-stone-100 text-stone-500'
              }`}
            >
              <span>2. Confirm</span>
            </div>
          </div>

          {/* PIN Indicators: 4 Dots */}
          <div className="my-5 flex items-center justify-center gap-4">
            {[0, 1, 2, 3].map((index) => {
              const isFilled = currentPinString.length > index;
              const isCurrent = currentPinString.length === index;
              return (
                <motion.div
                  key={index}
                  animate={{
                    scale: isFilled ? [1, 1.25, 1] : 1,
                  }}
                  transition={{ duration: 0.15 }}
                  className={`w-4.5 h-4.5 rounded-full border-2 transition-all flex items-center justify-center ${
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
              disabled={loading || currentPinString.length === 0}
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
              disabled={loading || (step === 'create' && firstPin.length === 0)}
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
              <span>Configuring PIN securely...</span>
            </div>
          )}

          {/* Device helper note */}
          <div className="pt-2 border-t border-[#f0f4f0] text-center">
            <p className="text-[10px] text-[#52605d] leading-relaxed">
              Enrolls this account for 4-digit PIN sign-in on <strong>{getPinDeviceName()}</strong>.
            </p>
          </div>
        </motion.div>
      </div>
    </ModalPortal>
  );
};
