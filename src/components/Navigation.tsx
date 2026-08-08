import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import {
  LayoutDashboard,
  Users,
  FileText,
  ClipboardList,
  Wallet,
  Settings,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  ChevronRight,
  User,
  QrCode,
  Calendar,
  X,
} from 'lucide-react';

export type TabType =
  | 'dashboard'
  | 'members'
  | 'finances'
  | 'settings'
  | 'events'
  | 'board'
  | 'leaderboard'
  | 'maps'
  | 'profile'
  | 'document'
  | 'admin'
  | 'activity'
  | 'qr';

interface NavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenDuesModal?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  onOpenDuesModal,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { currentUser, logout } = useAuth();
  const [showOfficerAlert, setShowOfficerAlert] = useState(false);

  useModalDismiss(showOfficerAlert, () => setShowOfficerAlert(false));

  const isMember = currentUser?.role === 'Member' || currentUser?.role?.toLowerCase() === 'member';

  const handleTabClick = (tab: TabType) => {
    if (tab === 'qr' && isMember) {
      setShowOfficerAlert(true);
      return;
    }
    setActiveTab(tab);
  };

  const rawNavItems =
    currentUser?.role === 'admin'
      ? [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'members', label: 'Members', icon: Users },
          { id: 'finances', label: 'Finances', icon: Wallet },
          { id: 'qr', label: 'QR Scan', icon: QrCode },
          { id: 'activity', label: 'Activity', icon: ClipboardList },
          { id: 'settings', label: 'Settings', icon: Settings },
        ]
      : [
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'activity', label: 'Activity', icon: ClipboardList },
          { id: 'qr', label: 'QR Scan', icon: QrCode },
          { id: 'document', label: 'Document', icon: FileText },
          { id: 'settings', label: 'Settings', icon: Settings },
        ];

  const navItems = isMember
    ? rawNavItems.filter((item) => item.id !== 'qr')
    : rawNavItems;

  return (
    <>
      {/* Officer Permission Alert Modal */}
      {showOfficerAlert && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-stone-200 text-center relative animate-scaleUp">
            <button
              type="button"
              onClick={() => setShowOfficerAlert(false)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h3 className="font-heading text-xl font-extrabold text-[#1b4332] mb-2">
              Access Restricted
            </h3>

            <p className="text-stone-800 font-extrabold text-sm sm:text-base mb-2">
              You are not an officer and not allowed to scan
            </p>

            <p className="text-stone-500 text-xs mb-6 leading-relaxed">
              Only designated club officers are authorized to scan member attendance QR codes for events.
            </p>

            <button
              type="button"
              onClick={() => setShowOfficerAlert(false)}
              className="w-full py-3.5 bg-[#1b4332] hover:bg-[#2d6a4f] text-white rounded-2xl font-bold text-sm shadow-md transition-all cursor-pointer active:scale-95"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Mobile & Tablet Top Header */}
      <div className="lg:hidden sticky top-0 z-30 bg-[#1b4332] border-b border-[#2d6a4f] px-4 py-3 flex items-center justify-between text-white shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-white text-[#1b4332] font-black shadow-md flex items-center justify-center">
            <img src="/logo.png" alt="BCC Logo" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <h1 className="font-heading text-base sm:text-lg font-bold text-white tracking-wide leading-none">
              BCC RIDERS CLUB
            </h1>
          </div>
        </div>

        {/* Mobile Sign Out Button (Icon Only) */}
        <button
          onClick={logout}
          title="Sign Out"
          className="p-2 rounded-xl bg-[#2d6a4f] hover:bg-rose-900/40 border border-[#52b788]/30 text-white hover:text-rose-200 transition-colors cursor-pointer flex items-center justify-center shadow-xs"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile & Tablet Bottom Navigation Bar (Matched to Image Design) */}
      <div className="lg:hidden fixed bottom-3 left-3 right-3 z-40 max-w-md mx-auto font-sans">
        <div className="relative bg-white/98 backdrop-blur-xl rounded-[28px] shadow-2xl shadow-stone-900/15 border border-stone-200/80 px-2 pt-3 pb-1.5">
          <div className="flex items-center justify-between relative px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isCenter = item.id === 'qr';

              if (isCenter) {
                return (
                  <div key={item.id} className="flex-1 flex justify-center items-center relative -mt-9 z-10">
                    <button
                      onClick={() => handleTabClick(item.id as TabType)}
                      title={item.label}
                      className="group cursor-pointer focus:outline-hidden"
                    >
                      {/* Outer Halo Ring */}
                      <div
                        className={`p-1.5 rounded-full transition-all duration-200 ${
                          isActive
                            ? 'bg-pink-200/90 ring-4 ring-[#e91e63]/25 scale-105'
                            : 'bg-pink-100 hover:bg-pink-200/80'
                        }`}
                      >
                        {/* Inner Action Button */}
                        <div className="w-13 h-13 sm:w-14 sm:h-14 bg-[#e91e63] hover:bg-[#d81b60] rounded-full flex items-center justify-center text-white shadow-lg shadow-[#e91e63]/35 group-active:scale-95 transition-all duration-200">
                          <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white stroke-[2.2]" />
                        </div>
                      </div>
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id as TabType)}
                  title={item.label}
                  className="flex-1 flex flex-col items-center justify-center py-1 transition-transform duration-150 active:scale-90 cursor-pointer select-none"
                >
                  <Icon
                    className={`w-6 h-6 transition-colors duration-200 ${
                      isActive ? 'text-[#e91e63] stroke-[2.4]' : 'text-stone-400 hover:text-stone-600 stroke-[1.8]'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Bottom Home Bar Indicator */}
          <div className="w-28 h-1 bg-stone-300/80 rounded-full mx-auto mt-2 mb-0.5" />
        </div>
      </div>

      {/* Desktop Sidebar Navigation (Only visible on lg screens and up) */}
      <aside
        className={`hidden lg:flex fixed top-0 bottom-0 left-0 z-40 bg-[#1b4332] text-white flex-col justify-between transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        <div className={`flex flex-col h-full overflow-y-auto ${isCollapsed ? 'p-3' : 'p-5'}`}>
          {/* Brand Logo Header */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} pb-5 border-b border-[#2d6a4f]`}>
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1.5 rounded-2xl bg-white hover:bg-white/90 font-black shadow-lg shrink-0 transition-all cursor-pointer group border border-white/50 hover:border-white flex items-center justify-center"
                title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                <img src="/logo.png" alt="BCC Logo" className="w-7 h-7 object-contain group-hover:scale-110 transition-transform" />
              </button>
              <h2 className={`font-heading text-lg font-extrabold text-white tracking-tight leading-none truncate ${isCollapsed ? 'hidden' : 'block'}`}>
                BCC RIDERS CLUB
              </h2>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="mt-6 flex-1 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id as TabType)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center px-0' : 'justify-between px-3.5'
                  } py-3 rounded-xl text-sm font-medium transition-all cursor-pointer relative ${
                    isActive
                      ? 'bg-[#2d6a4f] text-white shadow-md font-semibold'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className={`flex items-center ${isCollapsed ? 'gap-0' : 'gap-3'}`}>
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#74c69d]' : 'text-white/60'}`} />
                    <span className={isCollapsed ? 'hidden' : 'block'}>{item.label}</span>
                  </div>

                  {isActive && !isCollapsed && <ChevronRight className="w-4 h-4 text-[#74c69d] block" />}
                </button>
              );
            })}
          </nav>

          {/* User Account Info Footer */}
          {currentUser && (
            <div className="pt-4 border-t border-[#2d6a4f] mt-6">
              <div
                className={`p-2.5 rounded-2xl bg-[#081c15] border border-[#2d6a4f] flex items-center ${
                  isCollapsed ? 'flex-col gap-2 justify-between' : 'justify-between'
                }`}
              >
                {currentUser.role === 'admin' ? (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#2d6a4f]/50 border border-[#74c69d]/40 flex items-center justify-center shrink-0 text-[#74c69d]" title="Administrator">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    {!isCollapsed && (
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          Admin
                        </p>
                        <p className="text-[10px] text-[#74c69d] font-semibold truncate">
                          Administrator
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={currentUser.avatar || '/avatar.svg'}
                      alt={currentUser.name}
                      title={currentUser.name}
                      className="w-9 h-9 rounded-full object-cover border-2 border-[#74c69d] shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/avatar.svg';
                      }}
                    />
                    {!isCollapsed && (
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {currentUser.name}
                        </p>
                        <p className="text-[10px] text-[#74c69d] font-medium truncate flex items-center gap-1">
                          <span>{currentUser.memberNumber}</span>
                          <span>•</span>
                          <span className="capitalize">{currentUser.role}</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={logout}
                  className="p-1.5 text-white/60 hover:text-rose-300 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

