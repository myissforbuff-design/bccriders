import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface OfficialLoaderProps {
  isLoading: boolean;
  message?: string;
}

export const OfficialDotSpinner: React.FC = () => (
  <div className="dot-spinner">
    <div className="dot-spinner__dot" />
    <div className="dot-spinner__dot" />
    <div className="dot-spinner__dot" />
    <div className="dot-spinner__dot" />
    <div className="dot-spinner__dot" />
    <div className="dot-spinner__dot" />
    <div className="dot-spinner__dot" />
    <div className="dot-spinner__dot" />
  </div>
);

export const OfficialLoader: React.FC<OfficialLoaderProps> = ({ isLoading, message }) => {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-md flex flex-col items-center justify-center p-6 select-none"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center text-center p-6 sm:p-8 rounded-3xl bg-white border border-[#e2ece2] shadow-2xl max-w-xs w-full"
          >
            {/* Official Dot Spinner Loader */}
            <OfficialDotSpinner />
            {message && (
              <p className="mt-5 text-xs font-extrabold tracking-wider text-[#1b4332] uppercase animate-pulse">
                {message}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Reusable animated skeleton placeholder for metric/currency values inside cards.
 * Prevents full-screen flashing and keeps layout stable while MongoDB resolves.
 */
export const CardValueSkeleton: React.FC<{
  className?: string;
  width?: string;
  height?: string;
  light?: boolean;
}> = ({ className = '', width = 'w-24 sm:w-28', height = 'h-5 sm:h-6', light = false }) => (
  <div
    className={`animate-pulse rounded-lg my-0.5 ${height} ${width} ${
      light ? 'bg-white/30' : 'bg-[#e2ece2]'
    } ${className}`}
  />
);

/**
 * Reusable sub-label skeleton placeholder inside cards.
 */
export const CardSubSkeleton: React.FC<{
  className?: string;
  width?: string;
  height?: string;
  light?: boolean;
}> = ({ className = '', width = 'w-16 sm:w-20', height = 'h-3', light = false }) => (
  <div
    className={`animate-pulse rounded-md my-0.5 ${height} ${width} ${
      light ? 'bg-white/20' : 'bg-[#e2ece2]/70'
    } ${className}`}
  />
);

/**
 * Reusable micro-spinner for card headers or status badges.
 */
export const CardMiniSpinner: React.FC<{ light?: boolean; size?: 'xs' | 'sm' | 'md' }> = ({
  light = false,
  size = 'sm',
}) => {
  const sizeClasses =
    size === 'xs' ? 'w-2.5 h-2.5 border' : size === 'md' ? 'w-4 h-4 border-2' : 'w-3.5 h-3.5 border-2';
  return (
    <div className="inline-flex items-center gap-1.5 py-0.5">
      <div
        className={`animate-spin rounded-full ${sizeClasses} ${
          light ? 'border-white/30 border-t-white' : 'border-[#1b4332]/25 border-t-[#1b4332]'
        }`}
      />
    </div>
  );
};



