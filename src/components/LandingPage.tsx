import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { store } from '../lib/db';
import { ConstitutionView } from './ConstitutionView';
import { RegistrationPageFlow } from './RegistrationPageFlow';
import {
  Bike,
  ShieldCheck,
  Key,
  User,
  Calendar,
  Trophy,
  MapPin,
  X,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LandingPageProps {
  onLoginSuccess: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [regViewMode, setRegViewMode] = useState<'landing' | 'constitution' | 'register'>('landing');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      // Check if user exists and is pending
      const normalizedInput = username.trim().toLowerCase();
      const allUsers = store.getUsers();
      const matched = allUsers.find(
        (u) =>
          u.username?.toLowerCase() === normalizedInput ||
          u.email.toLowerCase() === normalizedInput ||
          (normalizedInput === 'admin' && u.role === 'admin')
      );

      if (matched && matched.approvalStatus === 'Pending') {
        setLoading(false);
        setError('Registration Pending: Your member application is currently awaiting admin approval before you can sign in to the portal.');
        return;
      }

      const success = login(username, password);
      setLoading(false);
      if (success) {
        onLoginSuccess();
      } else {
        setError('Invalid username or password.');
      }
    }, 600);
  };

  return (
    <AnimatePresence mode="wait">
      {regViewMode === 'constitution' && (
        <motion.div
          key="constitution"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="bg-white min-h-screen"
        >
          <ConstitutionView
            onProceed={() => setRegViewMode('register')}
            onCancel={() => setRegViewMode('landing')}
          />
        </motion.div>
      )}

      {regViewMode === 'register' && (
        <motion.div
          key="register"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="bg-white min-h-screen"
        >
          <RegistrationPageFlow
            onSuccess={(newUser) => {
              store.addUser(newUser);
            }}
            onCancel={() => setRegViewMode('landing')}
          />
        </motion.div>
      )}

      {regViewMode === 'landing' && (
        <motion.div
          key="landing"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="min-h-screen bg-white text-[#2d3a3a] font-sans relative overflow-hidden flex flex-col justify-between"
        >
          {/* Background Logo */}
          <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden">
            <img
              src="/logo.png"
              alt=""
              className="w-[450px] h-auto object-contain opacity-10"
            />
          </div>

          {/* Hero & Login Section */}
          <main className="relative z-10 max-w-7xl mx-auto w-full px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center flex-1">
            
            {/* Mobile Header Title (Shown ONLY on small screens above the login box) */}
            <div className="block lg:hidden text-center space-y-1">
              <h1 className="font-heading text-4xl sm:text-5xl font-black text-[#1b4332] tracking-tight">
                BCC Riders Club
              </h1>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#1b4332] tracking-tight">
                Love. <span className="text-[#2d6a4f]">Peace.</span> Joy.
              </h2>
            </div>

            {/* Left Value Proposition (hidden on mobile, shown on large screens) */}
            <div className="hidden lg:block lg:col-span-7 space-y-8 text-left">
              <div className="space-y-2">
                <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-black text-[#1b4332] tracking-tight leading-none">
                  BCC Riders Club
                </h1>
                <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1b4332] tracking-tight leading-tight pt-1">
                  Love.{' '}
                  <span className="text-[#2d6a4f]">
                    Peace.{' '}
                  </span>
                  <span className="text-[#1b4332]">
                    Joy.
                  </span>
                </h2>
              </div>

              <p className="text-[#52605d] text-base sm:text-lg leading-relaxed max-w-2xl">
                Revelation 19:11 &ensp;"Then I saw heaven opened, and suddenly a white horse appeared. The name of the one riding it was Faithful and True, and with pure righteousness he judges and rides to battle."
              </p>
            </div>

            {/* Right Login Box */}
            <div className="lg:col-span-5 w-full">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 rounded-3xl bg-white/95 backdrop-blur-md border border-[#e2ece2] shadow-xl space-y-6 glow-natural"
              >
                <div className="space-y-1">
                  <h3 className="font-heading text-2xl font-extrabold text-[#1b4332]">
                    Member Sign In
                  </h3>
                  <p className="text-xs text-[#52605d]">
                    Enter your credentials to access your account
                  </p>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="text-[#2d3a3a] font-semibold mb-1.5 block">
                      Username or Email
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-sm focus:outline-none focus:border-[#2d6a4f]"
                        placeholder="Username"
                      />
                      <User className="w-4 h-4 text-[#52605d] absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[#2d3a3a] font-semibold mb-1.5 block">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-sm focus:outline-none focus:border-[#2d6a4f]"
                        placeholder="••••••••••••"
                      />
                      <Key className="w-4 h-4 text-[#52605d] absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  {/* Side-by-side action buttons wrapper without icons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3.5 px-4 rounded-2xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>Sign In</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegViewMode('constitution')}
                      className="flex-1 py-3.5 px-4 rounded-2xl bg-[#d8f3dc] hover:bg-[#b7e4c7] text-[#1b4332] font-extrabold text-xs border border-[#b7e4c7] transition-all cursor-pointer flex items-center justify-center"
                    >
                      <span>Register</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </main>

          {/* Footer */}
          <footer className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 border-t border-[#e2ece2]/80 text-xs text-[#52605d] flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3 sm:gap-4">
            
            {/* Logos and Copyright Wrapper for Mobile (Inline side-by-side) */}
            <div className="flex flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <img 
                  src="/logo.png" 
                  alt="BCC Logo 1" 
                  className="h-6 sm:h-8 w-auto object-contain opacity-80" 
                />
                <img 
                  src="/bcc-logo.png" 
                  alt="BCC Logo 2" 
                  className="h-6 sm:h-8 w-auto object-contain opacity-80" 
                />
              </div>

              {/* Copyright text shown beside logos on Mobile */}
              <p className="block sm:hidden text-center">
                © 2026 BCC Riders Club. All rights reserved.
              </p>
            </div>

            {/* Copyright text on Desktop (Pushed to the far right on larger screens) */}
            <p className="hidden sm:block text-right">
              © 2026 BCC Riders Club. All rights reserved.
            </p>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
};