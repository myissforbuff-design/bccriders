import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface OfficialLoaderProps {
  isLoading: boolean;
  message?: string;
}

export const OfficialLoader: React.FC<OfficialLoaderProps> = ({ isLoading, message }) => {
  if (!isLoading) return null;

  const characters = 'Loading...'.split('');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 select-none"
      >
        <div className="flex flex-col items-center text-center space-y-6 max-w-sm">
          {/* Official BCC Shield Logo */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="w-36 h-36 sm:w-44 sm:h-44 relative flex items-center justify-center"
          >
            <img
              src="/logo.png"
              alt="BCC Riders Club Official Logo"
              className="w-full h-full object-contain drop-shadow-2xl"
            />
          </motion.div>

          {/* Staggered Alternately Jumping Text */}
          <div className="flex items-center justify-center space-x-0.5 font-sans font-extrabold text-3xl sm:text-4xl text-[#1a231e] tracking-tight">
            {characters.map((char, index) => (
              <motion.span
                key={index}
                animate={{
                  y: [0, -14, 0],
                }}
                transition={{
                  duration: 0.65,
                  repeat: Infinity,
                  repeatType: 'loop',
                  ease: 'easeInOut',
                  delay: index * 0.08,
                }}
                className="inline-block"
              >
                {char}
              </motion.span>
            ))}
          </div>

          {message && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-bold text-[#2d6a4f] uppercase tracking-wider bg-[#d8f3dc] px-3 py-1 rounded-full border border-[#b7e4c7]"
            >
              {message}
            </motion.p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
