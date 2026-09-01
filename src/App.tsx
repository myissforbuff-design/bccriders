import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { LoaderProvider } from './context/LoaderContext';
import { LandingPage } from './components/LandingPage';
import { Navigation, TabType } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { MembershipManagement } from './components/MembershipManagement';
import { CommunityBoard } from './components/CommunityBoard';
import { RiderProfile } from './components/RiderProfile';
import { DocumentHub } from './components/DocumentHub';
import { AdminERPPanel } from './components/AdminERPPanel';
import { Settings } from './components/Settings';
import { ActivityLog } from './components/ActivityLog';
import { QRScan } from './components/QRScan';
import { Finances } from './components/Finances';
import { UpdatesHub } from './components/UpdatesHub';
import { RealtimeStatusPill } from './components/RealtimeStatusPill';
import { PushNotificationCenter } from './components/PushNotificationCenter';
import { PushNotificationBanner } from './components/PushNotificationBanner';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { useIsAnyModalOpen } from './hooks/useModalDismiss';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { Bike, ShieldCheck, X, CheckCircle2, Download, Printer } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

function MainAppContent() {
  const { currentUser, isAuthenticated, isAdmin, logout } = useAuth();
  const { toastMessage, clearToast, triggerPushAlert, clearAllNotifications } = useNotifications();
  const isAnyModalOpen = useIsAnyModalOpen();

  // Opens the Socket.io push channel on app load and re-handshakes when the signed-in rider
  // changes. This is what makes another device's writes appear here without a refresh.
  useRealtimeSync(currentUser?.id ?? null);

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = localStorage.getItem('bcc_active_tab');
    if (saved) {
      return saved as TabType;
    }
    return isAdmin ? 'dashboard' : 'profile';
  });

  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('bcc_active_tab', activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleTabNavigate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail as TabType);
      }
    };
    window.addEventListener('bcc_tab_navigate', handleTabNavigate);
    return () => window.removeEventListener('bcc_tab_navigate', handleTabNavigate);
  }, []);
  const [logRideModalTrigger, setLogRideModalTrigger] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [exportPdfTrigger, setExportPdfTrigger] = useState(0);
  const [printTrigger, setPrintTrigger] = useState(0);

  const isMember = !currentUser?.role || currentUser?.role === 'Member' || currentUser?.role?.toLowerCase() === 'member';
  const isTreasurer = currentUser?.role === 'Treasurer' || currentUser?.role?.toLowerCase() === 'treasurer';

  useEffect(() => {
    if (isAuthenticated) {
      if (isAdmin) {
        if (activeTab === 'profile') {
          setActiveTab('dashboard');
        }
      } else {
        if (
          activeTab === 'dashboard' ||
          activeTab === 'members' ||
          (isMember && activeTab === 'qr')
        ) {
          setActiveTab('profile');
        }
      }
    }
  }, [isAuthenticated, isAdmin, isMember, activeTab]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab]);

  if (!isAuthenticated) {
    return (
      <>
        <LandingPage
          onLoginSuccess={() => {
            setActiveTab(isAdmin ? 'dashboard' : 'profile');
          }}
        />
        <PWAInstallBanner />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#2d3a3a] flex flex-col lg:flex-row antialiased">
      {/* Desktop & Mobile Sidebar Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Workspace Panel */}
      <div className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'} flex flex-col min-w-0`}>
        {/* Top Header Bar */}
        {activeTab !== 'qr' && (
          <header
            className="sticky top-[48px] sm:top-[52px] lg:top-0 z-30 bg-white/98 backdrop-blur-md border-b border-[#e2ece2] px-3 sm:px-6 py-2 sm:py-3.5 flex items-center justify-between shadow-xs"
          >
            <div>
              <h1 className="font-heading font-extrabold text-[#1b4332] text-sm sm:text-lg capitalize">
                {activeTab === 'settings'
                  ? 'System Settings'
                  : activeTab === 'announcements'
                  ? 'News Updates'
                  : activeTab === 'finances'
                  ? 'Finances & Treasury Management'
                  : activeTab === 'activity'
                  ? (isAdmin ? 'Activity Management' : 'Member Activity Logs')
                  : activeTab === 'qr'
                  ? 'QR Attendance Scanner'
                  : activeTab === 'board'
                  ? 'Community Ride Posts'
                  : activeTab === 'members'
                  ? 'Members Directory'
                  : activeTab === 'events'
                  ? 'Ride & Event Scheduler'
                  : activeTab === 'leaderboard'
                  ? 'Mileage Leaderboard'
                  : activeTab === 'maps'
                  ? 'Offline Route Maps'
                  : activeTab === 'admin'
                  ? 'Executive Admin Hub'
                  : activeTab === 'document' ? (
                      <>
                        <span className="sm:hidden">Documents</span>
                        <span className="hidden sm:inline">Official Documents &amp; Governance</span>
                      </>
                    )
                  : activeTab === 'profile'
                  ? 'Rider Profile'
                  : activeTab === 'dashboard'
                  ? 'Dashboard'
                  : activeTab}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <RealtimeStatusPill />
              <div className="hidden lg:block">
                <PushNotificationCenter buttonClassName="relative p-2 rounded-xl bg-white hover:bg-[#f7f9f7] text-[#1b4332] border border-[#e2ece2] shadow-xs transition-all cursor-pointer" />
              </div>
              {activeTab === 'document' && (
                <>
                  <button
                    onClick={() => setPrintTrigger((prev) => prev + 1)}
                    title="System Print"
                    className="p-1.5 sm:px-3 sm:py-2 rounded-xl bg-[#f7f9f7] hover:bg-[#e2ece2] text-[#1b4332] text-xs font-bold border border-[#e2ece2] transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4 text-[#2d6a4f]" />
                    <span className="hidden sm:inline">Print</span>
                  </button>
                  <button
                    onClick={() => setExportPdfTrigger((prev) => prev + 1)}
                    title="Export PDF"
                    className="p-1.5 sm:p-2 rounded-xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white transition-colors cursor-pointer flex items-center justify-center shadow-xs"
                  >
                    <Download className="w-4 h-4 text-[#74c69d]" />
                  </button>
                </>
              )}
            </div>
          </header>
        )}

        {/* Dynamic Screen View Content */}
        <main className={`relative z-0 ${activeTab === 'qr' ? 'p-0 pb-0 max-w-none w-full' : 'p-2.5 sm:p-6 lg:p-8 pb-24 sm:pb-28 lg:pb-8 max-w-7xl'} w-full mx-auto flex-1 overflow-x-clip`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.985 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              {activeTab === 'dashboard' && (
                <Dashboard
                  setActiveTab={setActiveTab}
                />
              )}

              {activeTab === 'announcements' && <UpdatesHub />}

              {activeTab === 'members' && (
                <MembershipManagement />
              )}

              {activeTab === 'finances' && <Finances />}

              {activeTab === 'settings' && <Settings />}

              {activeTab === 'activity' && <ActivityLog />}

              {activeTab === 'qr' && <QRScan setActiveTab={setActiveTab} />}

              {activeTab === 'board' && <CommunityBoard />}

              {activeTab === 'profile' && (
                <RiderProfile />
              )}

              {activeTab === 'document' && currentUser && (
                <DocumentHub
                  user={currentUser}
                  exportPdfTrigger={exportPdfTrigger}
                  printTrigger={printTrigger}
                />
              )}

              {activeTab === 'admin' && isAdmin && <AdminERPPanel />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* PWA App Install Modal / Banner */}
      <PWAInstallBanner />

      {/* Heads-Up Push Notification Banner (OS / Reference Image Style) */}
      <AnimatePresence>
        {toastMessage && (
          <PushNotificationBanner
            isFloating={true}
            title={toastMessage.title}
            message={toastMessage.message}
            appName={toastMessage.appName || 'BCC Riders'}
            timeAgo={toastMessage.timeAgo || 'Just now'}
            iconSrc={toastMessage.icon || '/logo.png'}
            isThread={toastMessage.isThread}
            threadItems={toastMessage.threadItems}
            onDismiss={clearToast}
            onClearThread={clearAllNotifications}
            onThreadItemClick={(item) => {
              if (item.tab) {
                setActiveTab(item.tab as TabType);
              }
              clearToast();
            }}
            onClick={() => {
              if (toastMessage.tab) {
                setActiveTab(toastMessage.tab as TabType);
              }
              clearToast();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <LoaderProvider>
      <AuthProvider>
        <NotificationProvider>
          <MainAppContent />
        </NotificationProvider>
      </AuthProvider>
    </LoaderProvider>
  );
}
