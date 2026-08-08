import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { store } from '../lib/db';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (usernameOrEmail: string, passwordAttempt: string) => boolean;
  logout: () => void;
  switchUser: (userId: string) => void;
  updateUser: (updated: User) => void;
  refreshUserData: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => store.getCurrentUser());

  const refreshUserData = () => {
    const user = store.getCurrentUser();
    setCurrentUser(user ? { ...user } : null);
  };

  const login = (usernameOrEmail: string, passwordAttempt: string): boolean => {
    const user = store.login(usernameOrEmail, passwordAttempt);
    if (user) {
      setCurrentUser({ ...user });
      return true;
    }
    return false;
  };

  const logout = () => {
    store.logout();
    setCurrentUser(null);
  };

  const switchUser = (userId: string) => {
    const user = store.setCurrentUser(userId);
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
