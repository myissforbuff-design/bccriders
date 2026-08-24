import React, { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  DollarSign,
  Users,
  Calendar,
  Megaphone,
  Volume2,
  VolumeX,
  Smartphone,
  Sparkles,
  RefreshCw,
  Sliders,
  Send,
  Trash2,
  Check,
  AlertOctagon,
} from 'lucide-react';
import { PushNotificationMode } from '../types';

export const PushSettingsTab: React.FC = () => {
  const {
    pushSettings,
    togglePushNotifications,
    updatePushSettings,
    sendTestPushNotification,
    notifications,
    markAllAsRead,
    deleteNotification,
    clearNotifications,
  } = useNotifications();

  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  const handleTestNotification = async () => {
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await sendTestPushNotification();
      setTestResult({
        success: true,
        message: res.message,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Failed to dispatch motorcycle test alert.',
      });
    } finally {
      setIsSendingTest(false);
      setTimeout(() => setTestResult(null), 6000);
    }
  };

  const setMode = (mode: PushNotificationMode) => {
    updatePushSettings({ mode });
  };

  const handleConfirmClear = () => {
    clearNotifications();
    setShowClearConfirmModal(false);
  };

  return (
    <div className="space-y-2.5 sm:space-y-3.5 text-[11px] pb-24 sm:pb-8">
      {/* Master Toggle & Delivery Mode */}
      <div className="bg-white rounded-xl p-2.5 sm:p-4 border border-[#e2ece2] shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#e2ece2]">
          <div className="space-y-0.5">
            <h3 className="font-heading font-extrabold text-[#1b4332] text-[11px] sm:text-xs">
              Push Notification Delivery
            </h3>
            <p className="text-[9px] sm:text-[10px] text-[#52605d]">
              Turn master notifications on or off across this device
            </p>
          </div>

          {/* Master Switch */}
          <button
            type="button"
            onClick={togglePushNotifications}
            className={`relative inline-flex h-4.5 w-8.5 sm:h-5 sm:w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              pushSettings.masterEnabled ? 'bg-[#1b4332]' : 'bg-stone-300'
            }`}
            role="switch"
            aria-checked={pushSettings.masterEnabled}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-3.5 w-3.5 sm:h-4 sm:w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                pushSettings.masterEnabled ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Mode Selector (All vs Custom vs Targeted/Individual) */}
        <div className="space-y-1.5">
          <label className="text-[9px] sm:text-[10px] font-extrabold text-[#1b4332] uppercase tracking-wider block">
            Notification Delivery Mode
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 sm:gap-2">
            {/* Mode 1: All */}
            <div
              onClick={() => setMode('all')}
              className={`p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                pushSettings.mode === 'all'
                  ? 'border-[#1b4332] bg-[#f0f7f2] shadow-2xs'
                  : 'border-[#e2ece2] bg-white hover:border-[#b7e4c7]'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-[10px] sm:text-[11px] text-[#1b4332] flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-[#2d6a4f]" />
                    All Notifications
                  </span>
                  {pushSettings.mode === 'all' && (
                    <div className="w-3 h-3 rounded-full bg-[#1b4332] text-white flex items-center justify-center">
                      <Check className="w-2 h-2" />
                    </div>
                  )}
                </div>
                <p className="text-[8.5px] sm:text-[9.5px] text-[#52605d] leading-relaxed">
                  Receive instant alerts for all club finance logs, approvals, scheduled rides, and bulletins.
                </p>
              </div>
              <span className="mt-1 text-[7.5px] sm:text-[8.5px] font-bold text-[#2d6a4f] uppercase tracking-wider">
                Full Club Coverage
              </span>
            </div>

            {/* Mode 2: Custom / Selective */}
            <div
              onClick={() => setMode('custom')}
              className={`p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                pushSettings.mode === 'custom'
                  ? 'border-[#1b4332] bg-[#f0f7f2] shadow-2xs'
                  : 'border-[#e2ece2] bg-white hover:border-[#b7e4c7]'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-[10px] sm:text-[11px] text-[#1b4332] flex items-center gap-1">
                    <Sliders className="w-2.5 h-2.5 text-[#2d6a4f]" />
                    Custom Categories
                  </span>
                  {pushSettings.mode === 'custom' && (
                    <div className="w-3 h-3 rounded-full bg-[#1b4332] text-white flex items-center justify-center">
                      <Check className="w-2 h-2" />
                    </div>
                  )}
                </div>
                <p className="text-[8.5px] sm:text-[9.5px] text-[#52605d] leading-relaxed">
                  Choose specific categories you wish to follow. Turn off categories you do not want.
                </p>
              </div>
              <span className="mt-1 text-[7.5px] sm:text-[8.5px] font-bold text-[#2d6a4f] uppercase tracking-wider">
                Custom Filter
              </span>
            </div>

            {/* Mode 3: Targeted to Me / Individual */}
            <div
              onClick={() => setMode('targeted')}
              className={`p-2 sm:p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                pushSettings.mode === 'targeted'
                  ? 'border-[#1b4332] bg-[#f0f7f2] shadow-2xs'
                  : 'border-[#e2ece2] bg-white hover:border-[#b7e4c7]'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-[10px] sm:text-[11px] text-[#1b4332] flex items-center gap-1">
                    <Users className="w-2.5 h-2.5 text-[#2d6a4f]" />
                    Targeted (Individual)
                  </span>
                  {pushSettings.mode === 'targeted' && (
                    <div className="w-3 h-3 rounded-full bg-[#1b4332] text-white flex items-center justify-center">
                      <Check className="w-2 h-2" />
                    </div>
                  )}
                </div>
                <p className="text-[8.5px] sm:text-[9.5px] text-[#52605d] leading-relaxed">
                  Only notify when actions directly tag or involve you (personal dues or assigned rides).
                </p>
              </div>
              <span className="mt-1 text-[7.5px] sm:text-[8.5px] font-bold text-[#2d6a4f] uppercase tracking-wider">
                Personalized Only
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Granular Event Category Toggles */}
      <div className="bg-white rounded-xl p-2.5 sm:p-4 border border-[#e2ece2] shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#e2ece2]">
          <div className="space-y-0.5">
            <h3 className="font-heading font-extrabold text-[#1b4332] text-[11px] sm:text-xs">
              Push Event Categories
            </h3>
            <p className="text-[9px] sm:text-[10px] text-[#52605d]">
              Toggle specific push triggers for club operations and member activities
            </p>
          </div>

          <span className="text-[9px] sm:text-[10px] font-bold text-[#52605d] shrink-0">
            {pushSettings.mode === 'all' ? 'All Active' : 'Filter Applied'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Category 1: Finance Transactions */}
          <div className="p-2 sm:p-2.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                <DollarSign className="w-3 h-3" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <h4 className="font-heading font-extrabold text-[#1b4332] text-[10px] sm:text-[10.5px]">
                  Finance & Payment Logs
                </h4>
                <p className="text-[8.5px] sm:text-[9.5px] text-[#52605d] leading-relaxed">
                  Notify when membership fees, monthly dues, dynamic collections, or donation receipts are logged.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => updatePushSettings({ notifyFinance: !pushSettings.notifyFinance })}
              disabled={pushSettings.mode === 'all'}
              className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-60 ${
                pushSettings.mode === 'all' || pushSettings.notifyFinance ? 'bg-[#1b4332]' : 'bg-stone-300'
              }`}
              role="switch"
            >
              <span
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  pushSettings.mode === 'all' || pushSettings.notifyFinance
                    ? 'translate-x-3'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Category 2: Member Approvals */}
          <div className="p-2 sm:p-2.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                <Users className="w-3 h-3" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <h4 className="font-heading font-extrabold text-[#1b4332] text-[10px] sm:text-[10.5px]">
                  Member Approvals & Joins
                </h4>
                <p className="text-[8.5px] sm:text-[9.5px] text-[#52605d] leading-relaxed">
                  Notify when a new rider registration is submitted or approved as an official BCC member.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => updatePushSettings({ notifyMembers: !pushSettings.notifyMembers })}
              disabled={pushSettings.mode === 'all'}
              className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-60 ${
                pushSettings.mode === 'all' || pushSettings.notifyMembers ? 'bg-[#1b4332]' : 'bg-stone-300'
              }`}
              role="switch"
            >
              <span
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  pushSettings.mode === 'all' || pushSettings.notifyMembers
                    ? 'translate-x-3'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Category 3: Activity & Rides Created */}
          <div className="p-2 sm:p-2.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-cyan-100 text-cyan-800 flex items-center justify-center shrink-0 mt-0.5">
                <Calendar className="w-3 h-3" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <h4 className="font-heading font-extrabold text-[#1b4332] text-[10px] sm:text-[10.5px]">
                  Activities & Scheduled Rides
                </h4>
                <p className="text-[8.5px] sm:text-[9.5px] text-[#52605d] leading-relaxed">
                  Notify when new club activities, group rides, rallies, or attendance events are created.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => updatePushSettings({ notifyActivities: !pushSettings.notifyActivities })}
              disabled={pushSettings.mode === 'all'}
              className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-60 ${
                pushSettings.mode === 'all' || pushSettings.notifyActivities ? 'bg-[#1b4332]' : 'bg-stone-300'
              }`}
              role="switch"
            >
              <span
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  pushSettings.mode === 'all' || pushSettings.notifyActivities
                    ? 'translate-x-3'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Category 4: Announcements & Updates */}
          <div className="p-2 sm:p-2.5 rounded-lg bg-[#f7f9f7] border border-[#e2ece2] flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-purple-100 text-purple-800 flex items-center justify-center shrink-0 mt-0.5">
                <Megaphone className="w-3 h-3" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <h4 className="font-heading font-extrabold text-[#1b4332] text-[10px] sm:text-[10.5px]">
                  Announcements & Bulletins
                </h4>
                <p className="text-[8.5px] sm:text-[9.5px] text-[#52605d] leading-relaxed">
                  Notify when official club bulletins, safety alerts, and executive advisories are published.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => updatePushSettings({ notifyAnnouncements: !pushSettings.notifyAnnouncements })}
              disabled={pushSettings.mode === 'all'}
              className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-60 ${
                pushSettings.mode === 'all' || pushSettings.notifyAnnouncements ? 'bg-[#1b4332]' : 'bg-stone-300'
              }`}
              role="switch"
            >
              <span
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  pushSettings.mode === 'all' || pushSettings.notifyAnnouncements
                    ? 'translate-x-3'
                    : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Sound & Sensory Preferences */}
      <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-3 border border-[#e2ece2] shadow-2xs space-y-2">
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#e2ece2]">
          <div className="min-w-0">
            <h3 className="font-heading font-extrabold text-[#1b4332] text-[10px] sm:text-[11px] truncate">
              Motorcycle Sound & Vibration
            </h3>
            <p className="text-[8px] sm:text-[9px] text-[#52605d] mt-0.5 leading-tight">
              Motorcycle engine start & rev sound effect on alerts
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestNotification}
            disabled={isSendingTest}
            className="px-2 py-0.5 rounded-md bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-bold text-[8px] sm:text-[9px] transition-all shadow-xs flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isSendingTest ? (
              <RefreshCw className="w-2 h-2 animate-spin text-[#74c69d]" />
            ) : (
              <Send className="w-2 h-2 text-[#74c69d]" />
            )}
            <span>{isSendingTest ? 'Revving...' : 'Test Engine Sound'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {/* Audio Motorcycle Sound */}
          <div className="p-1.5 sm:p-2 rounded-md bg-[#f7f9f7] border border-[#e2ece2] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-[#1b4332] text-white flex items-center justify-center shrink-0">
                {pushSettings.soundEnabled ? (
                  <Volume2 className="w-2.5 h-2.5 text-[#74c69d]" />
                ) : (
                  <VolumeX className="w-2.5 h-2.5 text-stone-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-[#1b4332] truncate">Motorcycle Engine Start Sound</p>
                <p className="text-[7.5px] sm:text-[8.5px] text-[#52605d] truncate">Crank, ignition & throttle rev audio</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => updatePushSettings({ soundEnabled: !pushSettings.soundEnabled })}
              className={`relative inline-flex h-3.5 w-6.5 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                pushSettings.soundEnabled ? 'bg-[#1b4332]' : 'bg-stone-300'
              }`}
              role="switch"
            >
              <span
                className={`pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  pushSettings.soundEnabled ? 'translate-x-3' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Device Vibration */}
          <div className="p-1.5 sm:p-2 rounded-md bg-[#f7f9f7] border border-[#e2ece2] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-[#1b4332] text-white flex items-center justify-center shrink-0">
                <Smartphone className="w-2.5 h-2.5 text-[#74c69d]" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-[#1b4332] truncate">Haptic Vibration</p>
                <p className="text-[7.5px] sm:text-[8.5px] text-[#52605d] truncate">Vibrate on mobile phones</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => updatePushSettings({ vibrateEnabled: !pushSettings.vibrateEnabled })}
              className={`relative inline-flex h-3.5 w-6.5 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                pushSettings.vibrateEnabled ? 'bg-[#1b4332]' : 'bg-stone-300'
              }`}
              role="switch"
            >
              <span
                className={`pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  pushSettings.vibrateEnabled ? 'translate-x-3' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Test Result Toast */}
        <AnimatePresence>
          {testResult && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-[8.5px] sm:text-[9.5px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 p-1.5 rounded-md"
            >
              {testResult.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Push Notification History & Clean Up */}
      <div className="bg-white rounded-xl p-2.5 sm:p-4 border border-[#e2ece2] shadow-2xs space-y-2">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#e2ece2]">
          <div className="space-y-0.5">
            <h3 className="font-heading font-extrabold text-[#1b4332] text-[11px] sm:text-xs">
              Push Alert History ({notifications.length})
            </h3>
            <p className="text-[9px] sm:text-[10px] text-[#52605d]">
              Review past push alerts delivered to your feed
            </p>
          </div>

          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="px-2 py-0.5 rounded-md bg-[#f0f7f2] hover:bg-[#e8f5e9] text-[#1b4332] font-bold text-[9px] sm:text-[10px] transition-colors cursor-pointer"
                >
                  Mark All Read
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirmModal(true)}
                  className="px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[9px] sm:text-[10px] transition-colors cursor-pointer flex items-center gap-0.5"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  <span>Clear</span>
                </button>
              </>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="p-3 sm:p-5 text-center text-[#52605d] text-[10px]">
            No push notifications in log.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
            {notifications.slice(0, 15).map((n) => (
              <div
                key={n.id}
                className={`p-2 rounded-lg border text-[10px] flex items-start justify-between gap-2 transition-colors ${
                  n.read
                    ? 'bg-[#f7f9f7] border-[#e2ece2] text-[#52605d]'
                    : 'bg-[#f0f9f1] border-[#b7e4c7] text-[#1b4332]'
                }`}
              >
                <div className="min-w-0 space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold text-[10px] sm:text-[10.5px] leading-tight">{n.title}</span>
                    {n.category && (
                      <span className="px-1.5 py-0.2 rounded text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider bg-white/90 text-[#2d6a4f] border border-[#e2ece2]">
                        {n.category}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] sm:text-[9.5px] text-[#52605d] leading-normal">{n.message}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                  <span className="text-[8.5px] sm:text-[9px] text-stone-400">{n.timestamp}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    className="p-0.5 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete alert"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clear Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="bg-white rounded-xl max-w-xs sm:max-w-sm w-full p-3.5 sm:p-4 shadow-2xl border border-rose-100 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-heading font-extrabold text-xs sm:text-sm text-stone-900">
                    Clear Alert History?
                  </h3>
                  <p className="text-[10px] text-[#52605d] leading-relaxed">
                    This will delete all <span className="font-bold text-stone-800">{notifications.length} notifications</span> from your history log. This cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowClearConfirmModal(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-[10.5px] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClear}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10.5px] shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Yes, Delete All</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
