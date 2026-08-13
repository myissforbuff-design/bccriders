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
  if (!isLoading) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-6 select-none"
      >
        <div className="flex flex-col items-center text-center max-w-sm">
          {/* Official Dot Spinner Loader */}
          <OfficialDotSpinner />
          {message && (
            <p className="mt-5 text-xs font-extrabold tracking-wider text-[#1b4332] uppercase animate-pulse">
              {message}
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};


