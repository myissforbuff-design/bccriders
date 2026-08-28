import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  Send,
  Volume2,
  VolumeX,
  Smartphone,
  DollarSign,
  UserCheck,
  Calendar,
  Radio,
  Info,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Check,
  Vibrate,
  X,
} from 'lucide-react';
import {
  getPushNotificationConfig,
  savePushNotificationConfig,
  requestPushPermission,
  isPushSupported,
  getPushPermission,
  triggerFinancePushNotification,
  triggerMemberApprovalPushNotification,
  triggerActivityCreatedPushNotification,
  triggerAnnouncementPushNotification,
  getRegisteredPushDevicesCount,
  PushNotificationConfig,
} from '../lib/pushNotifications';
import { OfficialDotSpinner } from './OfficialLoader';

export interface PushNotificationSettingsProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const PushNotificationSettings: React.FC<PushNotificationSettingsProps> = ({
  onClose,
  isModal = false,
}) => {
  const [config, setConfig] = useState<PushNotificationConfig>(() => getPushNotificationConfig());
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [supported, setSupported] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [deviceStats, setDeviceStats] = useState<{ count: number; activeSockets: number }>({ count: 0, activeSockets: 0 });

  useEffect(() => {
    setSupported(isPushSupported());
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
    void getRegisteredPushDevicesCount().then(setDeviceStats);
  }, []);

  const handleToggleAll = (enabled: boolean) => {
    const updated: PushNotificationConfig = {
      ...config,
      enabled,
      categories: {
        finance: enabled,
        memberApprovals: enabled,
        activities: enabled,
        announcements: enabled,
        sos: enabled,
      },
    };
    setConfig(updated);
    savePushNotificationConfig(updated);
  };

  const handleToggleCategory = (key: keyof PushNotificationConfig['categories']) => {
    const updated: PushNotificationConfig = {
      ...config,
      categories: {
        ...config.categories,
        [key]: !config.categories[key],
      },
    };
    setConfig(updated);
    savePushNotificationConfig(updated);
  };

  const handleToggleSound = () => {
    const updated: PushNotificationConfig = {
      ...config,
      sound: !config.sound,
    };
    setConfig(updated);
    savePushNotificationConfig(updated);
  };

  const handleToggleVibration = () => {
    const updated: PushNotificationConfig = {
      ...config,
      vibration: !config.vibration,
    };
    setConfig(updated);
    savePushNotificationConfig(updated);
  };

  const handleRequestPermission = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const granted = await requestPushPermission();
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
      if (granted) {
        const updated = { ...config, enabled: true };
        setConfig(updated);
        savePushNotificationConfig(updated);
        setStatusMessage({
          type: 'success',
          text: 'Push notifications successfully activated on this device!',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Notification permission was denied or dismissed. Please enable notifications in your browser site settings.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to request notification permission.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestNotification = async (type: 'finance' | 'member' | 'activity' | 'announcement') => {
    setTestSuccess(type);
    setTimeout(() => setTestSuccess(null), 3000);

    if (type === 'finance') {
      await triggerFinancePushNotification('collection', 1500, 'Monthly Club Dues & Ride Fund');
    } else if (type === 'member') {
      await triggerMemberApprovalPushNotification('Bro. Juan Dela Cruz', true);
    } else if (type === 'activity') {
      await triggerActivityCreatedPushNotification('Marilaque Sunrise Breakfast Ride', 'Oct 25', 'Shell Sierra Madre');
    } else if (type === 'announcement') {
      await triggerAnnouncementPushNotification(
        'General Assembly & Charity Ride Update',
        'All chapter members are requested to gather at the main clubhouse.'
      );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Main Push Status Card */}
      <div className="bg-white rounded-2xl p-6 border border-[#e2ece2] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#d8f3dc] flex items-center justify-center text-[#1b4332] shrink-0">
              <Bell className="w-6 h-6 text-[#2d6a4f]" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#1b4332]">
                Web Push Notifications
              </h3>
              <p className="text-xs text-[#52605d]">
                Receive instant alerts for finances, member approvals, ride events, and announcements
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0f9f1] text-[#1b4332] font-bold text-[11px] border border-[#a7d7b5]">
              <Radio className="w-3.5 h-3.5 text-[#2d6a4f] animate-pulse" />
              <span>{deviceStats.count > 0 ? `${deviceStats.count} device${deviceStats.count === 1 ? '' : 's'} registered` : 'Cross-Device Broadcast Ready'}</span>
            </div>
            {permission === 'granted' ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#d8f3dc] text-[#1b4332] font-extrabold text-xs border border-[#74c69d]">
                <CheckCircle2 className="w-4 h-4 text-[#2d6a4f]" />
                <span>Push Active on this Device</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRequestPermission}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-[#1b4332] text-white font-extrabold text-xs hover:bg-[#2d6a4f] transition-all flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {loading ? <OfficialDotSpinner size="sm" /> : <Bell className="w-4 h-4" />}
                <span>Enable Push Alerts</span>
              </button>
            )}
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-[#d8f3dc] text-[#1b4332] border border-[#74c69d]'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#2d6a4f] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Global Master Switch */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-[#f7f9f7] border border-[#e2ece2]">
          <div>
            <p className="text-sm font-black text-[#1b4332]">
              Master Push Switch (All Notifications)
            </p>
            <p className="text-xs text-[#52605d]">
              Enable or mute all push broadcasts across this device
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => handleToggleAll(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1b4332]"></div>
          </label>
        </div>
      </div>

      {/* Granular Notification Categories */}
      <div className="bg-white rounded-2xl p-6 border border-[#e2ece2] shadow-xs space-y-6">
        <div>
          <h3 className="font-extrabold text-base text-[#1b4332]">
            Individual Push Notification Channels
          </h3>
          <p className="text-xs text-[#52605d]">
            Customize which specific club activities and events will send push notifications
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Finance Transactions */}
          <div className="p-4 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#d8f3dc] flex items-center justify-center text-[#1b4332] shrink-0 mt-0.5">
                <DollarSign className="w-5 h-5 text-[#2d6a4f]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1b4332]">
                  Finance Transactions
                </p>
                <p className="text-xs text-[#52605d] mt-0.5">
                  Collections, expense receipts, dues, and payment confirmations
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.categories.finance}
              onChange={() => handleToggleCategory('finance')}
              className="w-5 h-5 accent-[#1b4332] rounded cursor-pointer mt-1"
            />
          </div>

          {/* Member Approvals */}
          <div className="p-4 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#d8f3dc] flex items-center justify-center text-[#1b4332] shrink-0 mt-0.5">
                <UserCheck className="w-5 h-5 text-[#2d6a4f]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1b4332]">
                  Member Approvals
                </p>
                <p className="text-xs text-[#52605d] mt-0.5">
                  Notifications when a new rider membership is approved or updated
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.categories.memberApprovals}
              onChange={() => handleToggleCategory('memberApprovals')}
              className="w-5 h-5 accent-[#1b4332] rounded cursor-pointer mt-1"
            />
          </div>

          {/* Activities & Rides */}
          <div className="p-4 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#d8f3dc] flex items-center justify-center text-[#1b4332] shrink-0 mt-0.5">
                <Calendar className="w-5 h-5 text-[#2d6a4f]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1b4332]">
                  Activities & Rides
                </p>
                <p className="text-xs text-[#52605d] mt-0.5">
                  New club rides, schedule updates, routes, and meetups
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.categories.activities}
              onChange={() => handleToggleCategory('activities')}
              className="w-5 h-5 accent-[#1b4332] rounded cursor-pointer mt-1"
            />
          </div>

          {/* Announcements & Updates */}
          <div className="p-4 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#d8f3dc] flex items-center justify-center text-[#1b4332] shrink-0 mt-0.5">
                <Radio className="w-5 h-5 text-[#2d6a4f]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1b4332]">
                  Announcements & News
                </p>
                <p className="text-xs text-[#52605d] mt-0.5">
                  Official notices, club bulletins, and leadership announcements
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.categories.announcements}
              onChange={() => handleToggleCategory('announcements')}
              className="w-5 h-5 accent-[#1b4332] rounded cursor-pointer mt-1"
            />
          </div>

          {/* SOS & Emergency */}
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 md:col-span-2">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-rose-900">
                  Emergency SOS Broadcasts (High Priority)
                </p>
                <p className="text-xs text-rose-700 mt-0.5">
                  Urgent distress and medical/breakdown signals broadcast by fellow club riders
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.categories.sos}
              onChange={() => handleToggleCategory('sos')}
              className="w-5 h-5 accent-rose-600 rounded cursor-pointer mt-1"
            />
          </div>
        </div>

        {/* Audio & Haptic Feedback Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#e2ece2]">
          <button
            type="button"
            onClick={handleToggleSound}
            className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
              config.sound
                ? 'bg-[#f0f9f1] border-[#74c69d] text-[#1b4332]'
                : 'bg-stone-50 border-stone-200 text-stone-500'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {config.sound ? <Volume2 className="w-4 h-4 text-[#2d6a4f]" /> : <VolumeX className="w-4 h-4" />}
              <span className="text-xs font-bold">Sound Alert Tone</span>
            </div>
            <span className="text-xs font-black">{config.sound ? 'Enabled' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleVibration}
            className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
              config.vibration
                ? 'bg-[#f0f9f1] border-[#74c69d] text-[#1b4332]'
                : 'bg-stone-50 border-stone-200 text-stone-500'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Vibrate className={`w-4 h-4 ${config.vibration ? 'text-[#2d6a4f]' : ''}`} />
              <span className="text-xs font-bold">Vibration Pattern</span>
            </div>
            <span className="text-xs font-black">{config.vibration ? 'Enabled' : 'Disabled'}</span>
          </button>
        </div>
      </div>

      {/* Test Push Notifications Simulator */}
      <div className="bg-white rounded-2xl p-6 border border-[#e2ece2] shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#d8f3dc] flex items-center justify-center text-[#1b4332]">
            <Send className="w-5 h-5 text-[#2d6a4f]" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-[#1b4332]">
              Test Notification Triggers
            </h3>
            <p className="text-xs text-[#52605d]">
              Send test notification payloads to verify push alerts on this device
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleSendTestNotification('finance')}
            className="p-3 rounded-xl bg-[#f0f9f1] hover:bg-[#d8f3dc] text-[#1b4332] font-bold text-xs border border-[#74c69d] transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            <DollarSign className="w-4 h-4 text-[#2d6a4f]" />
            <span>{testSuccess === 'finance' ? 'Sent!' : 'Test Finance'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSendTestNotification('member')}
            className="p-3 rounded-xl bg-[#f0f9f1] hover:bg-[#d8f3dc] text-[#1b4332] font-bold text-xs border border-[#74c69d] transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            <UserCheck className="w-4 h-4 text-[#2d6a4f]" />
            <span>{testSuccess === 'member' ? 'Sent!' : 'Test Approval'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSendTestNotification('activity')}
            className="p-3 rounded-xl bg-[#f0f9f1] hover:bg-[#d8f3dc] text-[#1b4332] font-bold text-xs border border-[#74c69d] transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            <Calendar className="w-4 h-4 text-[#2d6a4f]" />
            <span>{testSuccess === 'activity' ? 'Sent!' : 'Test Activity'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSendTestNotification('announcement')}
            className="p-3 rounded-xl bg-[#f0f9f1] hover:bg-[#d8f3dc] text-[#1b4332] font-bold text-xs border border-[#74c69d] transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            <Radio className="w-4 h-4 text-[#2d6a4f]" />
            <span>{testSuccess === 'announcement' ? 'Sent!' : 'Test Bulletin'}</span>
          </button>
        </div>
      </div>

      {/* Mobile & PWA Device Setup Instructions */}
      <div className="bg-[#f0f9f1] rounded-2xl p-6 border border-[#a7d7b5] space-y-4">
        <div className="flex items-center gap-3">
          <Smartphone className="w-5 h-5 text-[#2d6a4f]" />
          <h4 className="font-black text-sm text-[#1b4332]">
            Mobile Device Push Notifications Guide
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#52605d]">
          <div className="p-3.5 rounded-xl bg-white border border-[#e2ece2] space-y-1.5">
            <p className="font-bold text-[#1b4332]">Android (Chrome, Edge, Brave)</p>
            <p>1. Tap the <strong>Enable Push Alerts</strong> button above.</p>
            <p>2. Tap <strong>Allow</strong> on the browser prompt to receive system notifications even when the browser is closed.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-[#e2ece2] space-y-1.5">
            <p className="font-bold text-[#1b4332]">iOS (iPhone & iPad - iOS 16.4+)</p>
            <p>1. Open Safari and tap the <strong>Share icon (square with arrow)</strong>.</p>
            <p>2. Tap <strong>"Add to Home Screen"</strong> and open the app from your home screen icon.</p>
            <p>3. Tap <strong>Enable Push Alerts</strong> in Settings to receive lock-screen notifications.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
