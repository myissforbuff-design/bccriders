import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { store } from '../lib/db';
import { clearSensitiveStorage } from '../lib/storageSecurity';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (usernameOrEmail: string, passwordAttempt: string) => boolean;
  loginWithUserId: (userId: string, token?: string) => boolean;
  logout: () => void;
  switchUser: (userId: string, token?: string) => void;
  updateUser: (updated: User) => void;
  refreshUserData: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => store.getCurrentUser());

  useEffect(() => {
    // If no authenticated user session exists, ensure local and session storage are sanitized
    if (!currentUser) {
      store.clearStorageOnUnauthenticated();
    }
  }, [currentUser]);

  const refreshUserData = () => {
    const user = store.getCurrentUser();
    setCurrentUser(user ? { ...user } : null);
  };

  const login = (usernameOrEmail: string, passwordAttempt: string): boolean => {
    const user = store.login(usernameOrEmail, passwordAttempt);
    if (user) {
      setCurrentUser({ ...user });
      store.fetchAuthenticatedData().catch(() => {});
      return true;
    }
    return false;
  };

  const loginWithUserId = (userId: string, token?: string): boolean => {
    const user = store.loginWithUserId(userId, token);
    if (user) {
      setCurrentUser({ ...user });
      store.fetchAuthenticatedData().catch(() => {});
      return true;
    }
    return false;
  };

  const logout = () => {
    store.logout();
    clearSensitiveStorage();
    setCurrentUser(null);
  };

  const switchUser = (userId: string, token?: string) => {
    const user = store.setCurrentUser(userId, token);
    if (user) setCurrentUser({ ...user });
  };

  const updateUser = (updated: User) => {
    const saved = store.updateUser(updated);
    if (currentUser && currentUser.id === saved.id) {
      setCurrentUser({ ...saved });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isAdmin: currentUser?.role === 'admin',
        login,
        loginWithUserId,
        logout,
        switchUser,
        updateUser,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

