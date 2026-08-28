import React from 'react';
import { ChevronUp, X } from 'lucide-react';
import { motion } from 'motion/react';

export interface PushNotificationBannerProps {
  title: string;
  message: string;
  appName?: string;
  timeAgo?: string;
  iconSrc?: string;
  onDismiss?: () => void;
  onClick?: () => void;
  isFloating?: boolean;
  className?: string;
}

export const PushNotificationBanner: React.FC<PushNotificationBannerProps> = ({
  title,
  message,
  appName = 'BCC Riders',
  timeAgo = 'Just now',
  iconSrc = '/logo.png',
  onDismiss,
  onClick,
  isFloating = false,
  className = '',
}) => {
  const containerContent = (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`relative w-full max-w-[480px] bg-[#37383a] text-white rounded-[26px] sm:rounded-[30px] p-3.5 sm:p-4 px-4 sm:px-5 shadow-2xl border border-white/10 select-none flex items-center gap-3.5 transition-all ${
        onClick ? 'cursor-pointer hover:bg-[#3f4043] active:scale-[0.99]' : ''
      } ${className}`}
      style={{
        boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* App Icon (Squircle Badge with Logo) */}
      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-[14px] sm:rounded-[16px] bg-gradient-to-br from-[#00b4d8] to-[#0077b6] flex items-center justify-center p-1.5 shrink-0 shadow-md">
        <img
          src={iconSrc || '/logo.png'}
          alt={appName}
          className="w-full h-full object-contain filter drop-shadow-xs"
          onError={(e) => {
            // Fallback if logo fails
            (e.target as HTMLImageElement).src = '/logo.png';
          }}
        />
      </div>

      {/* Text Content */}
      <div className="flex-1 min-w-0 pr-1">
        {/* Top Meta Row: App Name + Timestamp & Chevron */}
        <div className="flex items-center justify-between text-[#a8aaae] text-[11.5px] sm:text-[12px] font-medium leading-none mb-1">
          <span className="truncate">{appName}</span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <span>{timeAgo}</span>
            <ChevronUp className="w-3.5 h-3.5 text-[#a8aaae]" />
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
