import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { store } from '../lib/db';
import { ConstitutionView } from './ConstitutionView';
import { RegistrationPageFlow } from './RegistrationPageFlow';
import { OfficialLoader } from './OfficialLoader';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { LoginOtpModal } from './LoginOtpModal';
import { isModalOpen } from '../hooks/useModalDismiss';
import {
  Bike,
  ShieldCheck,
  Key,
  Eye,
  EyeOff,
  User,
  Calendar,
  Trophy,
  MapPin,
  X,
  CheckCircle2,
  Clock,
  Facebook,
  Fingerprint,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authenticateBiometricCredential, getStoredBiometrics, isBiometricsSupported } from '../lib/biometrics';

interface LandingPageProps {
  onLoginSuccess: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess }) => {
  const { login, loginWithUserId } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [showLoginOtpModal, setShowLoginOtpModal] = useState(false);
  const [loginOtpData, setLoginOtpData] = useState<{ email: string; maskedEmail: string; userId?: string; user?: any }>({
    email: '',
    maskedEmail: '',
    userId: '',
    user: undefined,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasStoredBiometrics, setHasStoredBiometrics] = useState(false);
  const [isBioLoading, setIsBioLoading] = useState(false);

  useEffect(() => {
    isBiometricsSupported().then((supported) => {
      if (supported) {
        const creds = getStoredBiometrics();
        setHasStoredBiometrics(creds.length > 0);
      }
    });
  }, []);

  const handleBiometricLogin = async () => {
    setError('');
    setIsBioLoading(true);
    try {
      const result = await authenticateBiometricCredential(
        username.trim() ? { id: '', username: username.trim() } : undefined
      );

      if (!result.success) {
        setError(result.error || 'Biometric authentication was not completed.');
        setIsBioLoading(false);
        return;
      }

      const matchedUserId = result.userId || result.matchedCredential?.userId;
      const matchedUsername = result.username || result.matchedCredential?.username;

      const user = store.getUsers().find(
        (u) =>
          (matchedUserId && u.id === matchedUserId) ||
          (matchedUsername && u.username.toLowerCase() === matchedUsername.toLowerCase())
      );

      if (user) {
        loginWithUserId(user);
        onLoginSuccess();
      } else if (matchedUserId) {
        loginWithUserId(matchedUserId);
        onLoginSuccess();
      } else {
        setError('Registered user account not found for these biometric credentials.');
      }
    } catch (err: any) {
      setError(err?.message || 'Biometric verification failed.');
    } finally {
      setIsBioLoading(false);
    }
  };

  const [regViewMode, setRegViewMode] = useState<'landing' | 'constitution' | 'register'>('landing');
  const [regPage, setRegPage] = useState<number>(1);
  const [isNavigatingReg, setIsNavigatingReg] = useState(false);
  const [regNavMsg, setRegNavMsg] = useState('Loading Registration Portal...');

  const handleOpenRegister = () => {
    setIsNavigatingReg(true);
    setRegNavMsg('Loading Constitution & By-Laws...');
    setTimeout(() => {
      setRegViewMode('constitution');
      setRegPage(1);
      try {
        window.history.pushState({ regStep: 'constitution' }, '');
      } catch {
        // ignore history error
      }
      setIsNavigatingReg(false);
    }, 600);
  };

  const handleProceedToForm = () => {
    setIsNavigatingReg(true);
    setRegNavMsg('Opening Member Registration Form...');
    setTimeout(() => {
      setRegViewMode('register');
      setRegPage(1);
      try {
        window.history.pushState({ regStep: 'register', page: 1 }, '');
      } catch {
        // ignore history error
      }
      setIsNavigatingReg(false);
    }, 600);
  };

  const handleRegPageChange = (newPage: number) => {
    setRegPage(newPage);
    try {
      const currentState = window.history.state;
      if (currentState?.regStep === 'register' && currentState?.page === newPage) {
        return;
      }
      window.history.pushState({ regStep: 'register', page: newPage }, '');
    } catch {
      // ignore history error
    }
  };

  const handleCancelToLanding = () => {
    setRegViewMode('landing');
    setRegPage(1);
    try {
      window.history.pushState({ regStep: 'landing' }, '');
    } catch {
      // ignore history error
    }
  };

  const handleCancelToPrevious = () => {
    if (window.history.state && window.history.state.regStep && window.history.state.regStep !== 'landing') {
      window.history.back();
    } else if (regViewMode === 'register') {
      if (regPage > 1) {
        setRegPage((p) => p - 1);
      } else {
        setRegViewMode('constitution');
        setRegPage(1);
      }
    } else if (regViewMode === 'constitution') {
      setRegViewMode('landing');
      setRegPage(1);
    }
  };

  useEffect(() => {
    if (!window.history.state || !window.history.state.regStep) {
      try {
        window.history.replaceState({ regStep: 'landing' }, '');
      } catch {
        // ignore history error
      }
    }

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      if (state && state.regStep) {
        if (state.regStep === 'register') {
          setRegViewMode('register');
          setRegPage(state.page || 1);
        } else if (state.regStep === 'constitution') {
          setRegViewMode('constitution');
          setRegPage(1);
        } else {
          setRegViewMode('landing');
          setRegPage(1);
        }
      } else {
        setRegViewMode('landing');
        setRegPage(1);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (isModalOpen()) return;

        if (window.history.state && window.history.state.regStep && window.history.state.regStep !== 'landing') {
          e.preventDefault();
          e.stopPropagation();
          window.history.back();
        } else if (regViewMode === 'register') {
          e.preventDefault();
          e.stopPropagation();
          if (regPage > 1) {
            setRegPage((p) => p - 1);
          } else {
            setRegViewMode('constitution');
            setRegPage(1);
          }
        } else if (regViewMode === 'constitution') {
          e.preventDefault();
          e.stopPropagation();
          setRegViewMode('landing');
          setRegPage(1);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [regViewMode, regPage]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setLoading(false);
      setError('Please enter both your registered username and password.');
      return;
    }

    // 1. Verify credentials locally first if available
    const credCheck = store.checkCredentials(cleanUsername, cleanPassword);
    if (!credCheck.success && credCheck.error && credCheck.error.includes('Pending')) {
      setLoading(false);
      setError(credCheck.error);
      return;
    }

    const matchedUser = credCheck.user;

    // Fast-path: If user is recognized as Admin locally and Admin OTP is disabled, log in directly without OTP
    const isMatchedAdmin =
      matchedUser &&
      (matchedUser.role === 'admin' ||
        matchedUser.role?.toLowerCase() === 'admin' ||
        matchedUser.username?.toLowerCase() === 'admin' ||
        matchedUser.id === 'usr_admin');

    if (credCheck.success && isMatchedAdmin) {
      const securitySettings = store.getSecuritySettings();
      if (!securitySettings.adminOtpEnabled) {
        const success = login(cleanUsername, cleanPassword);
        if (success) {
          setLoading(false);
          onLoginSuccess();
          window.location.reload();
          return;
        }
      }
    }

    // 2. Request OTP from backend (which checks MongoDB database and sends Resend authorization email)
    try {
      const res = await fetch('/api/auth/login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          password: cleanPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid Username or Password.');
      }

      // If OTP is bypassed (e.g. Admin with OTP disabled), sign in immediately
      if (data.requiresOtp === false) {
        const targetUser = data.user || matchedUser;
        const targetId = data.userId || matchedUser?.id;
        if (targetUser) {
          loginWithUserId(targetUser, data.token);
        } else if (targetId) {
          loginWithUserId(targetId, data.token);
        } else {
          login(cleanUsername, cleanPassword);
        }
        setLoading(false);
        onLoginSuccess();
        return;
      }

      setLoading(false);
      setLoginOtpData({
        email: data.email || matchedUser?.email || '',
        maskedEmail: data.maskedEmail || matchedUser?.email || '',
        userId: data.userId || matchedUser?.id || '',
        user: data.user || matchedUser,
      });
      setShowLoginOtpModal(true);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Invalid Username or Password.');
    }
  };

  const handleLoginOtpSuccess = (verifiedUserId: string, token?: string, verifiedUser?: any) => {
    setShowLoginOtpModal(false);
    const targetUser = verifiedUser || loginOtpData.user;
    const targetId = verifiedUserId || loginOtpData.userId;

    if (targetUser) {
      loginWithUserId(targetUser, token);
      onLoginSuccess();
    } else if (targetId) {
      loginWithUserId(targetId, token);
      onLoginSuccess();
    } else {
      const success = login(username, password);
      if (success) {
        onLoginSuccess();
      }
    }
  };

  return (
    <div className="bg-white min-h-screen">
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
            onProceed={handleProceedToForm}
            onCancel={handleCancelToLanding}
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
            currentPage={regPage}
            onPageChange={handleRegPageChange}
            onSuccess={(newUser) => {
              store.addUser(newUser);
            }}
            onCancel={handleCancelToLanding}
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
            <div className="block lg:hidden text-center space-y-2">
              <h1 className="font-heading text-4xl sm:text-5xl font-black text-[#1b4332] tracking-tight">
                BCC Riders Club
              </h1>
              <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#1b4332] tracking-tight">
                Love. <span className="text-[#2d6a4f]">Peace.</span> Joy.
              </h2>
              <div className="pt-1 flex flex-wrap justify-center items-center gap-2">
                <a
                  href="https://www.facebook.com/profile.php?id=61589518561366&rdid=t1oQo3E7q6ZIVwVO&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F1B1MNeTR1H%2F#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-transparent hover:bg-[#1877F2]/10 text-[#1877F2] font-bold text-xs transition-all cursor-pointer group"
                >
                  <img src="/fb.ico" alt="Riders Club Facebook" className="w-4 h-4 object-contain group-hover:scale-110 transition-transform" />
                  <span>BRC FB Page</span>
                </a>

                <a
                  href="https://www.facebook.com/buhangincommunitychurch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-transparent hover:bg-black/5 text-black font-bold text-xs transition-all cursor-pointer group"
                >
                  <img src="/bcc-logo.png" alt="Buhangin Community Church Facebook" className="w-4 h-4 object-contain group-hover:scale-110 transition-transform" />
                  <span>BCC FB Page</span>
                </a>
              </div>
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

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <a
                  href="https://www.facebook.com/profile.php?id=61589518561366&rdid=t1oQo3E7q6ZIVwVO&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F1B1MNeTR1H%2F#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-transparent hover:bg-[#1877F2]/10 text-[#1877F2] font-bold text-xs transition-all cursor-pointer group"
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <img src="/fb.ico" alt="Facebook Icon" className="w-full h-full object-contain" />
                  </div>
                  <span>BCC Riders Club</span>
                </a>

                <a
                  href="https://www.facebook.com/buhangincommunitychurch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-transparent hover:bg-black/5 text-black font-bold text-xs transition-all cursor-pointer group"
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <img src="/bcc-logo.png" alt="Church Logo" className="w-full h-full object-contain" />
                  </div>
                  <span>Buhangin Community Church</span>
                </a>
              </div>
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
                      Registered Username
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-sm focus:outline-none focus:border-[#2d6a4f]"
                        placeholder="Enter your registered username"
                      />
                      <User className="w-4 h-4 text-[#52605d] absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[#2d3a3a] font-semibold block">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setError('');
                          setShowForgotPasswordModal(true);
                        }}
                        className="text-[#2d6a4f] hover:text-[#1b4332] font-bold text-xs hover:underline cursor-pointer transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-10 pr-11 py-3 rounded-xl bg-[#f7f9f7] border border-[#e2ece2] text-[#2d3a3a] text-sm focus:outline-none focus:border-[#2d6a4f]"
                        placeholder="••••••••••••"
                      />
                      <Key className="w-4 h-4 text-[#52605d] absolute left-3.5 top-3.5 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[#52605d] hover:text-[#1b4332] absolute right-3.5 top-3.5 focus:outline-none transition-colors cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Side-by-side action buttons wrapper without icons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={loading || isBioLoading}
                      className="flex-1 py-3.5 px-4 rounded-2xl bg-[#1b4332] hover:bg-[#2d6a4f] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center"
                    >
                      <span>Sign In</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenRegister}
                      disabled={loading || isNavigatingReg || isBioLoading}
                      className="flex-1 py-3.5 px-4 rounded-2xl bg-[#d8f3dc] hover:bg-[#b7e4c7] text-[#1b4332] font-extrabold text-xs border border-[#b7e4c7] transition-all cursor-pointer flex items-center justify-center"
                    >
                      <span>Register</span>
                    </button>
                  </div>

                  {/* Biometric Sign-in Button */}
                  <div className="pt-2">
                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-[#e2ece2]"></div>
                      <span className="flex-shrink mx-2 text-[10px] uppercase font-bold text-[#52605d]">Or Quick Sign-In</span>
                      <div className="flex-grow border-t border-[#e2ece2]"></div>
                    </div>
                    <button
                      type="button"
                      id="biometric-signin-btn"
                      onClick={handleBiometricLogin}
                      disabled={loading || isBioLoading}
                      className="w-full mt-1.5 py-3.5 px-4 rounded-2xl bg-[#f0f9f1] hover:bg-[#d8f3dc] text-[#1b4332] font-black text-xs border border-[#74c69d] transition-all cursor-pointer flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.99] group"
                    >
                      <div className="w-6 h-6 rounded-lg bg-[#1b4332] text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Fingerprint className="w-4 h-4 text-[#74c69d]" />
                      </div>
                      <span>{isBioLoading ? 'Scanning Fingerprint / Face ID...' : 'Biometric Sign-in'}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </main>

          <ForgotPasswordModal
            isOpen={showForgotPasswordModal}
            onClose={() => setShowForgotPasswordModal(false)}
            onSuccess={(resetEmail) => {
              setUsername(resetEmail);
              setPassword('');
            }}
          />

          <LoginOtpModal
            isOpen={showLoginOtpModal}
            onClose={() => setShowLoginOtpModal(false)}
            email={loginOtpData.email}
            maskedEmail={loginOtpData.maskedEmail}
            userId={loginOtpData.userId}
            usernameOrEmail={username.trim()}
            passwordAttempt={password.trim()}
            onSuccess={handleLoginOtpSuccess}
          />

          <OfficialLoader
            isLoading={loading || isNavigatingReg}
            message={isNavigatingReg ? regNavMsg : 'Sending Security Code...'}
          />

          {/* Footer */}
          <footer className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-6 border-t border-[#e2ece2]/80 text-[11px] sm:text-xs text-[#52605d] flex flex-row items-center justify-between gap-2 sm:gap-4">
            
            {/* Logos on the Left */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <img 
                src="/logo.png" 
                alt="BCC Logo 1" 
                className="h-6 sm:h-7 w-auto object-contain opacity-80" 
              />
              <img 
                src="/bcc-logo.png" 
                alt="BCC Logo 2" 
                className="h-6 sm:h-7 w-auto object-contain opacity-80" 
              />
            </div>

            {/* Copyright text on the Right */}
            <p className="text-right text-[#52605d] font-medium leading-tight">
              © 2026 BCC Riders Club. All rights reserved.
            </p>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
};