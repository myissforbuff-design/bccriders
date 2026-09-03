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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ModalPortal } from './ModalPortal';

interface PWAInstallBannerProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  forceOpen = false,
  onClose,
}) => {
  const { isInstalled, isIOS, triggerInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('bcc_pwa_dismissed') === 'true';
  });
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenBanner = () => {
      setIsDismissed(false);
    };
    window.addEventListener('bcc_open_pwa_install', handleOpenBanner);
    return () => window.removeEventListener('bcc_open_pwa_install', handleOpenBanner);
  }, []);

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
      <ModalPortal>
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            className="relative w-full max-w-md bg-white border border-[#e2ece2] rounded-3xl shadow-2xl shadow-[#1b4332]/10 p-5 sm:p-6 text-[#1b4332] overflow-hidden"
          >
            {/* Subtle Decorative Background Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#d8f3dc]/40 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 rounded-full text-[#52605d] hover:text-[#1b4332] hover:bg-[#f0f7f4] transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3.5 mb-4 sm:mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2d6a4f] to-[#1b4332] p-2.5 flex items-center justify-center shadow-md border border-[#2d6a4f]/20 shrink-0">
                <img
                  src="/pwa-icon-192.png"
                  alt="BCC Riders Logo"
                  className="w-full h-full object-contain filter drop-shadow-xs"
                />
              </div>
              <div className="pr-6">
                <h3 className="font-heading text-lg sm:text-xl font-extrabold text-[#1b4332] mt-1">
                  Install BCC Riders Club
                </h3>
                <p className="text-xs text-[#52605d] font-medium">
                  Official PWA for Android, iOS & Desktop
                </p>
              </div>
            </div>

            {/* Features Comparison: App vs Shortcut */}
            <div className="bg-[#f7f9f7] border border-[#e2ece2] rounded-2xl p-4 mb-4 sm:mb-5 space-y-2.5 text-xs">
              <div className="text-[#1b4332] font-bold mb-1 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#2d6a4f]" />
                <span>Full Native App Experience:</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-[#2d4036] text-[11.5px] font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                  <span>Runs in Standalone Window</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                  <span>Background Push Alerts</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                  <span>Instant Launch & Offline</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2d6a4f] shrink-0" />
                  <span>No URL Bar / Browser Tabs</span>
                </div>
              </div>
            </div>

            {/* iOS Safari Instructions */}
            {isIOS || showIosGuide ? (
              <div className="bg-[#f0fdf4] border border-[#86efac] rounded-2xl p-3.5 mb-4 sm:mb-5 space-y-2 text-xs text-[#166534]">
                <div className="font-bold text-[#166534] flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-[#166534]" />
                  How to Install on iOS (iPhone/iPad):
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[12px] text-[#2d4036]">
                  <li>
                    Tap the <span className="text-[#1b4332] font-bold">Share</span> button in Safari at the bottom of the screen.
                  </li>
                  <li>
                    Scroll down and tap <span className="text-[#1b4332] font-bold">"Add to Home Screen"</span> (<PlusSquare className="w-3.5 h-3.5 inline text-[#166534]" />).
                  </li>
                  <li>
                    Tap <span className="text-[#166534] font-bold">"Add"</span> to launch as a full native app!
                  </li>
                </ol>
              </div>
            ) : installStatus === 'instruction' ? (
              <div className="bg-[#fffbeb] border border-[#fde68a] rounded-2xl p-3.5 mb-4 sm:mb-5 space-y-1 text-xs text-[#92400e]">
                <div className="font-bold text-[#b45309]">
                  Chrome Desktop / Android Install:
                </div>
                <p className="text-[11.5px] text-[#78350f]">
                  Click the <span className="text-[#451a03] font-bold">Install App</span> icon (<Download className="w-3 h-3 inline text-[#b45309]" />) in your browser address bar or Chrome menu (<span className="text-[#451a03] font-bold">⋮ &gt; Install BCC Riders Club</span>).
                </p>
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex-1 bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Install App</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-4 py-3 text-xs font-bold text-[#52605d] hover:text-[#1b4332] bg-[#f7f9f7] hover:bg-[#e2ece2] border border-[#e2ece2] rounded-xl transition-colors cursor-pointer"
              >
                Maybe Later
              </button>
            </div>
          </motion.div>
        </div>
      </ModalPortal>
    </AnimatePresence>
  );
};
