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
          className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-xs flex flex-col items-center justify-center p-6 select-none"
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


