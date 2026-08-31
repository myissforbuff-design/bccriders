import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  X,
  Layers,
  Calendar,
  User,
  Megaphone,
  ShieldAlert,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ThreadItem {
  id: string;
  title: string;
  message: string;
  type?: string;
  category?: string;
  tab?: string;
  timeAgo?: string;
}

export interface PushNotificationBannerProps {
  title: string;
  message: string;
  appName?: string;
  timeAgo?: string;
  iconSrc?: string;
  isThread?: boolean;
  threadItems?: ThreadItem[];
  onDismiss?: () => void;
  onClick?: () => void;
  onThreadItemClick?: (item: ThreadItem) => void;
  onClearThread?: () => void;
  isFloating?: boolean;
  className?: string;
}

export const PushNotificationBanner: React.FC<PushNotificationBannerProps> = ({
  title,
  message,
  appName = 'BCC Riders',
  timeAgo = 'Just now',
  iconSrc = '/logo.png',
  isThread = false,
  threadItems = [],
  onDismiss,
  onClick,
  onThreadItemClick,
  onClearThread,
  isFloating = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getCategoryIcon = (category?: string, type?: string) => {
    const key = (category || type || '').toLowerCase();
    if (key.includes('finance') || key.includes('due')) {
      return <User className="w-3.5 h-3.5 text-emerald-400" />;
    }
    if (key.includes('activ') || key.includes('ride')) {
      return <Calendar className="w-3.5 h-3.5 text-cyan-400" />;
    }
    if (key.includes('sos') || key.includes('emerg')) {
      return <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />;
    }
    return <Megaphone className="w-3.5 h-3.5 text-amber-400" />;
  };

  const containerContent = (
    <div
      onClick={!isExpanded ? onClick : undefined}
      role={onClick && !isExpanded ? 'button' : undefined}
      tabIndex={onClick && !isExpanded ? 0 : undefined}
      className={`relative w-full max-w-[480px] bg-[#2d2e30] text-white rounded-[24px] sm:rounded-[28px] p-3.5 sm:p-4 px-4 sm:px-5 shadow-2xl border border-white/10 select-none transition-all ${
        onClick && !isExpanded ? 'cursor-pointer hover:bg-[#37383a] active:scale-[0.99]' : ''
      } ${className}`}
      style={{
        boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Top Main Banner Row */}
      <div className="flex items-center gap-3.5">
        {/* App Icon (Squircle Badge with Logo) */}
        <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-[14px] sm:rounded-[16px] bg-gradient-to-br from-[#00b4d8] to-[#0077b6] flex items-center justify-center p-1.5 shrink-0 shadow-md">
          <img
            src={iconSrc || '/logo.png'}
            alt={appName}
            className="w-full h-full object-contain filter drop-shadow-xs"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/logo.png';
            }}
          />
          {isThread && (
            <span className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full border border-slate-900 flex items-center gap-0.5 shadow">
              <Layers className="w-2.5 h-2.5" />
              {threadItems.length || '•'}
            </span>
          )}
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0 pr-1">
          {/* Top Meta Row: App Name + Thread Pill + Timestamp & Chevron */}
          <div className="flex items-center justify-between text-[#a8aaae] text-[11.5px] sm:text-[12px] font-medium leading-none mb-1">
            <div className="flex items-center gap-2 truncate">
              <span className="truncate">{appName}</span>
              {isThread && (
                <span className="bg-cyan-500/20 text-cyan-300 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                  Thread · {threadItems.length} Updates
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <span>{timeAgo}</span>
              {isThread ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                  className="p-1 hover:text-white rounded transition-colors text-cyan-400"
                  title={isExpanded ? 'Collapse thread' : 'Expand thread'}
                >
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-[#a8aaae]" />
              )}
            </div>
          </div>

          {/* Title Row */}
          <div className="font-bold text-white text-[13.5px] sm:text-[14.5px] leading-tight tracking-tight truncate">
            {title}
          </div>

          {/* Body Row */}
          <div className="text-[#c4c6c9] text-[11.5px] sm:text-[12.5px] leading-snug line-clamp-2 mt-0.5">
            {message}
          </div>
        </div>

        {/* Optional dismiss button */}
        {onDismiss && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="p-1 text-[#a8aaae] hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-1"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Expandable Thread Items Accordion */}
      <AnimatePresence>
        {isThread && isExpanded && threadItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-white/10 space-y-2 overflow-hidden"
          >
            <div className="text-[11px] font-semibold text-[#8e9095] uppercase tracking-wider px-1 flex items-center justify-between">
              <span>Threaded Updates Since Last Visit</span>
              {onClearThread && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearThread();
                  }}
                  className="text-rose-400 hover:text-rose-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Thread
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {threadItems.map((item) => (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onThreadItemClick) {
                      onThreadItemClick(item);
                    } else if (onClick) {
                      onClick();
                    }
                  }}
                  className="bg-black/30 hover:bg-black/50 border border-white/5 rounded-xl p-2 px-3 flex items-center justify-between gap-2.5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      {getCategoryIcon(item.category, item.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium text-white truncate leading-tight">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[#a8aaae] truncate leading-tight mt-0.5">
                        {item.message}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 text-cyan-400 text-[11px] font-medium">
                    <span>View</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (!isFloating) {
    return containerContent;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
      className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[9999] w-[92%] sm:w-auto max-w-[480px] pointer-events-auto"
    >
      {containerContent}
    </motion.div>
  );
};
