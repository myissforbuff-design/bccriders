import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Download,
  Smartphone,
  CheckCircle2,
  X,
  Share2,
  PlusSquare,
  ShieldCheck,
  Zap,
  Bell,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PWAInstallBannerProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  forceOpen = false,
  onClose,
}) => {
  const { isInstallable, isInstalled, isIOS, canPromptDirectly, triggerInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('bcc_pwa_dismissed') === 'true';
  });
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  // If forceOpen is provided via props (e.g. from user clicking "Install App" in menu), show regardless of dismiss state
  const isVisible = (forceOpen || (!isInstalled && !isDismissed)) && !isInstalled;

  const handleInstallClick = async () => {
    setInstallStatus('prompting');
    const result = await triggerInstall();
    if (result === 'accepted') {
      setInstallStatus('installed');
      if (onClose) onClose();
    } else if (result === 'manual_ios') {
      setShowIosGuide(true);
    } else if (result === 'manual_desktop') {
      setShowIosGuide(false);
      setInstallStatus('instruction');
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('bcc_pwa_dismissed', 'true');
    if (onClose) onClose();
  };

  if (!isVisible && !forceOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-emerald-950/40 p-5 text-white overflow-hidden"
        >
          {/* Subtle Background Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-700 to-[#1b4332] p-2 flex items-center justify-center shadow-lg border border-emerald-500/30 shrink-0">
              <img
                src="/pwa-icon-192.png"
                alt="BCC Riders Logo"
                className="w-full h-full object-contain filter drop-shadow-xs"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                  Standalone App
                </span>
              </div>
              <h3 className="font-heading text-lg font-bold text-white mt-1">
                Install BCC Riders Club
              </h3>
              <p className="text-xs text-slate-400">
                Official PWA for Android, iOS & Desktop
              </p>
            </div>
          </div>

          {/* Features Comparison: App vs Shortcut */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 mb-4 space-y-2 text-xs">
            <div className="text-slate-300 font-medium mb-1 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              Full Native App Experience:
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11.5px]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Runs in Standalone Window</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Background Push Alerts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Instant Launch & Offline</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>No URL Bar / Browser Tabs</span>
              </div>
            </div>
          </div>

          {/* iOS Safari Instructions */}
          {isIOS || showIosGuide ? (
            <div className="bg-emerald-950/40 border border-emerald-700/50 rounded-xl p-3 mb-4 space-y-2 text-xs text-slate-200">
              <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-emerald-400" />
                How to Install on iOS (iPhone/iPad):
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[12px] text-slate-300">
                <li>
                  Tap the <span className="text-white font-bold">Share</span> button in Safari at the bottom of the screen.
                </li>
                <li>
                  Scroll down and tap <span className="text-white font-bold">"Add to Home Screen"</span> (<PlusSquare className="w-3.5 h-3.5 inline text-emerald-400" />).
                </li>
                <li>
                  Tap <span className="text-emerald-300 font-bold">"Add"</span> to launch as a full native app!
                </li>
              </ol>
            </div>
          ) : installStatus === 'instruction' ? (
            <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl p-3 mb-4 space-y-1 text-xs text-slate-200">
              <div className="font-semibold text-amber-300">
                Chrome Desktop / Android Install:
              </div>
              <p className="text-[11.5px] text-slate-300">
                Click the <span className="text-white font-bold">Install App</span> icon (<Download className="w-3 h-3 inline text-emerald-400" />) in your browser address bar or Chrome menu (<span className="text-white font-bold">⋮ &gt; Install BCC Riders Club</span>).
              </p>
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleInstallClick}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold text-sm py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Install App</span>
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2.5 text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Maybe Later
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
